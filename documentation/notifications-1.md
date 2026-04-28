# Notifications API

Purpose: frontend integration reference for the notification subscription stream, SSE payloads, and notification state APIs.

All endpoints below are protected by `JwtAuthGuard` and `WorkspaceGuard`.

Required headers:

- `Authorization: Bearer <ACCESS_TOKEN>`
- `x-workspace-id: <WORKSPACE_ID>`

Note for browsers: native `EventSource` cannot send custom `Authorization` headers. Use cookie-based auth with `withCredentials`, a frontend proxy that injects the header, or `fetch()` with manual SSE parsing.

## Notification subscription API

Use this endpoint to subscribe the current user to live notification updates for a workspace member.

### `GET /notifications/members/:memberId/stream`

Opens a Server-Sent Events stream for one workspace member.

Path params:

- `memberId` (string, required): workspace member id. The backend also accepts the user's id and resolves it to the member in the current workspace.

Headers:

- `Authorization: Bearer <ACCESS_TOKEN>`
- `x-workspace-id: <WORKSPACE_ID>`

Authorization rules:

- The member must exist in the workspace from `x-workspace-id`.
- The resolved member's `userId` must match the authenticated user.
- Opening another user's notification stream returns `403 Forbidden`.

Return:

- HTTP response content type is `text/event-stream`.
- The connection stays open and sends SSE frames.
- The first event is always `notifications:init` with the current active notification list.
- Later events are sent as notifications are created or updated.
- Heartbeat comments are sent every 15 seconds as `:heartbeat`.

cURL example:

```bash
curl -N \
  -H "Authorization: Bearer <TOKEN>" \
  -H "x-workspace-id: <WORKSPACE_ID>" \
  "https://api.example.com/notifications/members/<MEMBER_ID>/stream"
```

## SSE events

### `notifications:init`

Sent immediately after the stream opens.

Payload:

- Array of full Prisma `Notification` records.
- Ordered by `createdAt` descending.
- Limited to 200 items.
- Only includes notifications where `isCleared=false` and `isSnoozed=false`.
- Expired snoozes are unsnoozed before the list is loaded.

Example:

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
    "actorId": "user-222",
    "isRead": false,
    "readAt": null,
    "isCleared": false,
    "isSnoozed": false,
    "snoozedAt": null,
    "createdAt": "2026-04-27T12:00:00.000Z"
  }
]
```

### `notification:created`

Sent when the backend creates a new active notification for the connected member.

Payload:

- Single compact notification object.
- Omits DB-only fields such as `userId` and `readAt`.
- Not sent for notifications that are created already cleared or snoozed.
- Also used when a snoozed notification expires and becomes active again.

Example:

```json
{
  "id": "8b2c4f5e-aaa1-4cde-9a33-abcdef123456",
  "type": "comment:created",
  "title": "New comment on assigned task",
  "message": "Looks good to me!",
  "referenceType": "comment",
  "referenceId": "comment-77",
  "taskId": "task-42",
  "actorId": "user-333",
  "isRead": false,
  "isCleared": false,
  "isSnoozed": false,
  "snoozedAt": null,
  "createdAt": "2026-04-27T12:10:00.000Z"
}
```

### `notification:updated`

Sent after a notification's read, clear, or snooze state changes.

Payload:

- Single compact notification object.
- Clients should update the matching notification by `id`.
- If `isCleared=true` or `isSnoozed=true`, remove it from the active notification list.
- If `isRead` changes, keep it in the active list and update its read styling.

Example:

```json
{
  "id": "8b2c4f5e-aaa1-4cde-9a33-abcdef123456",
  "type": "comment:created",
  "title": "New comment on assigned task",
  "message": "Looks good to me!",
  "referenceType": "comment",
  "referenceId": "comment-77",
  "taskId": "task-42",
  "actorId": "user-333",
  "isRead": true,
  "isCleared": false,
  "isSnoozed": false,
  "snoozedAt": null,
  "createdAt": "2026-04-27T12:10:00.000Z"
}
```

### Heartbeat comments

Sent every 15 seconds to keep the connection alive.

Payload:

- SSE comment line: `:heartbeat`
- No JSON data.
- Clients should ignore these lines.

## Notification object fields

Full DB notification records can contain:

- `id` (string): notification id.
- `userId` (string): recipient user id. Present in `notifications:init` and list API responses.
- `type` (string): notification type key, such as `task:assigned` or `comment:created`.
- `title` (string): short UI title.
- `message` (string | null): optional body text.
- `referenceType` (string): related entity kind, for example `task` or `comment`.
- `referenceId` (string): related entity id.
- `taskId` (string | null): task id related to the notification. If `referenceType=task`, this matches `referenceId`; if `referenceType=comment`, the backend resolves it from the comment.
- `actorId` (string | null): user id that triggered the notification.
- `isRead` (boolean): read state.
- `readAt` (string | null): ISO datetime when the notification was marked read.
- `isCleared` (boolean): archived/cleared state.
- `isSnoozed` (boolean): snooze state.
- `snoozedAt` (string | null): ISO datetime when the snooze expires. `null` means no expiry when `isSnoozed=true`.
- `createdAt` (string): ISO datetime when created.

Compact SSE update payloads contain:

- `id`
- `type`
- `title`
- `message`
- `referenceType`
- `referenceId`
- `taskId`
- `actorId`
- `isRead`
- `isCleared`
- `isSnoozed`
- `snoozedAt`
- `createdAt`

## State update APIs

Each update endpoint returns the updated notification object and emits `notification:updated` to the current member's connected stream.

### `PATCH /notifications/:id/clear`

Clears or un-clears a notification.

Path params:

- `id` (string, required): notification id.

Body:

```json
{
  "isCleared": true
}
```

Body fields:

- `isCleared` (boolean, required): `true` to clear, `false` to un-clear.

Behavior:

- The notification must belong to the authenticated user.
- `isCleared=true` resets other active states: `isSnoozed=false`, `snoozedAt=null`, `isRead=false`, `readAt=null`.
- `isCleared=false` only un-clears the notification.

Returns:

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
  "actorId": "user-333",
  "isRead": false,
  "readAt": null,
  "isCleared": true,
  "isSnoozed": false,
  "snoozedAt": null,
  "createdAt": "2026-04-27T12:10:00.000Z"
}
```

