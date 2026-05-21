# Task List Attachments - Frontend Integration Guide

This guide explains how the frontend should integrate list-level attachments for uploaded files and external links.

Backend status: implemented for schema, guarded API routes, file upload presign/confirm, link creation, listing/filtering, get/update/delete, activity logging, locked-project protection, and targeted tests.

## Core Behavior

Task list attachments are a flat collection attached directly to a task list.

- Attachments can be uploaded files or external links.
- Files use `kind: "FILE"` and include S3-backed metadata plus short-lived `viewUrl` values.
- Links use `kind: "LINK"` and include `linkUrl`; they do not have S3 metadata or `viewUrl`.
- Any workspace member who can access and unlock the parent project can list, view, upload, and add links.
- Only the uploader, workspace `OWNER`, or workspace `ADMIN` can update or delete an attachment.
- List attachments are isolated from project attachment search/results.
- There are no realtime events for this feature. Refetch after mutations and on focus/reconnect where useful.

## Required Headers

All task list attachment endpoints require the existing auth and workspace headers:

```http
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
Content-Type: application/json
```

File upload to the returned S3 `uploadUrl` is the exception: send the file bytes directly to S3 with `PUT`. Do not include the app API auth headers in that S3 request.

## Endpoints

Base path:

```http
/task-lists/:listId/attachments
```

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/task-lists/:listId/attachments/presign` | Get a presigned S3 upload URL for a task list file |
| `POST` | `/task-lists/:listId/attachments/confirm` | Confirm an uploaded file and create the attachment row |
| `POST` | `/task-lists/:listId/attachments/links` | Create an external link attachment |
| `GET` | `/task-lists/:listId/attachments` | List task list attachments |
| `GET` | `/task-lists/:listId/attachments/:attachmentId` | Get one task list attachment |
| `PATCH` | `/task-lists/:listId/attachments/:attachmentId` | Update `title` and/or `description` |
| `DELETE` | `/task-lists/:listId/attachments/:attachmentId` | Soft-delete an attachment |

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
  "createdAt": "2026-05-21T10:30:00.000Z",
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
  "createdAt": "2026-05-21T10:30:00.000Z",
  "linkUrl": "https://www.figma.com/file/example"
}
```

## File Upload Flow

### 1. Presign

`POST /task-lists/:listId/attachments/presign`

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
  "s3Key": "swiftnine/docs/app/attachments/list-list-id/generated-requirements.pdf",
  "expiresAt": "2026-05-21T10:45:00.000Z",
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

### 3. Confirm

`POST /task-lists/:listId/attachments/confirm`

Request:

```json
{
  "s3Key": "swiftnine/docs/app/attachments/list-list-id/generated-requirements.pdf",
  "fileName": "requirements.pdf",
  "mimeType": "application/pdf",
  "fileSize": 245000,
  "title": "Requirements",
  "description": "Kickoff reference"
}
```

Success data is a file attachment response with a short-lived `viewUrl`.

## Link Flow

`POST /task-lists/:listId/attachments/links`

Request:

```json
{
  "linkUrl": "https://www.figma.com/file/example",
  "title": "Figma board",
  "description": "Main design reference"
}
```

`linkUrl` must be an `http://` or `https://` URL.

## Attachments Tab

For the list details UI, the tab layout can use:

```txt
List | Board | Attachments
```

The `Attachments` tab should fetch only:

```http
GET /task-lists/:listId/attachments
```

After upload, link creation, metadata update, or delete, invalidate/refetch that same list attachment query.
