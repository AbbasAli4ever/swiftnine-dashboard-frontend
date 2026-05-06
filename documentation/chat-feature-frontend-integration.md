# Chat + Channels — Frontend Integration Guide

Single source of truth for integrating the chat, channels, DMs, presence, attachments, and chat-related notifications. All endpoints and events below reflect the actual backend implementation as shipped on `main` (commits `388b0df` → `3eb0c52`).

---

## 1. Conventions

### Base URLs
- REST API: `/api/v1`
- Socket.IO chat namespace: `/chat`
- Socket.IO presence namespace: `/presence`
- (Existing) Socket.IO docs namespace: `/docs`

### Auth
- REST: `Authorization: Bearer <accessToken>` on every chat/channel route.
- REST workspace-scoped routes: also require `x-workspace-id: <workspaceId>` header. All `/chat/*` and `/channels/*` routes are workspace-scoped.
- Sockets: pass the access token in the Socket.IO handshake `auth.token`.

### CORS
The server reads `CORS_ALLOWED_ORIGINS` (comma-separated) from env and applies the same allowlist to REST and to all Socket.IO namespaces. If your origin is not on the list the WS handshake fails before the JWT check runs.

### Standard response envelope
All REST endpoints return:
```json
{ "data": <payload>, "message": "<optional human string>" }
```
(Errors follow the standard Nest error shape: `{ statusCode, message, error }`.)

### Pagination
Cursor-based on `(createdAt, id)`. The server returns:
```json
{ "items": [...], "nextCursor": "<opaque-string-or-null>" }
```
Pass `nextCursor` back as `?cursor=` to load the next page. Default page size 50, max 100. Cursors are opaque — do not parse them.

### Dates
ISO 8601 strings. `null` is meaningful (e.g. `deletedAt: null` means not deleted).

---

## 2. Socket.IO bootstrap

```ts
import { io, Socket } from 'socket.io-client';

const baseUrl = 'https://api.example.com'; // your API origin

export function connectChat(accessToken: string): Socket {
  return io(`${baseUrl}/chat`, {
    withCredentials: true,
    auth: { token: accessToken },
    transports: ['websocket'],
  });
}

export function connectPresence(accessToken: string): Socket {
  return io(`${baseUrl}/presence`, {
    withCredentials: true,
    auth: { token: accessToken },
    transports: ['websocket'],
  });
}
```

**Important**:
1. Connect `/chat` early in the app lifecycle. `User.isOnline` is driven by active `/chat` and `/docs` socket connections — a client connected only to `/presence` will *not* flip itself online.
2. On connect, the server auto-joins your socket to every channel room you are a member of. You only need to emit `chat:join` if you want to flag the actively viewed channel for typing-permission gates (see §6).
3. Reconnect with a fresh access token before the previous one expires (60s before is a reasonable margin). The server emits no `token-expiring` event on chat — manage refresh on your side.

---

## 3. Domain model (shapes you'll receive)

### Channel
```ts
type Channel = {
  id: string;
  workspaceId: string;
  kind: 'CHANNEL' | 'DM';
  privacy: 'PUBLIC' | 'PRIVATE';      // DMs are always 'PRIVATE'
  name: string | null;                 // null for DMs
  description: string | null;
  projectId: string | null;            // null for DMs and workspace-only channels
  createdBy: string;
  createdAt: string;
  updatedAt: string;

  // Caller-scoped state — populated for the requesting user
  isMember: boolean;                   // false for non-joined PUBLIC channels visible in directory
  isMuted: boolean;
  unreadCount: number;
  lastReadMessageId: string | null;
  viewerMembership: ChannelMember | null;

  members: ChannelMember[];
};

type ChannelMember = {
  id: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  isMuted: boolean;
  unreadCount: number;
  lastReadMessageId: string | null;
  joinedAt: string;
  user: { id: string; fullName: string; avatarUrl: string | null };
};
```

### Message
```ts
type ChatMessage = {
  id: string;
  channelId: string;
  senderId: string | null;             // null for kind=SYSTEM
  kind: 'USER' | 'SYSTEM';
  contentJson: Record<string, unknown>; // ProseMirror/BlockNote JSON; for SYSTEM see §11
  plaintext: string;                   // denormalized for search & previews
  replyToMessageId: string | null;
  isEdited: boolean;
  editedAt: string | null;
  isPinned: boolean;
  pinnedAt: string | null;
  pinnedById: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;            // tombstone marker

  sender: ChatUserSummary | null;
  pinnedBy: ChatUserSummary | null;
  mentions: ChatUserSummary[];
  reactions: ChatReaction[];
  attachments: Attachment[];
  replyTo: ChatReplyPreview | null;
  channel: { id: string; workspaceId: string; kind: 'CHANNEL'|'DM'; privacy: 'PUBLIC'|'PRIVATE'; name: string|null };
};

type ChatUserSummary  = { id: string; fullName: string; avatarUrl: string | null };
type ChatReaction     = { id: string; messageId: string; userId: string; emoji: string; createdAt: string; user: ChatUserSummary };
type ChatReplyPreview = { id: string; senderId: string|null; kind: 'USER'|'SYSTEM'; plaintext: string; deletedAt: string|null; sender: ChatUserSummary|null };
```

