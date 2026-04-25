# Comments API

Summary
- Authentication: `Authorization: Bearer <token>` (JWT)
- Required header: `x-workspace-id` (workspace scope)
- All successful responses use the envelope: `{ success: true, data, message }`

Endpoints

**GET /tasks/:taskId/comments/stream**
- Purpose: Open an SSE stream for task comments and reactions.
- Headers: `Authorization`, `x-workspace-id`
- SSE events emitted:
  - `comments:init` — payload: `Comment[]` (initial full list)
  - `comment:created` — payload: `Comment` (new comment)
  - `comment:updated` — payload: `Comment` (updated comment)
  - `comment:deleted` — payload: `{ id: string }` (deleted comment id)
  - `reaction:created` — payload: `Reaction` (new reaction — created endpoint includes `member` object)
  - `reaction:deleted` — payload: `{ id: string, commentId: string }`

Notes: `comments:init`, `comment:created`, and `comment:updated` use the same `Comment` shape defined below. `reaction:created` from SSE may include a `member` object when broadcast from the create endpoint.

**POST /tasks/:taskId/comments**
- Purpose: Create a comment on a task
- Headers: `Authorization`, `x-workspace-id`
- Request body (JSON):
  - `content` (string) — required, min 1, max 10000
  - `parentId` (string, uuid) — optional, used to create threaded replies
  - `mentions` (string[]) — optional, array of workspace member ids or user ids (uuid)

- Response: 201
  - Envelope: `{ success: true, data: Comment, message: 'Comment created' }`

**PUT /comments/:commentId**
- Purpose: Update a comment
- Headers: `Authorization`, `x-workspace-id`
- Request body (JSON):
  - `content` (string) — required, min 1, max 10000
- Constraints: Only the comment author may edit; edits are allowed only within 5 minutes of creation.
- Response: 200
  - Envelope: `{ success: true, data: Comment, message: 'Comment updated' }`

**DELETE /comments/:commentId**
- Purpose: Soft-delete a comment
- Headers: `Authorization`, `x-workspace-id`
- Authorization: Author or workspace `OWNER` can delete
- Response: 200
  - Envelope: `{ success: true, data: null, message: 'Comment deleted' }`

**POST /comments/:commentId/reactions**
- Purpose: Add a reaction to a comment
- Headers: `Authorization`, `x-workspace-id`
- Request body (JSON):
  - `reactFace` (string) — required (emoji key or name, min length 1)
- Response: 201
  - Envelope: `{ success: true, data: ReactionWithMember, message: 'Reaction created' }`

**DELETE /reactions/:reactionId**
- Purpose: Delete a reaction
- Headers: `Authorization`, `x-workspace-id`
- Authorization: Only the reaction owner may delete their reaction
- Response: 200
  - Envelope: `{ success: true, data: null, message: 'Reaction deleted' }`

Data Shapes (what is returned)

**Envelope**
All successful responses return:
```
{ "success": true, "data": <payload>, "message": <string|null> }
```

**Comment** (returned in create, update, SSE `comments:init`, `comment:created`, `comment:updated`)
- `id` (string, uuid) — REQUIRED
- `taskId` (string, uuid) — REQUIRED
- `userId` (string, uuid) — REQUIRED (author id)
- `parentId` (string|null) — OPTIONAL (null if top-level)
- `content` (string) — REQUIRED
- `isEdited` (boolean) — REQUIRED (false if never edited)
- `createdAt` (string, ISO datetime) — REQUIRED
- `updatedAt` (string, ISO datetime) — REQUIRED
- `deletedAt` (string|null) — OPTIONAL (set when soft-deleted)
- `author` (object) — INCLUDED
  - `id` (string) — REQUIRED
  - `fullName` (string) — REQUIRED
  - `avatarUrl` (string|null) — OPTIONAL
- `reactions` (array of `Reaction`) — INCLUDED (may be empty)