### `PATCH /notifications/:id/snooze`

Snoozes or unsnoozes a notification.

Path params:

- `id` (string, required): notification id.

Body:

```json
{
  "isSnoozed": true,
  "snoozeUntil": "2026-04-27T13:10:00.000Z"
}
```

Body fields:

- `isSnoozed` (boolean, required): `true` to snooze, `false` to unsnooze.
- `snoozeUntil` (string, optional): future ISO datetime. Only allowed when `isSnoozed=true`.

Behavior:

- The notification must belong to the authenticated user.
- `isSnoozed=true` with `snoozeUntil` snoozes until that future datetime.
- `isSnoozed=true` without `snoozeUntil` stays snoozed until manually unsnoozed.
- `isSnoozed=false` unsnoozes immediately and sets `snoozedAt=null`.
- `snoozeUntil` must be a valid future datetime.
- `isSnoozed=true` resets other active states: `isCleared=false`, `isRead=false`, `readAt=null`.
- Expired snoozes are processed by a one-minute watcher and before reading the stream/snoozed list.

Returns:

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
  "actorId": "user-333",
  "isRead": false,
  "readAt": null,
  "isCleared": false,
  "isSnoozed": true,
  "snoozedAt": "2026-04-27T13:10:00.000Z",
  "createdAt": "2026-04-27T12:10:00.000Z"
}
```

### `PATCH /notifications/:id/read`

Marks a notification read or unread.

Path params:

- `id` (string, required): notification id.

Body:

```json
{
  "isRead": true
}
```

Body fields:

- `isRead` (boolean, required): `true` to mark read, `false` to mark unread.

Behavior:

- The notification must belong to the authenticated user.
- `isRead=true` sets `readAt` to the current server time.
- `isRead=false` sets `readAt=null`.
- `isRead=true` resets other active states: `isCleared=false`, `isSnoozed=false`, `snoozedAt=null`.

Returns:

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
  "actorId": "user-333",
  "isRead": true,
  "readAt": "2026-04-27T12:15:00.000Z",
  "isCleared": false,
  "isSnoozed": false,
  "snoozedAt": null,
  "createdAt": "2026-04-27T12:10:00.000Z"
}
```

## List APIs

### `GET /notifications/cleared`

Returns cleared notifications for the current user in the current workspace context.

Body:

- None.

Returns:

- Array of notification objects.
- Ordered by `createdAt` descending.
- Limited to 500 items.
- Only includes notifications where `isCleared=true`.