### Soft-deleted message
Tombstones come back with:
```json
{
  "contentJson": { "deleted": true },
  "plaintext": "",
  "deletedAt": "2026-05-05T...Z"
}
```
Render as "Message deleted" in the timeline. Reactions and attachments are not stripped from the row — hide them client-side if you want.

---

## 4. REST endpoints — channels & membership

All under `/api/v1/channels`. All require `Authorization` and `x-workspace-id`.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/channels/workspaces/:workspaceId` | — | `Channel[]` (privacy-aware; non-members see PUBLIC channels in directory mode) |
| GET | `/channels/workspaces/:workspaceId/projects/:projectId` | — | `Channel[]` for the project |
| POST | `/channels` | `{ name, description?, privacy?, projectId? }` | `Channel` (creator becomes OWNER) |
| PATCH | `/channels/:id` | `{ name?, description?, privacy? }` | `Channel` — OWNER/ADMIN only |
| POST | `/channels/:id/members` | `{ userId, role: 'admin'\|'member' }` | `ChannelMember` — OWNER/ADMIN only |
| POST | `/channels/:id/members/bulk` | `{ members: [{ userId, role }] }` | `ChannelMember[]` |
| DELETE | `/channels/:id/members/:memberId` | — | 200 — OWNER/ADMIN only; cannot remove self or OWNER; ADMIN-removable only by OWNER |

### Join requests (PUBLIC channels only — PRIVATE = invite-only)
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/channels/:id/join-requests` | — | 400 if you already have a PENDING request, are already a member, or were rejected within the last 24h |
| GET | `/channels/:id/join-requests?status=PENDING\|APPROVED\|REJECTED` | — | OWNER/ADMIN only |
| GET | `/channels/:id/join-requests/me` | — | Caller's latest request status (any state), or `null` |
| PATCH | `/channels/:id/join-requests/:reqId` | `{ decision: 'approve'\|'reject' }` | OWNER/ADMIN only. On approve: creates ChannelMember, emits `member_joined` system message, sends notification to requester. On reject: marks REJECTED; user must wait 24h to re-request |

---

## 5. REST endpoints — chat

All under `/api/v1/chat`. All require `Authorization` and `x-workspace-id`. All require channel membership unless noted.

### Messages
| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/chat/channels/:channelId/messages` | `?cursor=&limit=` (default 50, max 100) | `{ items: ChatMessage[], nextCursor: string\|null }` — newest first |
| GET | `/chat/channels/:channelId/messages/context` | `?messageId=&before=&after=` (each default 20, max 50) | `{ items, anchorMessageId, hasBefore, hasAfter }` — chronological order |
| GET | `/chat/channels/:channelId/messages/pinned` | — | `ChatMessage[]` — most recently pinned first |
| POST | `/chat/channels/:channelId/messages` | `{ contentJson, replyToMessageId?, mentionedUserIds?, attachmentIds? }` | `ChatMessage` — content **or** at least one attachment is required. Rate-limited to 30/min per (user, channel) → 429 |
| PATCH | `/chat/messages/:messageId` | `{ contentJson, mentionedUserIds? }` | `ChatMessage` — author only, within 5 min, USER kind only |
| DELETE | `/chat/messages/:messageId` | — | `ChatMessage` (tombstone) — author or channel OWNER/ADMIN; SYSTEM messages are immutable |

### Reactions, pin, mute, read
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/chat/messages/:messageId/reactions` | `{ emoji }` | **Toggle** — second call with same emoji from same user removes it. Response: `{ action: 'added'\|'removed', messageId, userId, emoji }`. Rate-limited 120/min per (user, channel). |
| POST | `/chat/messages/:messageId/pin` | — | OWNER/ADMIN only |
| DELETE | `/chat/messages/:messageId/pin` | — | OWNER/ADMIN only |
| POST | `/chat/channels/:channelId/read` | `{ lastReadMessageId }` | Recomputes unread count from DB; broadcasts `member:read`. Returns `{ channelId, userId, lastReadMessageId, unreadCount, readAt }` |
| POST | `/chat/channels/:channelId/mute` | — | Self-only |
| POST | `/chat/channels/:channelId/unmute` | — | Self-only |

