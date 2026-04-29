# Docs Feature — Frontend Integration Guide

> **Audience:** Frontend engineers integrating the real-time documentation feature.
> **Last updated:** 2026-04-29
> **Backend author:** Platform team

---

## Feature Readiness

| Capability | Status | Notes |
|---|---|---|
| Create / Read / Update / Delete docs | ✅ Ready | Full REST API |
| List docs (workspace or project-scoped) | ✅ Ready | |
| Full-text search | ✅ Ready | |
| Real-time autosave (WebSocket) | ✅ Ready | |
| Block-level collaborative locking | ✅ Ready | |
| Presence (who's viewing/editing) | ✅ Ready | |
| Doc file attachments | ✅ Ready | S3 presigned upload |
| Comment threads | ⏳ Phase 5 | Not yet built — stub UI |
| Version history | ⏳ Phase 6 | Not yet built — stub UI |
| Live embedded task cards | ⏳ Phase 7 | Not yet built — stub UI |
| Public share links | ⏳ Phase 8 | Not yet built — stub UI |
| PDF / Markdown export | ⏳ Phase 9 | Not yet built — stub UI |

---

## Authentication

All REST endpoints require a Bearer JWT in the `Authorization` header.

```
Authorization: Bearer <access_token>
```

WebSocket authentication uses the `auth` payload in the Socket.io handshake (browsers cannot set headers on WebSocket connections):

```ts
const socket = io('http://api-host/docs', {
  auth: { token: accessToken },
});
```

---

## REST API

### Base URL

```
http://api-host/docs
```

### Response envelope

Every REST response is wrapped:

```json
{
  "success": true,
  "data": { ... },
  "message": "optional message"
}
```

On error:

```json
{
  "success": false,
  "statusCode": 404,
  "message": "Document not found"
}
```

---

### Doc object shape

```ts
type Doc = {
  id: string;           // UUID
  workspaceId: string;
  projectId: string | null;
  ownerId: string;
  scope: 'WORKSPACE' | 'PROJECT' | 'PERSONAL';
  title: string;
  contentJson: object;  // TipTap JSON document
  plaintext: string;    // stripped text for search snippets
  version: number;      // monotonically increasing integer
  createdAt: string;    // ISO-8601
  updatedAt: string;
  deletedAt: string | null;
};
```

---

### Doc scoping

Every doc belongs to exactly one scope level:

| `scope` | `projectId` | Meaning |
|---|---|---|
| `WORKSPACE` | `null` | Visible to all workspace members |
| `PROJECT` | required UUID | Bound to a specific project |
| `PERSONAL` | `null` | Private to the creator |

Validation rules:
- `scope = PROJECT` without `projectId` → `400`
- `scope = PROJECT` with a `projectId` that doesn't exist in the workspace → `400`
- `scope != PROJECT` with `projectId` provided → `400`

---

### Create doc

```
POST /docs
```

**Request body:**

```json
{
  "title": "Sprint Planning",
  "scope": "PROJECT",
  "workspaceId": "uuid",
  "projectId": "uuid",        // required when scope = PROJECT, null/omit otherwise
  "contentJson": { ... }      // optional, defaults to empty TipTap doc
}
```

- `title` max 256 characters

**Response:** `201 Created` — `data: Doc`

---

### List docs

```
GET /docs?workspaceId=<uuid>&projectId=<uuid>&scope=<scope>
```

Query params:

| Param | Required | Notes |
|---|---|---|
| `workspaceId` | Yes | |
| `projectId` | No | filter to a project |
| `scope` | No | filter by scope |

**Response:** `200 OK` — `data: Doc[]` — sorted newest-updated first.

Only docs the requesting user can view are returned.

---

### Get doc

```
GET /docs/:id
```

**Response:** `200 OK` — `data: Doc`

- `403` if the user has no access
- `404` if doc doesn't exist or is deleted

---

### Update doc

```
PATCH /docs/:id
```

**Request body (all fields optional):**

```json
{
  "title": "New title",
  "contentJson": { ... }
}
```

> **Important:** Prefer the WebSocket `doc:autosave` event for content updates during editing sessions. Use this REST endpoint only for metadata changes (title rename) or one-shot saves outside of a live session. Every `contentJson` write via REST increments `doc.version`.

**Response:** `200 OK` — `data: Doc`

---

### Delete doc

```
DELETE /docs/:id
```

Soft delete — doc is flagged `deletedAt`, not removed from DB.

**Response:** `200 OK`

---

### Search docs

```
GET /docs/search?workspaceId=<uuid>&q=<query>&projectId=<uuid>
```

Uses Postgres full-text search on title + plaintext content.

**Response:**

```ts
type DocSearchResult = {
  id: string;
  title: string;
  scope: string;
  projectId: string | null;
  updatedAt: string;
  snippet: string;    // highlighted excerpt matching the query
  rank: number;       // relevance score (descending)
};
```

---

## Doc Attachments

Flow: presign → upload directly to S3 → record the attachment.

### 1. Get presigned upload URL

```
POST /attachments/presign
```

**Request body:**

```json
{
  "docId": "uuid",
  "fileName": "diagram.png",
  "mimeType": "image/png"
}
```

**Response:**

```json
{
  "data": {
    "uploadUrl": "https://s3.amazonaws.com/...",  // PUT this URL
    "s3Key": "attachments/doc-<docId>/uuid-diagram.png",
    "expiresAt": "2026-04-29T12:00:00Z"
  }
}
```

### 2. Upload to S3

```
PUT <uploadUrl>
Content-Type: image/png
<binary body>
```

No auth header needed — the presigned URL encodes auth.

### 3. Record the attachment

```
POST /attachments/docs
```

**Request body:**

```json
{
  "docId": "uuid",
  "s3Key": "attachments/doc-<docId>/uuid-diagram.png",
  "fileName": "diagram.png",
  "mimeType": "image/png",
  "fileSize": 204800
}
```

**Response:** `200 OK` — `data: Attachment`

### List doc attachments (with view URLs)

```
POST /attachments/docs/view
```

**Request body:**

```json
{ "docId": "uuid" }
```

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "fileName": "diagram.png",
      "mimeType": "image/png",
      "fileSize": 204800,
      "viewUrl": "https://s3.amazonaws.com/...",  // 15-min presigned GET
      "createdAt": "..."
    }
  ]
}
```

### Delete attachment

```
DELETE /attachments/docs
```

**Request body:**

```json
{
  "docId": "uuid",
  "s3Key": "attachments/doc-<docId>/uuid-diagram.png"
}
```

---

## WebSocket — Real-time Editing

Namespace: `/docs`

Connect once per editor page. Join/leave individual doc rooms as the user navigates.

### Setup

```ts
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('http://api-host/docs', {
  auth: { token: accessToken },
  transports: ['websocket'],
});

