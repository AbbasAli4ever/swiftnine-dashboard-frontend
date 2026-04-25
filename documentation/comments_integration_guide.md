# Comments Feature — Frontend Integration Guide

The comments system uses a **hybrid SSE + REST** pattern:

- **SSE stream** — open once when the task panel mounts; receives real-time pushes for every comment/reaction event.
- **REST endpoints** — fire-and-forget mutations (create, edit, delete, react). The SSE stream delivers the confirmed state back; no need to wait on the REST response to update the UI.

---

## Required Headers (all endpoints)

| Header | Value |
|---|---|
| `Authorization` | `Bearer <jwt_token>` |
| `x-workspace-id` | Active workspace UUID |

---

## 1. Open the SSE Stream

Open this connection when the task side panel mounts. Keep it alive until the panel closes.

```
GET /api/v1/tasks/:taskId/comments/stream
```

### On connection open

The server immediately fires a `comments:init` event with the full comment list for the task. Use this to populate the initial UI state.

```
event: comments:init
data: [ ...array of comment objects... ]
```

### Heartbeat

Every 15 seconds the server sends a keep-alive line:
```
:heartbeat
```
Ignore it — it just prevents proxy timeouts.

### SSE Events Reference

| Event | Payload | When |
|---|---|---|
| `comments:init` | `Comment[]` | Immediately on connection — full current state |
| `comment:created` | `Comment` | A new comment was posted |
| `comment:updated` | `Comment` | A comment was edited |
| `comment:deleted` | `{ id: string, deletedIds: string[] }` | A comment (and its thread) was deleted |
| `reaction:created` | `Reaction` | A reaction was added |
| `reaction:updated` | `Reaction` | A reaction emoji was changed |
| `reaction:deleted` | `{ id: string, commentId: string }` | A reaction was removed |

### Connecting (browser)

```ts
const es = new EventSource(
  `/api/v1/tasks/${taskId}/comments/stream`,
  { withCredentials: true } // if using cookie auth
);

// Add the workspace header via a custom fetch wrapper if your SSE client supports it.
// For plain EventSource, pass the token as a query param or use a polyfill that supports headers.

es.addEventListener('comments:init', (e) => {
  const comments = JSON.parse(e.data);
  setComments(comments);
});

es.addEventListener('comment:created', (e) => {
  const comment = JSON.parse(e.data);
  setComments((prev) => [...prev, comment]);
});

es.addEventListener('comment:updated', (e) => {
  const comment = JSON.parse(e.data);
  setComments((prev) => prev.map((c) => c.id === comment.id ? comment : c));
});

es.addEventListener('comment:deleted', (e) => {
  const { deletedIds } = JSON.parse(e.data);
  setComments((prev) => prev.filter((c) => !deletedIds.includes(c.id)));
});

es.addEventListener('reaction:created', (e) => {
  const reaction = JSON.parse(e.data);
  setComments((prev) => prev.map((c) =>
    c.id === reaction.commentId
      ? { ...c, reactions: [...c.reactions, reaction] }
      : c
  ));
});

es.addEventListener('reaction:updated', (e) => {
  const reaction = JSON.parse(e.data);
  setComments((prev) => prev.map((c) => ({
    ...c,
    reactions: c.reactions.map((r) => r.id === reaction.id ? reaction : r),
  })));
});

es.addEventListener('reaction:deleted', (e) => {
  const { id, commentId } = JSON.parse(e.data);
  setComments((prev) => prev.map((c) =>
    c.id === commentId
      ? { ...c, reactions: c.reactions.filter((r) => r.id !== id) }
      : c
  ));
});

// Close when panel unmounts
// es.close();
```