### DMs
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/chat/dm` | `{ targetUserId }` | Returns the existing DM if one exists between caller and target in this workspace; otherwise creates one. Both users become MEMBER. Server emits a `dm_started` SYSTEM message in the new DM. 400 if `targetUserId === self`. |
| GET | `/chat/dms` | — | All DMs the caller participates in, in this workspace |

### Search
| Method | Path | Query | Notes |
|---|---|---|---|
| GET | `/chat/search` | `q` (1–200 chars, required), `channelId?`, `cursor?`, `limit?` (default 50, max 100) | Case-insensitive substring on `plaintext`. Restricted to channels caller is a member of in the active workspace. Use `messages/context` to hydrate around a hit. |

---

## 6. `/chat` Socket.IO — events

### Connection lifecycle
- On successful connect, server auto-joins your socket to `channel:{id}` for every `ChannelMember` row you have. New `message:new`/`reaction:*`/etc. events stream in for every channel without any extra subscribe call. Unread badges in your sidebar stay current.
- If the JWT is invalid the server emits `chat:error { reason }` then disconnects.

### Client → Server
| Event | Payload | Server behavior |
|---|---|---|
| `chat:join` | `{ channelId }` | Asserts membership; (idempotent re-join) — useful as an explicit signal that this channel is now the active view |
| `chat:leave` | `{ channelId }` | Leaves the room (you'll stop getting events for it until next connect) |
| `chat:typing-start` | `{ channelId }` | Broadcasts `typing:user-started` to all OTHER members in room. Requires the socket be currently joined to the channel room. Rate-limited 120/min |
| `chat:typing-stop` | `{ channelId }` | Same, emits `typing:user-stopped` |

Typing event flood → server throws a WS error `Too many typing events. Please slow down.`

### Server → Client (room: `channel:{id}`)
| Event | Payload | When |
|---|---|---|
| `message:new` | `ChatMessage` | After every message create (including DMs and SYSTEM messages) |
| `system:event` | `ChatMessage` (with `kind: 'SYSTEM'`) | Mirrors `message:new` for SYSTEM rows — bind a dedicated handler if you want to render system events differently |
| `message:edited` | `ChatMessage` | After PATCH succeeds |
| `message:deleted` | `{ messageId, deletedAt }` | After DELETE succeeds (replace local copy with tombstone) |
| `message:pinned` | `{ message, pinnedById, pinnedAt }` | After pin |
| `message:unpinned` | `{ messageId }` | After unpin |
| `reaction:added` | `{ messageId, userId, emoji }` | After toggle adds |
| `reaction:removed` | `{ messageId, userId, emoji }` | After toggle removes |
| `member:read` | `{ channelId, userId, lastReadMessageId, unreadCount, readAt }` | After someone calls `POST /chat/channels/:id/read` — use this to advance other users' "seen by" pointers |
| `typing:user-started` | `{ channelId, userId }` | A peer started typing |
| `typing:user-stopped` | `{ channelId, userId }` | A peer stopped typing |
| `chat:error` | `{ reason }` | Auth failure (followed by disconnect) |

### Reconnect strategy
1. Reconnect with fresh JWT.
2. Refetch sidebar (`GET /channels/workspaces/:workspaceId`) to reconcile `unreadCount` / `isMuted`.
3. For the active channel, refetch history with `GET /chat/channels/:id/messages?cursor=` (recovery is at-least-once via DB; sockets don't replay missed events).
4. If you opened the app via a search hit, use `messages/context` to hydrate around the anchor.

---

## 7. `/presence` Socket.IO

| Direction | Event | Payload | Notes |
|---|---|---|---|
| Client → Server | `presence:subscribe` | — | Joins a `workspace:{id}` room for every workspace caller belongs to. Call once per connect |
| Server → Client | `presence:changed` | `{ userId, isOnline, lastSeenAt }` | Emitted only on transitions (offline→online, last-online-socket→offline). Intermediate connects/disconnects don't fire |

`presence:changed` is reach-broadcast across **all** workspaces you share with the user, so a single event can fire in multiple of your subscribed rooms — dedupe on `userId` if needed.

`User.isOnline` is server-side state, written by `PresenceService` when the user has at least one active `/chat` or `/docs` socket. It is *not* updated by `/presence` connects alone.

---

## 8. Attachments — the upload flow

Three steps. All under `/api/v1/attachments`.

### Step 1 — presign
```
POST /attachments/presign
Authorization: Bearer ...
Content-Type: application/json