socket.on('connect', () => console.log('connected', socket.id));
socket.on('connect_error', (err) => console.error('ws error', err.message));

// If auth fails, server emits this then disconnects
socket.on('doc:error', ({ reason }) => {
  console.error('Doc WS auth error:', reason);
});
```

---

### Joining a doc

```ts
socket.emit('doc:join', { docId });

// Immediately after joining, server sends current state:
socket.on('doc:presence-snapshot', ({ users }) => {
  // users: PresenceUser[] — who is in this doc right now
});

socket.on('doc:lock-snapshot', ({ locks }) => {
  // locks: BlockLock[] — which blocks are currently locked by whom
});
```

**PresenceUser shape:**

```ts
type PresenceUser = {
  userId: string;
  name: string;
  email: string;
  socketIds: string[];  // user may have multiple tabs open
  lockedBlockIds: string[];
};
```

**BlockLock shape:**

```ts
type BlockLock = {
  docId: string;
  blockId: string;
  userId: string;
  socketId: string;
  expiresAt: number;   // Unix ms timestamp
};
```

---

### Leaving a doc

```ts
socket.emit('doc:leave', { docId });
```

Also call this when the user navigates away. On disconnect, the server automatically releases all locks and presence for that socket.

---

### Autosave

The editor should autosave the full TipTap JSON document through the WebSocket, not via REST.

**Throttle:** server enforces max 1 save per second per user per doc.

```ts
socket.emit('doc:autosave', {
  docId,
  contentJson: editor.getJSON(),   // full TipTap JSON doc
  baseVersion: currentDocVersion,  // the doc.version you loaded
});
```

**On success:**

```ts
socket.on('doc:saved', ({ docId, doc, changedBlockIds, orphanedThreadCount }) => {
  // doc: Doc — the freshly saved doc with new version number
  // changedBlockIds: string[] — block IDs that changed in this save
  // orphanedThreadCount: number — comment threads that lost their anchor block
  updateLocalDoc(doc);
});
```

This event is also broadcast to **all other users in the same doc room** — so all tabs/users see the update.

**On conflict:**

```ts
socket.on('doc:save-conflict', ({ conflictBlockIds, reason }) => {
  // conflictBlockIds: string[] — blocks that caused the conflict
  // reason: string — human-readable explanation:
  //   'Autosave throttled'
  //   'Client base version is ahead of the server'
  //   'Base version is no longer available'
  //   'Stale save overlaps with server changes'
  //   'Modified blocks must be locked by the saving user'
  handleConflict(conflictBlockIds, reason);
});
```

#### Conflict reasons and what to do

| Reason | Meaning | FE action |
|---|---|---|
| `Autosave throttled` | Fired too fast | Retry after 1s |
| `Stale save overlaps with server changes` | Another user edited the same block | Show conflict UI, reload doc |
| `Modified blocks must be locked by the saving user` | Tried to save a block you don't hold a lock on | Acquire lock first, then re-save |
| `Base version is no longer available` | Server doesn't have the snapshot your base was derived from | Reload doc |

---

### Block Locking

Locking prevents two users from editing the same block simultaneously. Autosave will reject blocks you don't hold a lock on.

**Lock a block (e.g., when user clicks into a block):**

```ts
socket.emit('doc:lock-block', { docId, blockId });
```

**Keep the lock alive (every ~10 seconds while the user is in the block):**

```ts
socket.emit('doc:lock-heartbeat', { docId, blockId });
```

**Locks expire after 30 seconds** without a heartbeat. When a lock expires, the `doc:lock-snapshot` is broadcast to the room.

**Release a lock (when user leaves the block):**

```ts
socket.emit('doc:unlock-block', { docId, blockId });
```

**If the lock is already held by someone else:**

```ts
socket.on('doc:lock-rejected', ({ blockId, ownerUserId, expiresAt }) => {
  // Mark block as read-only until lock expires or owner releases
  markBlockLocked(blockId, ownerUserId, expiresAt);
});
```

**Room-wide lock update (broadcast on every lock change):**

```ts
socket.on('doc:lock-snapshot', ({ locks }) => {
  // Rebuild entire lock state from this snapshot
  // locks: BlockLock[]
  updateLockState(locks);
});
```

---

### Block IDs — Critical requirement

The TipTap editor **must** install the `UniqueID` extension (or equivalent) so every block node has a stable `attrs.id` (UUID). The server uses these IDs for:

- Block-level diff detection
- Lock acquisition and validation
- Orphaning comment thread anchors

```ts
import { UniqueID } from '@tiptap/extension-unique-id';