Notes on `Comment` fields:
- `parentId` and `deletedAt` are nullable — they may be absent or `null` when not applicable.
- `reactions` in the comment list (from `getCommentsForTask` / `comments:init`) contains `Reaction` items with scalar fields only (see Reaction shape). The `create reaction` endpoint returns a `Reaction` that includes the `member` object (see `ReactionWithMember`).

**Reaction** (as included in comment lists / `comments:init`)
- `id` (string, uuid) — REQUIRED
- `commentId` (string, uuid) — REQUIRED
- `memberId` (string, uuid) — REQUIRED (workspace member id)
- `reactFace` (string) — REQUIRED
- `createdAt` (string, ISO datetime) — REQUIRED

**ReactionWithMember** (returned by `POST /comments/:commentId/reactions`)
- All `Reaction` fields above, plus:
- `member` (object) — INCLUDED
  - `id` (string, uuid) — REQUIRED (workspaceMember id)
  - `workspaceId` (string, uuid) — REQUIRED
  - `userId` (string, uuid) — REQUIRED
  - `role` (string) — REQUIRED (`OWNER` | `MEMBER`)
  - `createdAt` (string, ISO datetime) — REQUIRED
  - `updatedAt` (string, ISO datetime) — REQUIRED
  - `deletedAt` (string|null) — OPTIONAL

Validation rules (summary)
- `content`: string, required, 1..10000 chars
- `parentId`: uuid if provided
- `mentions`: array of uuid if provided (workspace member id or user id)
- `reactFace`: string, required

Behavioral notes (implementation details)
- Mentions: provided ids may be workspace member ids or user ids. The server attempts to resolve a workspace member by id first, then by user id. Unknown mentions are ignored.
- Duplicate mentions are ignored when creating mention records.
- Editing a comment is time-limited (5 minutes) and restricted to the original author.
- Deletion is a soft-delete (sets `deletedAt`) and is allowed for the author or workspace `OWNER`.
- SSE event payloads are JSON-serialized; event names are the ones listed above.

Examples

Create comment request:
```json
{ "content": "Thanks — this looks good.", "mentions": ["workspaceMemberId-or-userId-uuid"], "parentId": "optional-parent-uuid" }
```

Create comment response (trimmed):
```json
{
  "success": true,
  "data": {
    "id": "c1b7...",
    "taskId": "t9a2...",
    "userId": "u12...",
    "parentId": null,
    "content": "Thanks — this looks good.",
    "isEdited": false,
    "createdAt": "2026-04-25T12:34:56.000Z",
    "updatedAt": "2026-04-25T12:34:56.000Z",
    "deletedAt": null,
    "author": { "id": "u12...", "fullName": "Jane Doe", "avatarUrl": null },
    "reactions": []
  },
  "message": "Comment created"
}
```

Add reaction request:
```json
{ "reactFace": "like" }
```

Add reaction response (trimmed):
```json
{
  "success": true,
  "data": {
    "id": "r55...",
    "commentId": "c1b7...",
    "memberId": "m33...",
    "reactFace": "like",
    "createdAt": "2026-04-25T12:40:00.000Z",
    "member": { "id": "m33...", "workspaceId": "w1...", "userId": "u12...", "role": "MEMBER", "createdAt": "...", "updatedAt": "...", "deletedAt": null }
  },
  "message": "Reaction created"
}
```

---

**Per-endpoint response structures (full examples)**

Notes:
- All HTTP responses from the API use the envelope: `{ success: true, data, message }` on success.
- SSE stream events send the raw payload directly (JSON-serialized) — they do NOT use the envelope.

1) SSE stream — `GET /tasks/:taskId/comments/stream`
- Transport: Server-Sent Events (text/event-stream).
- The server emits events with an `event` name and `data` containing the raw JSON payload.
- Example initial event (raw payload is an array of `Comment` objects):

