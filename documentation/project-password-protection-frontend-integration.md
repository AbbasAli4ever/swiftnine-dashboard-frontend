# Project Password Protection - Frontend Integration Guide

This guide explains how the frontend should integrate project-level password protection smoothly.

Backend status: implemented across schema, password APIs, direct project routes, indirect content routes, realtime, notifications/search filtering, and hardening cleanup.

## Core Behavior

Project password protection is opt-in per project.

- A project is protected when it has a server-side password hash.
- Every workspace member must unlock the project before viewing protected content.
- Workspace owners and admins do not bypass the content lock.
- Unlock state is per user and per project.
- Unlock expires after 24 hours.
- Password change, password reset, and password removal invalidate active unlock sessions immediately.
- Passwords and reset tokens are never returned by the API.

Use `locked` and lock-status responses to decide whether to show protected UI, not role alone.

## Required Headers

All HTTP endpoints use the existing API response and auth conventions.

```http
Authorization: Bearer <accessToken>
x-workspace-id: <workspaceId>
Content-Type: application/json
```

Important: password reset confirmation is also currently behind `JwtAuthGuard` and `WorkspaceGuard`, so the reset screen must submit while authenticated and include `x-workspace-id`.

## API Response Shape

Successful responses use:

```json
{
  "success": true,
  "data": {},
  "message": "Optional message"
}
```

Project-lock errors use normal HTTP error status codes. Stable project-security codes are nested under `message.code` because of the global exception filter:

```json
{
  "statusCode": 403,
  "message": {
    "code": "PROJECT_LOCKED",
    "message": "Project is locked"
  }
}
```

Frontend helper recommendation:

```ts
function getApiErrorCode(error: unknown): string | null {
  const payload = (error as any)?.response?.data ?? error;
  return payload?.message?.code ?? payload?.code ?? null;
}
```

## Password Endpoints

### Set Initial Password

`POST /projects/:projectId/password`

Allowed for workspace `OWNER` or project creator.

Request:

```json
{
  "password": "Secret123"
}
```

Success data:

```json
{
  "id": "project-id",
  "workspaceId": "workspace-id",
  "passwordUpdatedAt": "2026-05-13T10:00:00.000Z"
}
```

### Change Password

`PUT /projects/:projectId/password`

Allowed for workspace `OWNER` or project creator. Invalidates all active unlock sessions.

Request:

```json
{
  "currentPassword": "Secret123",
  "newPassword": "NewSecret123"
}
```

Success data matches set password.

### Remove Password

`DELETE /projects/:projectId/password`

Allowed for workspace `OWNER` or project creator. Removes the lock and clears unlock/attempt/reset records for the project.

Success data: `null`

### Unlock Project

`POST /projects/:projectId/unlock`

Any workspace member can attempt unlock.

Request:

```json
{
  "password": "Secret123"
}
```

Success data for a protected project:

```json
{
  "projectId": "project-id",
  "isLocked": true,
  "unlockedUntil": "2026-05-14T10:00:00.000Z"
}
```

Success data for an unprotected project:

```json
{
  "projectId": "project-id",
  "isLocked": false,
  "unlockedUntil": null
}
```

On success, update client cache for that project to `locked: false` and refetch the project/content the user was trying to open.

### Lock Status

`GET /projects/:projectId/lock-status`

Does not require the project to already be unlocked.

Success data:

```json
{
  "projectId": "project-id",
  "isLocked": true,
  "isUnlocked": false,
  "unlockedUntil": null,
  "passwordUpdatedAt": "2026-05-13T10:00:00.000Z"
}
```

Use this when:

- opening a project route directly by URL
- deciding whether to show an unlock modal
- refreshing stale client state after websocket `project:lock-changed`

### Request Password Reset

`POST /projects/:projectId/password/reset-request`

Allowed for workspace `OWNER` or project creator. Sends email to the project creator.

Request body: none.

Success data: `null`

Rate limit: repeated requests for the same project within 5 minutes return HTTP `429` with code `RESET_REQUEST_RATE_LIMITED`.

### Confirm Password Reset

`POST /projects/:projectId/password/reset-confirm`

Request:

```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecret123"
}
```

Success data:

```json
{
  "projectId": "project-id",
  "passwordUpdatedAt": "2026-05-13T10:00:00.000Z"
}
```

After reset success, treat the project as locked for everyone until they unlock again.

## Password Rules

Backend validation requires:

- at least 8 characters
- at least 1 digit

Recommended frontend validation regex:

```ts
/^(?=.*\d).{8,}$/
```

Do not log, persist, cache, or send passwords anywhere except the password endpoint request body.

## Error Codes To Handle

Project-security codes:

- `PROJECT_LOCKED`: show unlock modal or locked state.
- `INVALID_PASSWORD`: show invalid password message.
- `TOO_MANY_ATTEMPTS`: disable unlock form temporarily and ask user to try later.
- `INVALID_PASSWORD_FORMAT`: show password rule validation.
- `PASSWORD_ALREADY_SET`: refresh lock status; project already has a password.
- `PROJECT_PASSWORD_NOT_SET`: refresh lock status; project is no longer protected.
- `RESET_TOKEN_INVALID`: reset link is invalid or expired.
- `RESET_REQUEST_RATE_LIMITED`: show cooldown message before another reset request.
- `PROJECT_PASSWORD_MANAGER_ONLY`: hide/disable password management for this user.
- `PROJECT_NOT_FOUND`: navigate away or show not found.

Suggested handling:

```ts
if (getApiErrorCode(error) === 'PROJECT_LOCKED') {
  openProjectUnlockModal(projectId);
}
```

## Project List Integration

`GET /projects` and `GET /projects/archived` return a mixed list.

Unlocked or unprotected project item:

```json
{
  "id": "project-id",
  "workspaceId": "workspace-id",
  "name": "Launch",
  "description": "Go-live work",
  "color": "#2563eb",
  "icon": "rocket",
  "taskIdPrefix": "LCH",
  "statuses": [],
  "isFavorite": false,
  "locked": false,
  "passwordUpdatedAt": "2026-05-13T10:00:00.000Z"
}
```

Locked project item:

```json
{
  "id": "project-id",
  "workspaceId": "workspace-id",
  "locked": true,
  "isFavorite": false
}
```

Frontend expectations:

- Render locked projects as visible rows/cards with a lock affordance.
- Do not assume `name`, `description`, `color`, `icon`, `statuses`, or `taskIdPrefix` exist when `locked: true`.
- On click of a locked project, open unlock modal instead of navigating into project content.
- After unlock success, refetch `GET /projects` or `GET /projects/:projectId`.

TypeScript shape:

```ts
type LockedProjectListItem = {
  id: string;
  workspaceId: string;
  locked: true;
  isFavorite: boolean;
  favoritedAt?: string;
};

type UnlockedProjectListItem = {
  id: string;
  workspaceId: string;
  locked: false;
  passwordUpdatedAt: string | null;
  isFavorite: boolean;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  taskIdPrefix: string;
  statuses: unknown[];
};

type ProjectListItem = LockedProjectListItem | UnlockedProjectListItem;
```

## Protected Content Behavior

When a project is locked for the current user, the backend blocks or filters project content across:

- project detail and project dashboard
- project task lists and board
- status endpoints
- project channels
- project favorites actions
- task detail and task mutation paths
- comments and reactions on project tasks
- time entries on project tasks
- task/doc/channel attachments tied to locked project content
- project-scoped docs
- project activity and task activity for locked projects
- workspace task search
- doc search
- chat message search for project channels
- notifications for task/comment/project-channel message references

Recommended frontend behavior:

- Treat any `PROJECT_LOCKED` response as recoverable.
- Show unlock modal with the project id from route/context.
- After unlock, retry the failed request once.
- For aggregate lists/search, locked content is filtered out rather than returned as placeholders.

## Realtime Integration

### Chat Namespace

Namespace: `/chat`

Joining project channels requires active project unlock.

Client emits:

```ts
socket.emit('chat:join', { channelId });
```

If locked, the gateway throws a websocket exception with:

```json
{
  "code": "PROJECT_LOCKED",
  "message": "Project is locked"
}
```

### Docs Namespace

Namespace: `/docs`

Joining project docs requires active project unlock.

Client emits:

```ts
socket.emit('doc:join', { docId });
```

If locked, the gateway throws the same `PROJECT_LOCKED` shape.

### Lock Change Event

When a password is changed, removed, or reset, chat/doc gateways emit:

```ts
socket.on('project:lock-changed', (event) => {
  // event.projectId
  // event.reason: 'password_changed' | 'password_removed' | 'password_reset'
  // event.channelId may exist in chat namespace
  // event.docId may exist in docs namespace
});
```

Backend then force-leaves affected project chat/doc rooms.

Frontend should:

- clear cached unlock state for that project
- close or disable active project content screens
- refetch `GET /projects/:projectId/lock-status`
- if reason is `password_removed`, content may become accessible after refetch
- if reason is `password_changed` or `password_reset`, ask user to unlock again

## Recommended UX Flows

### Opening a Project From List

1. If row has `locked: true`, open unlock modal.
2. Submit `POST /projects/:projectId/unlock`.
3. On success, refetch project list and navigate to project.
4. On `INVALID_PASSWORD`, keep modal open.
5. On `TOO_MANY_ATTEMPTS`, disable submit and show try-later message.

### Direct URL To Project Page

1. Call the normal project endpoint.
2. If it returns `PROJECT_LOCKED`, call `GET /projects/:projectId/lock-status`.
3. Show unlock modal.
4. Retry original load after unlock.

### Password Management Screen

Show controls only when the user is likely allowed:

- workspace role is `OWNER`, or
- user id equals project creator id when available from an unlocked project detail response.

Still handle `PROJECT_PASSWORD_MANAGER_ONLY` because backend is the source of truth.

### Reset Link Screen

1. Read `projectId` from route and `token` from query string.
2. Require the user to be authenticated and workspace-selected.
3. Submit `POST /projects/:projectId/password/reset-confirm`.
4. On success, route to project unlock flow or project list.
5. On `RESET_TOKEN_INVALID`, show expired/invalid link state.

## Cache Invalidation Checklist

After successful unlock:

- invalidate project list
- invalidate project detail
- invalidate project dashboard
- invalidate task/list/board queries for that project
- reconnect or rejoin project chat/doc rooms if needed

After password set/change/reset:

- invalidate project list and lock-status
- clear local unlocked state for that project
- close project content rooms/screens until unlocked again

After password removal:

- invalidate project list and lock-status
- clear unlock modal state
- refetch content normally

## Delivery Notes

- The backend does not return `passwordHash`.
- Locked project list items are intentionally redacted.
- Search and notifications silently filter locked-project content.
- The unlock session is server-side only; there is no unlock token for the frontend to store.
- Client-side unlock state should be treated as a cache. The backend remains authoritative.
