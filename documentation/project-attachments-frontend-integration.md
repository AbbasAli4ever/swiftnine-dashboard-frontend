# Project Attachments - Frontend Integration Guide

This guide explains how the frontend should integrate project-level attachments for uploaded files and external links.

Backend status: implemented for schema, guarded API routes, file upload presign/confirm, link creation, listing/filtering, get/update/delete, activity logging, project-delete lifecycle, locked-project protection, search service support, and targeted tests.

## Core Behavior

Project attachments are a flat collection attached directly to a project.

- Attachments can be uploaded files or external links.
- Files use `kind: "FILE"` and include S3-backed metadata plus short-lived `viewUrl` values.
- Links use `kind: "LINK"` and include `linkUrl`; they do not have S3 metadata or `viewUrl`.
- Any workspace member who can access and unlock the project can list, view, upload, and add links.
- Only the uploader, workspace `OWNER`, or workspace `ADMIN` can update or delete an attachment.
- There are no realtime events for this feature. Refetch after mutations and on focus/reconnect where useful.

## Required Headers

All project attachment endpoints require the existing auth and workspace headers:

```http
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
Content-Type: application/json
```

File upload to the returned S3 `uploadUrl` is the exception: send the file bytes directly to S3 with `PUT`. Do not include the app API auth headers in that S3 request.

## API Response Shape

Successful app API responses use:

```json
{
  "success": true,
  "data": {},
  "message": "Optional message"
}
```

Project-lock errors use the existing project security response:

```json
{
  "statusCode": 403,
  "message": {
    "code": "PROJECT_LOCKED",
    "message": "Project is locked"
  }
}
```

Recommended frontend helper:

```ts
function getApiErrorCode(error: unknown): string | null {
  const payload = (error as any)?.response?.data ?? error;
  return payload?.message?.code ?? payload?.code ?? null;
}
```

If `getApiErrorCode(error) === "PROJECT_LOCKED"`, open the project unlock flow, then retry/refetch after a successful unlock.

## Endpoints

Base path:

```http
/projects/:projectId/attachments
```

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/projects/:projectId/attachments/presign` | Get a presigned S3 upload URL for a project file |
| `POST` | `/projects/:projectId/attachments/confirm` | Confirm an uploaded file and create the attachment row |
| `POST` | `/projects/:projectId/attachments/links` | Create an external link attachment |
| `GET` | `/projects/:projectId/attachments` | List project attachments |
| `GET` | `/projects/:projectId/attachments/:attachmentId` | Get one project attachment |
| `PATCH` | `/projects/:projectId/attachments/:attachmentId` | Update `title` and/or `description` |
| `DELETE` | `/projects/:projectId/attachments/:attachmentId` | Soft-delete an attachment |

## Attachment Response

File attachment example:

```json
{
  "id": "attachment-id",
  "kind": "FILE",
  "title": "Requirements",
  "description": "Kickoff reference",
  "uploadedBy": {
    "id": "user-id",
    "name": "Jane Doe",
    "avatarUrl": null
  },
  "createdAt": "2026-05-13T10:30:00.000Z",
  "fileName": "requirements.pdf",
  "mimeType": "application/pdf",
  "fileSize": 245000,
  "viewUrl": "https://signed-s3-view-url"
}
```

Link attachment example:

```json
{
  "id": "attachment-id",
  "kind": "LINK",
  "title": "Figma board",
  "description": "Main design reference",
  "uploadedBy": {
    "id": "user-id",
    "name": "Jane Doe",
    "avatarUrl": null
  },
  "createdAt": "2026-05-13T10:30:00.000Z",
  "linkUrl": "https://www.figma.com/file/example"
}
```

Important frontend distinction:

- Render `viewUrl` only for `kind: "FILE"`.
- Render `linkUrl` only for `kind: "LINK"`.
- Do not assume `fileName`, `mimeType`, `fileSize`, or `viewUrl` exist for links.

## File Upload Flow

### 1. Presign

`POST /projects/:projectId/attachments/presign`

Request:

```json
{
  "fileName": "requirements.pdf",
  "mimeType": "application/pdf",
  "fileSize": 245000
}
```

Success data:

```json
{
  "uploadUrl": "https://signed-s3-upload-url",
  "s3Key": "swiftnine/docs/app/attachments/project-project-id/generated-requirements.pdf",
  "expiresAt": "2026-05-13T10:45:00.000Z",
  "attachmentId": null
}
```

### 2. Upload To S3

Use the returned `uploadUrl`:

```ts
await fetch(uploadUrl, {
  method: "PUT",
  headers: {
    "Content-Type": file.type || "application/octet-stream",
  },
  body: file,
});
```

The backend signs without a required content-type header to avoid signature mismatches, but sending the file content type is still recommended.

### 3. Confirm

`POST /projects/:projectId/attachments/confirm`

Request:

```json
{
  "s3Key": "swiftnine/docs/app/attachments/project-project-id/generated-requirements.pdf",
  "fileName": "requirements.pdf",
  "mimeType": "application/pdf",
  "fileSize": 245000,
  "title": "Requirements",
  "description": "Kickoff reference"
}
```

Success data is a file attachment response with a short-lived `viewUrl`.

### 4. Refetch List

After confirm succeeds:

- Invalidate/refetch `GET /projects/:projectId/attachments`.
- Clear any local upload progress state.
- If confirm fails after S3 upload succeeds, show a retry action that calls confirm again with the same `s3Key`.

## Link Flow

`POST /projects/:projectId/attachments/links`

Request:

```json
{
  "linkUrl": "https://www.figma.com/file/example",
  "title": "Figma board",
  "description": "Main design reference"
}
```

Validation details:

- `linkUrl` must be a valid URL.
- Only `http://` and `https://` URLs are accepted.
- `title` is required.
- `description` is optional.