const editor = useEditor({
  extensions: [
    UniqueID.configure({
      types: ['paragraph', 'heading', 'bulletList', 'orderedList',
              'listItem', 'taskList', 'taskItem', 'codeBlock',
              'blockquote', 'image', 'horizontalRule', 'table',
              'tableRow', 'tableCell', 'tableHeader'],
    }),
    // ... other extensions
  ],
});
```

If a block is missing an ID or has a duplicate, the server **reassigns** a new UUID and the response `doc.contentJson` is the authoritative version. Always overwrite local state with the server's `doc.contentJson` after a `doc:saved` event.

---

### Recommended editing flow

```
1. Load doc via GET /docs/:id
2. Initialize TipTap with doc.contentJson, remember doc.version
3. Connect socket, socket.emit('doc:join', { docId })
4. On doc:presence-snapshot → render collaborator avatars
5. On doc:lock-snapshot → render lock indicators on blocks

6. User focuses a block:
   → socket.emit('doc:lock-block', { docId, blockId })
   → start heartbeat interval (every 10s): socket.emit('doc:lock-heartbeat', ...)
   → On doc:lock-rejected → mark block read-only

7. User edits:
   → Debounce editor changes (500ms–1s)
   → socket.emit('doc:autosave', { docId, contentJson, baseVersion })

8. On doc:saved → update local doc + version, stop showing "saving..." indicator

9. User leaves block:
   → socket.emit('doc:unlock-block', { docId, blockId })
   → clear heartbeat interval

10. User navigates away:
    → socket.emit('doc:leave', { docId })
    OR just socket.disconnect() — server auto-cleans

11. Another user's save arrives via doc:saved broadcast:
    → Apply server doc.contentJson to editor (this is the merge result)
    → Update local baseVersion to doc.version
```

---

## Permissions

The authenticated user's access level to a doc is determined server-side. The API will return:

- `403 Forbidden` — user has no access to the doc
- `200/201` — user has sufficient access for the operation

| Operation | Minimum role |
|---|---|
| View doc | VIEWER |
| Autosave content | EDITOR |
| Rename title | EDITOR |
| Manage share links | OWNER |
| Delete doc | OWNER |

Roles inherit from workspace membership by default:
- Workspace OWNER → doc OWNER
- Workspace MEMBER → doc EDITOR

Explicit per-doc permission overrides can grant lower access (e.g., VIEWER or COMMENTER) — this is used for sharing.

---

## Stubbing Unbuilt Features

These features are in progress. Implement placeholder UI that shows "coming soon" or is hidden behind a feature flag:

| Feature | Stub recommendation |
|---|---|
| Comment threads | Render anchor highlights in editor but disable click-to-open |
| Version history | Show "Version history" button, disabled with tooltip "Coming soon" |
| Share link | Show "Share" button, disabled with tooltip "Coming soon" |
| Export | Show "Export" menu, disabled |
| Live task cards | Render `taskCard` blocks as static task ID for now |

---

## Environment Variables (frontend)

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

The WebSocket namespace is `/docs`, so the full URL is `http://localhost:3000/docs`.

---

## Common Mistakes

1. **Sending `Authorization` header on WebSocket** — browser WS API doesn't support custom headers. Use `auth: { token }` in the io() options.
2. **Not sending `baseVersion`** — autosave will reject with a 400 error. Always track `doc.version` from the last server response.
3. **Saving without holding a lock** — if you modify a block you don't own a lock on, the autosave will return `doc:save-conflict` with reason `Modified blocks must be locked by the saving user`. Always lock before editing.
4. **Ignoring `doc:saved` broadcasts from other users** — the server merges saves server-side. Apply the broadcast `doc.contentJson` to your editor state immediately to stay in sync.
5. **Missing `UniqueID` extension** — blocks without stable IDs will be reassigned new UUIDs on every save, breaking lock associations and making the diff algorithm useless.