{
  "scope": "channel-message",
  "channelId": "<channelId>",
  "mimeType": "image/png",
  "fileName": "screenshot.png",       // optional
  "fileSize": 245000                  // optional
}
```
Response:
```json
{
  "data": {
    "uploadUrl": "https://s3...",
    "s3Key": "swiftnine/docs/app/attachments/channel-<id>/<uuid>-screenshot.png",
    "expiresAt": "2026-05-05T...Z",
    "attachmentId": "<uuid>"
  }
}
```

You must be a member of the channel; non-members get 403/404.

### Step 2 — upload to S3
```
PUT <uploadUrl>
<file body>
```
**Do not** set a `Content-Type` header on this PUT (the signature is generated without it; setting one will mismatch). The signed URL expires in 15 minutes.

### Step 3 — attach to a message
Send the message and pass the `attachmentId` from step 1 in the array:
```
POST /chat/channels/:channelId/messages
{
  "contentJson": { "type": "doc", "content": [...] },
  "attachmentIds": ["<uuid>"]
}
```
The server validates that:
- you uploaded each attachment yourself,
- the `s3Key` prefix matches `attachments/channel-{channelId}` (so you can't reuse another channel's file),
- the attachment isn't already linked to another message.

If validation fails the message returns 400 and nothing is persisted.

A message with no `plaintext` content still requires at least one valid attachment, otherwise 400.

---

## 9. Notifications

Chat fans out into the existing in-app notifications subsystem. No new endpoints — all consumed via the existing notifications stream.

### Types created by chat
- `chat:message` — a regular message arrived in a channel you are in
- `chat:mention` — you were @-mentioned, **or** the message arrived in a DM (DM = implicit mention)

### Mute behavior
| Channel state | `chat:message` | `chat:mention` |
|---|---|---|
| not muted | created | created |
| muted | suppressed | created |
| DM (kind=DM) | always treated as mention; created |

The actor (sender) never gets a notification for their own message.

### Where to read them
Existing endpoints under `/api/v1/notifications`:
- `GET /notifications/members/:memberId/stream` — SSE stream for in-app notifications (auth via JWT in `Authorization`; supports same `member:created`/`member:updated` events as today)
- `PATCH /notifications/:id/read | clear | snooze`
- `GET /notifications/cleared | snoozed`

Notification rows have `referenceType: 'channel_message'`, `referenceId: <messageId>` so you can link the user back to the message.

### Retention
The server runs a daily cleanup job that deletes notifications older than 90 days. Your client doesn't need to do anything.

---

## 10. Read receipts ("seen by")

The backend exposes only per-member pointers — it does **not** precompute a "seen by" list.

### Derivation rule
1. From the channel's `members[]` (or the per-member events you received), keep `lastReadMessageId` per `userId`.
2. Apply each `member:read` event live: `members[userId].lastReadMessageId = event.lastReadMessageId`.
3. For each visible message `m`, "seen by" = list of members where their `lastReadMessageId === m.id` **or** points to a message strictly after `m` (compare by `createdAt, id` to break ties).

You will already have message ordering from the cursor pagination; reuse that ordering for the comparison instead of refetching.

### Marking as read
- Frontend decides when (typically: when the user scrolls to the latest message and the channel is focused).
- Call `POST /chat/channels/:id/read { lastReadMessageId }` — the server returns the recomputed `unreadCount` and broadcasts `member:read` to the room.
- Don't call this on every keystroke. Throttle / debounce.

---

## 11. System messages

A `ChannelMessage` with `kind: 'SYSTEM'` carries a structured `contentJson` payload of the form:
```json
{ "event": "<event_name>", ...args }
```

Events emitted today (render localized text on the frontend):

| event | Extra fields | When |
|---|---|---|
| `channel_created` | `actorUserId` | After `POST /channels` |
| `channel_renamed` | `actorUserId`, `from`, `to` | After `PATCH /channels/:id` with new name |
| `channel_privacy_changed` | `actorUserId`, `from`, `to` | After `PATCH /channels/:id` with new privacy |
| `member_joined` | `userId`, `actorUserId`, `source` (`'admin_added'` or `'join_request'`) | Member added by admin OR join request approved |
| `member_role_changed` | `userId`, `from`, `to`, `actorUserId` | Bulk add hits an existing member with a different role |
| `member_removed` | `userId`, `role`, `actorUserId` | After `DELETE /channels/:id/members/:memberId` |
| `dm_started` | `participantUserIds` | After `POST /chat/dm` creates a fresh DM |

System messages have `senderId: null`, `plaintext: ''`. They are **immutable** — edit/delete return 403. Reactions and pinning still work. They count toward `unreadCount` like any other message.

---

## 12. Rate limits

| Path | Limit | Failure |
|---|---|---|
| `POST /chat/.../messages` | 30/min per user per channel | HTTP 429 |
| `POST /chat/messages/:id/reactions` | 120/min per user per channel | HTTP 429 |
| `chat:typing-start` / `chat:typing-stop` | 120/min per user per channel | WS error event |

Rate-limit buckets are in-memory and reset on process restart. They are **not** shared across multiple API instances yet — treat them as a soft floor, not a hard contract.

---

## 13. Error handling cheatsheet

| Scenario | Code |
|---|---|
| Missing/invalid JWT | 401 |
| Missing `x-workspace-id` | 401 / 403 (depends on guard order) |
| Not a workspace member | 403 |
| Not a channel member (REST) | 403/404 |
| Not a channel member (`chat:join`) | WS error |
| Channel/message/request not found | 404 |
| Edit window exceeded | 403 (`Messages can only be edited within 5 minutes`) |
| Edit a SYSTEM message | 403 |
| Non-author/non-admin trying to delete | 403 |
| Pin/unpin without ADMIN/OWNER | 403 |
| Empty content with no attachments | 400 |
| Mentioned user not in channel | 400 |
| Attachment from another channel | 400 |
| Reply target in another channel | 400 |
| Already a member / pending request | 400 |
| Re-request within 24h of REJECTED | 400 |
| Rate-limited | 429 |
| Content JSON too large | 413 |

---

## 14. Minimal end-to-end example

```ts
// 1. Connect sockets
const chat = connectChat(accessToken);
const presence = connectPresence(accessToken);
presence.emit('presence:subscribe');