After success, refetch the attachment list.

## Listing And Filters

`GET /projects/:projectId/attachments`

Query params:

| Param | Type | Notes |
|---|---|---|
| `kind` | `FILE` or `LINK` | Optional filter |
| `uploadedBy` | UUID | Optional uploader user ID |
| `q` | string | Searches `fileName`, `title`, `description`, and `linkUrl` |
| `cursor` | string | Use `nextCursor` from previous response |
| `limit` | number | Default `50`, max `100` |

Example:

```http
GET /projects/project-id/attachments?kind=LINK&q=figma&limit=25
```

Success data:

```json
{
  "items": [
    {
      "id": "attachment-id",
      "kind": "LINK",
      "title": "Figma board",
      "description": "Main design reference",
      "uploadedBy": {
        "id": "user-id",
        "name": "Jane Doe",
        "avatarUrl": null
      },
      "createdAt": "2026-05-13T10:30:00.000Z",
      "linkUrl": "https://www.figma.com/file/example"
    }
  ],
  "nextCursor": null,
  "limit": 25
}
```

Pagination:

- Sort is newest-first.
- Pass `nextCursor` into the next request.
- Stop when `nextCursor` is `null`.

## Get One Attachment

`GET /projects/:projectId/attachments/:attachmentId`

Use this when:

- Opening an attachment detail/preview panel.
- Refreshing an expired file `viewUrl`.
- Fetching the latest title/description after a background mutation.

Files receive a fresh `viewUrl`; links do not.

## Updating Metadata

`PATCH /projects/:projectId/attachments/:attachmentId`

Request can include either or both fields:

```json
{
  "title": "Updated title",
  "description": "Updated description"
}
```

Null values are allowed to clear metadata:

```json
{
  "description": null
}
```

Permissions:

- Uploader can update.
- Workspace `OWNER` can update.
- Workspace `ADMIN` can update.
- Other workspace `MEMBER` users receive `403`.

For link attachments, changing `title` also updates the internal display filename so search/listing stays consistent.

After success, update local cache for that attachment or refetch the list.