Event frame (example):
```
event: comments:init
data: [{
  "id": "c1b7...",
  "taskId": "t9a2...",
  "userId": "u12...",
  "parentId": null,
  "content": "Thanks — this looks good.",
  "isEdited": false,
  "createdAt": "2026-04-25T12:34:56.000Z",
  "updatedAt": "2026-04-25T12:34:56.000Z",
  "deletedAt": null,
  "author": { "id": "u12...", "fullName": "Jane Doe", "avatarUrl": null },
  "reactions": [ { "id": "r55...", "commentId": "c1b7...", "memberId": "m33...", "reactFace": "like", "createdAt": "2026-04-25T12:40:00.000Z" } ]
}]
```

Other SSE events use the same raw payload shapes:
- `event: comment:created` with `data: Comment`
- `event: comment:updated` with `data: Comment`
- `event: comment:deleted` with `data: { id: string }`
- `event: reaction:created` with `data: Reaction` (may include `member` nested object when created)
- `event: reaction:deleted` with `data: { id: string, commentId: string }`

2) Create comment — `POST /tasks/:taskId/comments` (201)
- HTTP response (enveloped):

```json
{
  "success": true,
  "data": {
    "id": "c1b7...",
    "taskId": "t9a2...",
    "userId": "u12...",
    "parentId": null,
    "content": "Thanks — this looks good.",
    "isEdited": false,
    "createdAt": "2026-04-25T12:34:56.000Z",
    "updatedAt": "2026-04-25T12:34:56.000Z",
    "deletedAt": null,
    "author": { "id": "u12...", "fullName": "Jane Doe", "avatarUrl": null },
    "reactions": []
  },
  "message": "Comment created"
}
```

3) Update comment — `PUT /comments/:commentId` (200)
- HTTP response (enveloped). Example after an edit (note `isEdited: true`):

```json
{
  "success": true,
  "data": {
    "id": "c1b7...",
    "taskId": "t9a2...",
    "userId": "u12...",
    "parentId": null,
    "content": "Updated content",
    "isEdited": true,
    "createdAt": "2026-04-25T12:34:56.000Z",
    "updatedAt": "2026-04-25T12:38:00.000Z",
    "deletedAt": null,
    "author": { "id": "u12...", "fullName": "Jane Doe", "avatarUrl": null },
    "reactions": []
  },
  "message": "Comment updated"
}
```

4) Delete comment — `DELETE /comments/:commentId` (200)
- HTTP response (enveloped):

```json
{
  "success": true,
  "data": null,
  "message": "Comment deleted"
}
```

5) Add reaction — `POST /comments/:commentId/reactions` (201)
- HTTP response (enveloped). The created `Reaction` returned by the HTTP endpoint includes the `member` relation nested (workspace member meta):

```json
{
  "success": true,
  "data": {
    "id": "r55...",
    "commentId": "c1b7...",
    "memberId": "m33...",
    "reactFace": "like",
    "createdAt": "2026-04-25T12:40:00.000Z",
    "member": {
      "id": "m33...",
      "workspaceId": "w1...",
      "userId": "u12...",
      "role": "MEMBER",
      "createdAt": "2026-01-01T10:00:00.000Z",
      "updatedAt": "2026-01-01T10:00:00.000Z",
      "deletedAt": null
    }
  },
  "message": "Reaction created"
}
```

6) Delete reaction — `DELETE /reactions/:reactionId` (200)
- HTTP response (enveloped):

```json
{
  "success": true,
  "data": null,
  "message": "Reaction deleted"
}
```

Notes on differences between HTTP responses and SSE payloads:
- HTTP API responses are wrapped in the `{ success, data, message }` envelope.
- SSE messages are sent as raw JSON payloads (arrays or objects) with an `event` name — clients should parse the `data` field as JSON and handle the payload directly.

If you'd like, I can also:
- Add TypeScript interfaces for the documented shapes in `libs/common` or `libs/types`.
- Generate OpenAPI snippets to include in the existing OpenAPI YAML.