// 2. Listen for events
chat.on('message:new', (msg) => store.upsertMessage(msg));
chat.on('message:edited', (msg) => store.upsertMessage(msg));
chat.on('message:deleted', ({ messageId, deletedAt }) => store.markDeleted(messageId, deletedAt));
chat.on('reaction:added', (r) => store.addReaction(r));
chat.on('reaction:removed', (r) => store.removeReaction(r));
chat.on('member:read', (r) => store.advanceReadPointer(r));
chat.on('typing:user-started', (t) => store.setTyping(t.channelId, t.userId, true));
chat.on('typing:user-stopped', (t) => store.setTyping(t.channelId, t.userId, false));
presence.on('presence:changed', (p) => store.setOnline(p.userId, p.isOnline, p.lastSeenAt));

// 3. Load sidebar
const channels = await api.get('/channels/workspaces/' + workspaceId);

// 4. Open a channel
const { items, nextCursor } = await api.get(
  `/chat/channels/${channelId}/messages?limit=50`
);
chat.emit('chat:join', { channelId });   // optional but recommended for the active view

// 5. Send a message with an attachment
const presign = await api.post('/attachments/presign', {
  scope: 'channel-message', channelId, mimeType: 'image/png', fileName: 'a.png',
});
await fetch(presign.data.uploadUrl, { method: 'PUT', body: file }); // no Content-Type
const sent = await api.post(`/chat/channels/${channelId}/messages`, {
  contentJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] },
  attachmentIds: [presign.data.attachmentId],
  mentionedUserIds: ['<userId>'],
});

// 6. Mark read when user scrolls to latest
await api.post(`/chat/channels/${channelId}/read`, { lastReadMessageId: latestId });

// 7. Search and jump-to-context
const hits = await api.get(`/chat/search?q=${encodeURIComponent(q)}`);
const ctx  = await api.get(
  `/chat/channels/${hits.data.items[0].channelId}/messages/context?messageId=${hits.data.items[0].id}&before=20&after=20`
);
```

---

## 15. Out of scope (do not build against)

The following are deliberately not implemented in v1 — don't design UI around them yet:

- Group DMs (>2 participants)
- Message threads (Slack-style sub-conversations); v1 uses single-quote replies via `replyToMessageId`
- Edit beyond the 5-minute window, even by admins
- Per-channel notification preferences beyond mute on/off
- Email/push delivery of chat notifications (in-app only)
- Channel-scoped presence ("who is currently viewing this channel")
- Workspace-admin override to read PRIVATE channels they're not in
- Message scheduling, drafts, bookmarks
- Cross-workspace search or DMs

---

## 16. Versioning

This document tracks the actual implementation. If you find a divergence between this doc and the API behavior, the API behavior is the bug — file an issue and reference the affected section.