## Deleting

`DELETE /projects/:projectId/attachments/:attachmentId`

Success data:

```json
{
  "id": "attachment-id",
  "s3Key": "swiftnine/docs/app/attachments/project-project-id/file.pdf"
}
```

For link attachments, `s3Key` can be `null`.

Delete is a soft delete:

- The attachment disappears from project attachment list/get/search.
- The backend logs `attachment_deleted`.
- S3 cleanup is not part of the frontend flow.

Permissions match update: uploader, workspace `OWNER`, or workspace `ADMIN`.

## Locked Project Behavior

All project attachment HTTP routes use `ProjectUnlockedGuard`.

If the project is password-protected and the user has not unlocked it:

- Upload presign is blocked.
- Confirm is blocked.
- Link creation is blocked.
- List/get/update/delete are blocked.
- Error code is `PROJECT_LOCKED`.

Recommended flow:

1. User opens project attachments.
2. If request returns `PROJECT_LOCKED`, open unlock modal.
3. On successful unlock, retry the original request and refetch project data.

Workspace owners/admins do not bypass the lock for attachment content.

## S3 View URL Expiry

File `viewUrl` values are signed for about 15 minutes.

Recommendations:

- Do not store `viewUrl` long-term.
- Use `GET /projects/:projectId/attachments/:attachmentId` to refresh a stale file URL before preview/download.
- If an image/pdf preview fails with an S3 expiry-style error, refetch the attachment and retry with the new `viewUrl`.

## Cache And State Recommendations

Suggested query keys:

```ts
["project-attachments", workspaceId, projectId, filters]
["project-attachment", workspaceId, projectId, attachmentId]
```

Invalidate/refetch list after:

- File confirm.
- Link create.
- Metadata update.
- Delete.
- Successful project unlock.
- Window focus/reconnect if the attachments panel is open.

Optimistic updates are safe for metadata update and delete, but keep upload confirm pessimistic because S3 upload and DB confirm are separate steps.

## Search Notes

The backend currently has entity-specific search surfaces rather than one public unified global search endpoint.

Implemented backend support:

- `AttachmentsService.searchProjectAttachments(userId, workspaceId, query)` searches project attachments.
- It excludes locked projects unless the user has an active unlock.
- This is ready to wire into a future unified global search endpoint.

There is no public project attachment search endpoint yet beyond list filtering with `q`.

## Activity And Realtime

Activity actions emitted by the backend:

- `attachment_uploaded`
- `attachment_linked`
- `attachment_updated`
- `attachment_deleted`

All map to the `attachments` activity category.

No websocket/realtime project attachment events are emitted. Refetch after mutations and on focus if freshness matters.

## TypeScript Helper Types

```ts
type ProjectAttachmentUploader = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
};

type ProjectFileAttachment = {
  id: string;
  kind: "FILE";
  title: string | null;
  description: string | null;
  uploadedBy: ProjectAttachmentUploader;
  createdAt: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  viewUrl: string;
};

type ProjectLinkAttachment = {
  id: string;
  kind: "LINK";
  title: string | null;
  description: string | null;
  uploadedBy: ProjectAttachmentUploader;
  createdAt: string;
  linkUrl: string;
};

type ProjectAttachment = ProjectFileAttachment | ProjectLinkAttachment;

type ProjectAttachmentListResponse = {
  items: ProjectAttachment[];
  nextCursor: string | null;
  limit: number;
};
```

## UI Checklist

- Show tabs or filters for `All`, `Files`, and `Links`.
- Support search input mapped to `q`.
- Show uploader and created date.
- For files, show file name, size, MIME/file icon, and preview/download using `viewUrl`.
- For links, open `linkUrl` in a new tab with safe attributes.
- Show edit/delete actions only for uploader/admin/owner when the frontend knows the role/uploader. Still handle backend `403`.
- Handle `PROJECT_LOCKED` globally and retry after unlock.
- Refetch after all mutations.
