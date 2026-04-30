# Notifications API

Purpose: frontend integration reference for the notification subscription stream (SSE), SSE payload shapes, and HTTP notification state/list APIs. This page documents every notification API implemented in the backend and provides example requests and responses.

All endpoints below are guarded by `JwtAuthGuard` and `WorkspaceGuard`.

Required headers for HTTP requests:

- `Authorization: Bearer <ACCESS_TOKEN>`
- `x-workspace-id: <WORKSPACE_ID>`

Note for browsers: native `EventSource` cannot set custom `Authorization` headers. Use cookie-based auth with `withCredentials`, a frontend proxy that injects the header, or use `fetch()` and parse the SSE stream manually.

SUMMARY
- `GET /notifications/members/:memberId/stream` — open SSE stream for a workspace member
- `PATCH /notifications/:id/clear` — set cleared/un-cleared
- `PATCH /notifications/:id/snooze` — set snooze/un-snooze (optional expiry)
- `PATCH /notifications/:id/read` — mark read/unread
- `GET /notifications/cleared` — list cleared notifications
- `GET /notifications/snoozed` — list currently snoozed notifications

---

## 1) SSE: Subscribe to live updates

GET /notifications/members/:memberId/stream

Description
- Opens a Server-Sent Events (SSE) stream for a workspace member so the client receives live `notification:created` and `notification:updated` events.

Headers
- `Authorization: Bearer <TOKEN>`
- `x-workspace-id: <WORKSPACE_ID>`

Path params
- `memberId` (string): workspace member id OR user id (the server resolves both).

Rules
- Only the authenticated user may open their own member stream. Opening another user's stream returns `403`.

Behavior
- When the stream opens the server sends an initial `notifications:init` event (array of existing notifications) and keeps the connection open.
- The server sends heartbeat comments (`:heartbeat`) every 15 seconds.

Client cURL (keep-alive)

```bash
curl -N \
  -H "Authorization: Bearer <TOKEN>" \
  -H "x-workspace-id: <WORKSPACE_ID>" \
  "https://api.example.com/notifications/members/<MEMBER_ID>/stream"
```

SSE events and payloads

- `notifications:init` — initial payload (array)
  - Sent using the full DB notification objects enriched with `taskId`/`taskName`/`commentName`.
  - Includes DB fields such as `userId`, `readAt`, and `isCommented`.

Example `notifications:init` payload (single item):

```json
[
  {
    "id": "7a8dbf8a-1cfe-4d9f-8a2b-1234567890ab",
    "userId": "user-111",
    "type": "task:assigned",
    "title": "You were assigned to a task",
    "message": "Assigned to task Build landing page",
    "referenceType": "task",
    "referenceId": "task-42",
    "taskId": "task-42",
    "taskName": "Build landing page",
    "commentId": null,
    "commentName": null,
    "actorId": "user-222",
    "isCommented": false,
    "isRead": false,
    "readAt": null,
    "isCleared": false,
    "isSnoozed": false,
    "snoozedAt": null,
    "createdAt": "2026-04-27T12:00:00.000Z"
  }
]
```

- `notification:created` — created event (single object)
  - Sent when a new active notification is created for the connected member.
  - Payload is produced by `toNotificationPayload()` and is a compact representation — it intentionally omits `userId` and low-level `readAt` DB fields.
  - For comment notifications it includes `commentId`/`commentName` and reply metadata (`replyCommentId`/`repliedToCommentId`).

Example `notification:created` payload:

```json
{
  "id": "8b2c4f5e-aaa1-4cde-9a33-abcdef123456",
  "type": "comment:created",
  "title": "New comment on assigned task",
  "message": "Looks good to me!",
  "referenceType": "comment",
  "referenceId": "comment-77",
  "taskId": "task-42",
  "taskName": "Build landing page",
  "commentId": "comment-77",
  "commentName": "Looks good to me!",
  "replyCommentId": "comment-77",
  "repliedToCommentId": null,
  "actorId": "user-333",
  "isCommented": true,
  "isRead": false,
  "isCleared": false,
  "isSnoozed": false,
  "snoozedAt": null,
  "createdAt": "2026-04-27T12:10:00.000Z"
}
```

- `notification:updated` — state change (single object)
  - Sent when a notification's read/clear/snooze state changes. Payload is the same compact shape as `notification:created`.

Example `notification:updated` payload:

```json
{
  "id": "8b2c4f5e-aaa1-4cde-9a33-abcdef123456",
  "type": "comment:created",
  "title": "New comment on assigned task",
  "message": "Looks good to me!",
  "referenceType": "comment",
  "referenceId": "comment-77",
  "taskId": "task-42",
  "taskName": "Build landing page",
  "commentId": "comment-77",
  "commentName": "Looks good to me!",
  "replyCommentId": "comment-77",
  "repliedToCommentId": null,
  "actorId": "user-333",
  "isCommented": true,
  "isRead": true,
  "isCleared": false,
  "isSnoozed": false,
  "snoozedAt": null,
  "createdAt": "2026-04-27T12:10:00.000Z"
}
```