Example:

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
    "actorId": "user-333",
    "isRead": false,
    "readAt": null,
    "isCleared": true,
    "isSnoozed": false,
    "snoozedAt": null,
    "createdAt": "2026-04-27T12:10:00.000Z"
  }
]
```

### `GET /notifications/snoozed`

Returns currently snoozed notifications for the current user in the current workspace context.

Body:

- None.

Behavior:

- Expired snoozes are automatically unsnoozed before results are returned.

Returns:

- Array of notification objects.
- Ordered by `snoozedAt` ascending.
- Limited to 500 items.
- Only includes notifications where `isSnoozed=true`.

Example:

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
    "actorId": "user-333",
    "isRead": false,
    "readAt": null,
    "isCleared": false,
    "isSnoozed": true,
    "snoozedAt": "2026-04-27T13:10:00.000Z",
    "createdAt": "2026-04-27T12:10:00.000Z"
  }
]
```

## Common notification type values

These values are examples found in backend code. They are not enforced enums, so clients should treat `type` as an opaque key.

- `task:assigned`: user was assigned to a task.
- `task:updated`: assigned task was updated.
- `comment:created`: new comment on a task assigned to the recipient.
- `comment_added`: new comment notification for the task creator.
- `mentioned`: user was mentioned in a comment.
- `reaction:created`: new reaction on a comment or task.
- `reaction:updated`: reaction was changed.
- `reaction:deleted`: reaction was removed.

Use `taskId` to open the related task directly. Use `referenceType` and `referenceId` when you need the exact triggering entity, such as a comment.

## Client examples

### Browser `EventSource` with cookie auth

```js
const memberId = '<WORKSPACE_MEMBER_ID_OR_USER_ID>';
const es = new EventSource(`/notifications/members/${memberId}/stream`, {
  withCredentials: true,
});

es.addEventListener('notifications:init', (event) => {
  const notifications = JSON.parse(event.data);
  handleInit(notifications);
});

es.addEventListener('notification:created', (event) => {
  const notification = JSON.parse(event.data);
  handleCreated(notification);
});

es.addEventListener('notification:updated', (event) => {
  const notification = JSON.parse(event.data);
  handleUpdated(notification);
});

es.addEventListener('error', (error) => {
  console.error('Notification stream error', error);
});
```

### Browser `fetch` with bearer token

```js
async function connectNotificationStream(memberId, token, workspaceId) {
  const res = await fetch(`/notifications/members/${memberId}/stream`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-workspace-id': workspaceId,
    },
  });

  if (!res.ok) {
    throw new Error('Failed to open notification stream');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  function parseSseEvent(raw) {
    if (!raw.trim() || raw.startsWith(':')) return null;

    let event = 'message';
    let data = '';

    for (const line of raw.split(/\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      if (line.startsWith('data:')) data += line.slice(5);
    }

    if (!data) return null;
    return { event, data: JSON.parse(data) };
  }

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let index;
    while ((index = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);

      const event = parseSseEvent(raw);
      if (!event) continue;

      if (event.event === 'notifications:init') handleInit(event.data);
      if (event.event === 'notification:created') handleCreated(event.data);
      if (event.event === 'notification:updated') handleUpdated(event.data);
    }
  }
}
```

## Error cases

Common errors:

- `400 Bad Request`: required boolean body field is missing or invalid, `snoozeUntil` is invalid, `snoozeUntil` is in the past, or `snoozeUntil` was sent while `isSnoozed=false`.
- `401 Unauthorized`: missing or invalid JWT.
- `403 Forbidden`: authenticated user tried to open or modify another user's notification.
- `404 Not Found`: member or notification was not found.

## Backend code pointers

- SSE service: [apps/api/src/notifications/sse.service.ts](../apps/api/src/notifications/sse.service.ts)
- Notifications controller: [apps/api/src/notifications/notifications.controller.ts](../apps/api/src/notifications/notifications.controller.ts)
- Notifications service: [apps/api/src/notifications/notifications.service.ts](../apps/api/src/notifications/notifications.service.ts)
- Notification response DTO: [apps/api/src/notifications/dto/notification-response.dto.ts](../apps/api/src/notifications/dto/notification-response.dto.ts)
- Clear DTO: [apps/api/src/notifications/dto/patch-notification-clear.dto.ts](../apps/api/src/notifications/dto/patch-notification-clear.dto.ts)
- Snooze DTO: [apps/api/src/notifications/dto/patch-notification-snooze.dto.ts](../apps/api/src/notifications/dto/patch-notification-snooze.dto.ts)
- Read DTO: [apps/api/src/notifications/dto/patch-notification-read.dto.ts](../apps/api/src/notifications/dto/patch-notification-read.dto.ts)