> **Note:** Plain `EventSource` does not support custom headers. Options:
> - Pass the JWT as a `?token=` query param (backend must support it) or
> - Use a polyfill like [`@microsoft/fetch-event-source`](https://github.com/Azure/fetch-event-source) which uses `fetch` and supports headers.

---

## 2. Comment Shape

All comment endpoints return objects in this shape:

```json
{
  "id": "a1b2c3d4-...",
  "taskId": "5efb9b46-...",
  "parentId": null,
  "content": "Looks good to me!",
  "isEdited": false,
  "createdAt": "2026-04-25T10:00:00.000Z",
  "updatedAt": "2026-04-25T10:00:00.000Z",
  "deletedAt": null,
  "author": {
    "id": "3f6c6c5e-...",
    "fullName": "Ayesha Khan",
    "avatarUrl": "https://cdn.example.com/avatar.png"
  },
  "reactions": [
    {
      "id": "r1r2r3-...",
      "reactFace": "👍",
      "createdAt": "2026-04-25T10:05:00.000Z",
      "member": {
        "id": "m1m2m3-...",
        "userId": "3f6c6c5e-...",
        "role": "MEMBER",
        "user": {
          "id": "3f6c6c5e-...",
          "fullName": "Ayesha Khan",
          "avatarUrl": "https://cdn.example.com/avatar.png"
        }
      }
    }
  ],
  "mentions": [
    {
      "id": "mn1-...",
      "mentionedUserId": "57a817db-...",
      "mentionedUser": {
        "id": "57a817db-...",
        "fullName": "Bilal Raza",
        "avatarUrl": null,
        "email": "bilal@example.com"
      }
    }
  ]
}
```

---

## 3. REST Endpoints

### POST `/api/v1/tasks/:taskId/comments` — Create Comment

**Request body:**

```json
{
  "content": "Looks good to me!",
  "parentId": "optional-parent-comment-uuid",
  "mentionedUserIds": ["user-uuid-1", "user-uuid-2"]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `content` | string | Yes | 1–10,000 chars |
| `parentId` | UUID | No | Omit for top-level; set to parent comment `id` for a reply |
| `mentionedUserIds` | UUID[] | No | User IDs (not member IDs) of workspace members to mention. Max 100. All must be active workspace members |

**Response:** `201` — full `Comment` object (same as SSE payload).

> The SSE stream also fires `comment:created` — use that to update state, not the REST response, to avoid double-rendering.

---

### PUT `/api/v1/comments/:commentId` — Edit Comment

**Constraint:** Only the comment author can edit. Editing is only allowed **within 5 minutes** of creation — after that the endpoint returns `403`.

**Request body:**

```json
{
  "content": "Updated content here",
  "mentionedUserIds": ["user-uuid-1"]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `content` | string | Yes | 1–10,000 chars |
| `mentionedUserIds` | UUID[] | No | When provided, **replaces** all existing mentions. When omitted, existing mentions are preserved |

**Response:** `200` — updated `Comment` object. `isEdited` will be `true`.

---

### DELETE `/api/v1/comments/:commentId` — Delete Comment

No request body.

**Who can delete:**
- The comment author (any time)
- A workspace `OWNER` (any comment)

**Cascade:** Deleting a parent comment also soft-deletes its entire reply thread. The SSE `comment:deleted` payload includes `deletedIds` — an array of all affected comment IDs.

**Response:** `200 — { success: true, data: null, message: "Comment deleted" }`

---

### POST `/api/v1/comments/:commentId/reactions` — Add Reaction

**Request body:**

```json
{
  "reactFace": "👍"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `reactFace` | string | Yes | Emoji or short name, max 64 chars. Idempotent — if the same user adds the same emoji again, the existing reaction is returned without creating a duplicate |

**Response:** `201` — `Reaction` object.

---

### PATCH `/api/v1/reactions/:reactionId` — Update Reaction

Change the emoji on an existing reaction. Only the reaction owner can do this.

**URL param:**

| Param | Type | Description |
|---|---|---|
| `reactionId` | UUID | ID of the reaction to update |

**Request body:**

```json
{
  "reactFace": "❤️"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `reactFace` | string | Yes | New emoji or short name, max 64 chars |

**Response:** `200`

```json
{
  "success": true,
  "message": "Reaction updated",
  "data": {
    "id": "r1r2r3d4-b89e-4988-9b51-2f6a184c2eba",
    "commentId": "a1b2c3d4-6db7-4203-8391-e82ad3f6ed22",
    "memberId": "m1m2m3m4-3fa6-4c8f-8ec6-f8b8561a9757",
    "reactFace": "❤️",
    "createdAt": "2026-04-25T10:05:00.000Z",
    "member": {
      "id": "m1m2m3m4-3fa6-4c8f-8ec6-f8b8561a9757",
      "workspaceId": "ws-uuid-...",
      "userId": "3f6c6c5e-4a8f-4f55-8f49-f6e2d15e7f24",
      "role": "MEMBER",
      "createdAt": "2026-01-10T08:00:00.000Z",
      "updatedAt": "2026-04-25T10:05:00.000Z",
      "deletedAt": null
    }
  }
}
```

**Response field notes:**

| Field | Type | Notes |
|---|---|---|
| `data.id` | UUID | Reaction ID |
| `data.commentId` | UUID | Comment this reaction belongs to |
| `data.memberId` | UUID | Workspace member ID of the reactor |
| `data.reactFace` | string | The updated emoji/name |
| `data.createdAt` | ISO datetime | Original creation time (unchanged on update) |
| `data.member` | object | Full `WorkspaceMember` row — use `member.userId` to check if the current user owns this reaction |
| `data.member.role` | `"OWNER"` \| `"ADMIN"` \| `"MEMBER"` \| `"GUEST"` | Reactor's workspace role |

> **Note:** The `reaction:updated` SSE event fires with the same `data` object. Use that to update your local state rather than the REST response to keep things consistent across tabs.

**Errors:**

| Status | Reason |
|---|---|
| `400` | `reactFace` is empty or exceeds 64 chars |
| `403` | Requester is not the reaction owner |
| `404` | Reaction not found |

---

### DELETE `/api/v1/reactions/:reactionId` — Delete Reaction

No request body. Only the reaction owner can delete their reaction.

**Response:** `200 — { success: true, data: null, message: "Reaction deleted" }`

---

## 4. Threading Model

Comments support one level of nesting (replies to top-level comments).

- Top-level comments have `parentId: null`.
- Replies have `parentId` set to the top-level comment's `id`.
- The API does **not** nest replies inside parent objects — the flat array from `comments:init` includes both. Group them client-side by `parentId`.

```ts
const topLevel = comments.filter((c) => c.parentId === null);
const replies = (parentId: string) => comments.filter((c) => c.parentId === parentId);
```

---

## 5. Mentions

When creating or editing a comment, pass `mentionedUserIds` as an array of **user IDs** (not workspace member IDs). All IDs must belong to active workspace members or the request returns `400`.

The author cannot mention themselves — self-mentions are silently dropped server-side.

Mentioned users receive an in-app notification (`type: "mentioned"`).

---

## 6. Error Reference

| Status | Scenario |
|---|---|
| `400` | Invalid body, parent comment not found, mentioned user not a workspace member |
| `403` | Editing after 5-minute window, editing/deleting someone else's comment (non-owner), deleting someone else's reaction |
| `404` | Comment or reaction not found in this workspace |

---

## 7. Recommended Integration Flow

```
Panel mounts
  └─ Open SSE stream → receive comments:init → render comment list

User submits comment
  └─ POST /tasks/:taskId/comments (optimistic add optional)
  └─ SSE comment:created fires → update state from SSE payload

User edits comment (within 5 min)
  └─ PUT /comments/:commentId
  └─ SSE comment:updated fires → update state

User deletes comment
  └─ DELETE /comments/:commentId
  └─ SSE comment:deleted fires → remove all deletedIds from state

User reacts
  └─ POST /comments/:commentId/reactions
  └─ SSE reaction:created fires → append to comment's reactions

User changes emoji
  └─ PATCH /reactions/:reactionId
  └─ SSE reaction:updated fires → replace in comment's reactions

User removes reaction
  └─ DELETE /reactions/:reactionId
  └─ SSE reaction:deleted fires → remove from comment's reactions

Panel unmounts
  └─ es.close()
```