Note: Clients should treat `notifications:init` as the canonical initial list and then apply `notification:created` and `notification:updated` events incrementally.

---

## Field reference (common response fields)

HTTP list/state responses and `notifications:init` typically include:

- `id`
- `userId`
- `type`
- `title`
- `message`
- `referenceType`
- `referenceId`
- `taskId`
- `taskName`
- `commentId`
- `commentName`
- `actorId`
- `isCommented`
- `isRead`
- `readAt`
- `isCleared`
- `isSnoozed`
- `snoozedAt`
- `createdAt`

SSE `notification:created` and `notification:updated` payloads include the same core fields, but:

- they omit `userId` and `readAt`
- they add `replyCommentId` and `repliedToCommentId` when the reference is a comment

## 2) HTTP State APIs (requests + responses)

All state APIs return the updated notification object (enriched with `taskId`/`taskName`/`commentName` and `isCommented`) on success. Example responses below reflect the runtime shape returned by the API (these responses include `userId` and `readAt` when present).

Common headers for these examples:

- `Authorization: Bearer <TOKEN>`
- `x-workspace-id: <WORKSPACE_ID>`

### PATCH /notifications/:id/clear

Description: mark a notification as cleared (archived) or un-cleared.

Request (cURL):

```bash
curl -X PATCH "https://api.example.com/notifications/8b2c4f5e-aaa1-4cde-9a33-abcdef123456/clear" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "x-workspace-id: <WORKSPACE_ID>" \
  -H "Content-Type: application/json" \
  -d '{"isCleared": true}'
```

Body schema:

```json
{ "isCleared": true }
```

Success response (200 OK):

```json
{
  "id": "8b2c4f5e-aaa1-4cde-9a33-abcdef123456",
  "userId": "user-111",
  "type": "comment:created",
  "title": "New comment on assigned task",
  "message": "Looks good to me!",
  "referenceType": "comment",
  "referenceId": "comment-77",
  "taskId": "task-42",
  "taskName": "Build landing page",
  "commentId": "comment-77",
  "commentName": "Looks good to me!",
  "actorId": "user-333",
  "isCommented": true,
  "isRead": false,
  "readAt": null,
  "isCleared": true,
  "isSnoozed": false,
  "snoozedAt": null,
  "createdAt": "2026-04-27T12:10:00.000Z"
}
```

Notes
- `isCleared=true` will also unset `isSnoozed` and `isRead` (and clear their timestamps).

### PATCH /notifications/:id/snooze

Description: snooze (temporarily hide) a notification, optionally until a specific datetime.

Request (cURL):

```bash
curl -X PATCH "https://api.example.com/notifications/8b2c4f5e-aaa1-4cde-9a33-abcdef123456/snooze" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "x-workspace-id: <WORKSPACE_ID>" \
  -H "Content-Type: application/json" \
  -d '{"isSnoozed": true, "snoozeUntil": "2026-04-27T13:10:00.000Z"}'
```

Body schema:

```json
{ "isSnoozed": true, "snoozeUntil": "2026-04-27T13:10:00.000Z" }
```

Success response (200 OK):

```json
{
  "id": "8b2c4f5e-aaa1-4cde-9a33-abcdef123456",
  "userId": "user-111",
  "type": "comment:created",
  "title": "New comment on assigned task",
  "message": "Looks good to me!",
  "referenceType": "comment",
  "referenceId": "comment-77",
  "taskId": "task-42",
  "taskName": "Build landing page",
  "commentId": "comment-77",
  "commentName": "Looks good to me!",
  "actorId": "user-333",
  "isCommented": true,
  "isRead": false,
  "readAt": null,
  "isCleared": false,
  "isSnoozed": true,
  "snoozedAt": "2026-04-27T13:10:00.000Z",
  "createdAt": "2026-04-27T12:10:00.000Z"
}
```

Notes
- `snoozeUntil` must be a valid ISO datetime in the future.
- If `isSnoozed=false`, `snoozeUntil` MUST NOT be provided.

### PATCH /notifications/:id/read

Description: mark a notification read or unread.

Request (cURL):

```bash
curl -X PATCH "https://api.example.com/notifications/8b2c4f5e-aaa1-4cde-9a33-abcdef123456/read" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "x-workspace-id: <WORKSPACE_ID>" \
  -H "Content-Type: application/json" \
  -d '{"isRead": true}'
```

Body schema:

```json
{ "isRead": true }
```

Success response (200 OK):

```json
{
  "id": "8b2c4f5e-aaa1-4cde-9a33-abcdef123456",
  "userId": "user-111",
  "type": "comment:created",
  "title": "New comment on assigned task",
  "message": "Looks good to me!",
  "referenceType": "comment",
  "referenceId": "comment-77",
  "taskId": "task-42",
  "taskName": "Build landing page",
  "commentId": "comment-77",
  "commentName": "Looks good to me!",
  "actorId": "user-333",
  "isCommented": true,
  "isRead": true,
  "readAt": "2026-04-27T12:15:00.000Z",
  "isCleared": false,
  "isSnoozed": false,
  "snoozedAt": null,
  "createdAt": "2026-04-27T12:10:00.000Z"
}
```

Notes
- `isRead=true` sets `readAt` on the server; `isRead=false` clears it.

---

## 3) HTTP List APIs

### GET /notifications/cleared

Description: return cleared (archived) notifications for the current authenticated member in the workspace.

Request (cURL):

```bash
curl "https://api.example.com/notifications/cleared" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "x-workspace-id: <WORKSPACE_ID>"
```

Success response (200 OK):

```json
[
  {
    "id": "8b2c4f5e-aaa1-4cde-9a33-abcdef123456",
    "userId": "user-111",
    "type": "comment:created",
    "title": "New comment on assigned task",
    "message": "Looks good to me!",
    "referenceType": "comment",
    "referenceId": "comment-77",
    "taskId": "task-42",
    "taskName": "Build landing page",
    "commentId": "comment-77",
    "commentName": "Looks good to me!",
    "actorId": "user-333",
    "isCommented": true,
    "isRead": false,
    "readAt": null,
    "isCleared": true,
    "isSnoozed": false,
    "snoozedAt": null,
    "createdAt": "2026-04-27T12:10:00.000Z"
  }
]
```

### GET /notifications/snoozed

Description: return currently snoozed notifications for the current authenticated member. Expired snoozes are unsnoozed before the query.

Request (cURL):

```bash
curl "https://api.example.com/notifications/snoozed" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "x-workspace-id: <WORKSPACE_ID>"
```

Success response (200 OK):

```json
[
  {
    "id": "8b2c4f5e-aaa1-4cde-9a33-abcdef123456",
    "userId": "user-111",
    "type": "comment:created",
    "title": "New comment on assigned task",
    "message": "Looks good to me!",
    "referenceType": "comment",
    "referenceId": "comment-77",
    "taskId": "task-42",
    "taskName": "Build landing page",
    "commentId": "comment-77",
    "commentName": "Looks good to me!",
    "actorId": "user-333",
    "isCommented": true,
    "isRead": false,
    "readAt": null,
    "isCleared": false,
    "isSnoozed": true,
    "snoozedAt": "2026-04-27T13:10:00.000Z",
    "createdAt": "2026-04-27T12:10:00.000Z"
  }
]
```

---

## Error cases (quick reference)

- `400 Bad Request` — invalid or missing boolean fields, invalid `snoozeUntil`, `snoozeUntil` in the past, or `snoozeUntil` provided while `isSnoozed=false`.
- `401 Unauthorized` — missing or invalid JWT.
- `403 Forbidden` — trying to open or modify another user's notifications or member stream.
- `404 Not Found` — notification id or member not found.

---

## Common notification type values

These are examples — `type` is not a strict enum. Treat it as an opaque key in the client.

- `task:assigned`
- `task:updated`
- `comment:created`
- `comment_added`
- `mentioned`
- `reaction:created`
- `reaction:updated`
- `reaction:deleted`

Use `taskId` to open the related task. Use `referenceType`/`referenceId` to reference the exact triggering entity.

---

## Client examples (short)

Browser EventSource (cookie auth):

```js
const es = new EventSource(`/notifications/members/${memberId}/stream`, { withCredentials: true });
es.addEventListener('notifications:init', e => handleInit(JSON.parse(e.data)));
es.addEventListener('notification:created', e => handleCreated(JSON.parse(e.data)));
es.addEventListener('notification:updated', e => handleUpdated(JSON.parse(e.data)));
```

When using bearer tokens from the browser, use `fetch()` and parse SSE lines manually (see previous example in repo codebase for a robust parser).

---

## Backend code pointers

- SSE service: [apps/api/src/notifications/sse.service.ts](../apps/api/src/notifications/sse.service.ts)
- Controller: [apps/api/src/notifications/notifications.controller.ts](../apps/api/src/notifications/notifications.controller.ts)
- Service: [apps/api/src/notifications/notifications.service.ts](../apps/api/src/notifications/notifications.service.ts)
- DTOs: [apps/api/src/notifications/dto](../apps/api/src/notifications/dto/)

If you want, I can also:

- add concrete curl examples with real sample IDs and tokens in a separate `examples/` folder,
- or generate TypeScript client helper functions that wrap these endpoints.

