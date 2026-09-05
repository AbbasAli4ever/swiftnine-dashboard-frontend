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
  isArchived: boolean;                 // caller's own archive state — see §5 DMs
  isFavourite: boolean;                // caller's own favourite state — see §5 DMs
  unreadCount: number;
  lastReadMessageId: string | null;
  lastMessage: LastMessage | null;     // most recent message in the channel, any kind (incl. SYSTEM) — see §5 DMs
  viewerMembership: ChannelMember | null;

  members: ChannelMember[];
};

// Only returned by GET /chat/dms and POST /chat/dm today (see §5) — not on
// the /channels/workspaces/:workspaceId list.
type LastMessage = {
  id: string;
  senderId: string | null;             // null for kind=SYSTEM
  kind: 'USER' | 'SYSTEM';
  plaintext: string;                   // '' if the message was deleted — check deletedAt, don't treat '' as "no content"
  createdAt: string;
  deletedAt: string | null;
  sender: ChatUserSummary | null;
};

type ChannelMember = {
  id: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  isMuted: boolean;
  isArchived: boolean;                 // this specific member's own archive state, not necessarily the caller's
  isFavourite: boolean;                // this specific member's own favourite state, not necessarily the caller's
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
`avatarUrl` here is always either a permanent public URL or an `initials:AB` placeholder — see §16 for how a user actually sets/uploads it.

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
| GET | `/chat/channels/:channelId/attachments` | — | `{ images: ChatAttachmentView[], videos: [...], files: [...] }` — every attachment ever shared in the channel/DM's entire history, grouped by `mimeType` prefix (`image/*`, `video/*`, everything else → files). See note below. |
| POST | `/chat/channels/:channelId/messages` | `{ contentJson, replyToMessageId?, mentionedUserIds?, attachmentIds? }` | `ChatMessage` — content **or** at least one attachment is required. Rate-limited to 30/min per (user, channel) → 429 |
| PATCH | `/chat/messages/:messageId` | `{ contentJson, mentionedUserIds? }` | `ChatMessage` — author only, within 5 min, USER kind only |
| DELETE | `/chat/messages/:messageId` | — | `ChatMessage` (tombstone) — author or channel OWNER/ADMIN; SYSTEM messages are immutable |

```ts
type ChatAttachmentView = {
  id: string;
  s3Key: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  url: string;         // signed S3 GET URL, generated fresh for THIS call — renders inline
  downloadUrl: string; // same object, forces a Save As dialog instead — see note below
  expiresAt: string;   // 15 minutes from when you called the endpoint, for BOTH urls
  createdAt: string;
};
```
**Do not cache or store `url`/`downloadUrl`.** Both are signed links into the private attachments bucket, valid for 15 minutes from the moment you called this endpoint — the same mechanism every message's embedded `attachments[]` already uses (§3), just aggregated across the whole channel instead of one message. Re-call this endpoint whenever the user opens the "media/files" panel again; don't try to keep yesterday's response around and reuse its URLs. (This is unrelated to avatars/§16 — those live in a different, genuinely public bucket and their URLs never expire.)

**`url` vs `downloadUrl` — use the right one for the right UI element:**
```jsx
<img src={attachment.url} />                  {/* inline preview — renders in the browser */}
<a href={attachment.downloadUrl}>Download</a>  {/* forces a Save As dialog */}
```
They point at the same S3 object but are two separately-signed URLs: `url` carries no disposition override (browsers render it inline for displayable types like images/PDFs — right for `<img>`/`<video>` `src`, or an "open" action). `downloadUrl` has `Content-Disposition: attachment` baked into its signature, with the real `fileName` — that's what actually forces the browser to save the file rather than open it, for any file type. **Plain HTML `<a href={url} download>` does not reliably work here** — the `download` attribute is only honored by browsers for same-origin links, and this is a cross-origin S3 URL; only the real `Content-Disposition` response header (i.e., `downloadUrl`) forces it. Same two fields, same reasoning, also present on every attachment already embedded in `ChatMessage.attachments[]` (§3) — not unique to this endpoint.

**When to call it, and where `channelId` comes from:** don't call this on every conversation open — only when the user actually opens the "Media, Links and docs" side panel (or equivalent UI) for the currently-open conversation. Firing it automatically alongside every `GET .../messages` load wastes a full S3-signing round trip for a panel the user may never look at.

You never need a separate lookup for `channelId` — it's the exact same id you're already holding for whichever conversation is currently open, sourced from wherever you got there:
- Opened from the DM sidebar → it's that item's `id` from `GET /chat/dms`.
- Opened from the channel sidebar → it's that item's `id` from `GET /channels/workspaces/:workspaceId`.

That's the same `channelId` already being used for `GET .../messages`, `POST .../messages`, mark-read, etc. for that same open conversation — attachments just reuses it, not a new identifier.

Because `url`s expire in 15 minutes, a panel left open significantly longer than that will start showing broken images/links — re-call the endpoint when the panel regains focus (tab switch back, reopen) rather than assuming a single fetch stays valid for an indefinitely-long session.

### Reactions, pin, mute, read
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/chat/messages/:messageId/reactions` | `{ emoji }` | **Toggle** — second call with same emoji from same user removes it. Response: `{ action: 'added'\|'removed', messageId, userId, emoji }`. Rate-limited 120/min per (user, channel). |
| POST | `/chat/messages/:messageId/pin` | — | OWNER/ADMIN only |
| DELETE | `/chat/messages/:messageId/pin` | — | OWNER/ADMIN only |
| POST | `/chat/channels/:channelId/read` | `{ lastReadMessageId }` | Recomputes unread count from DB; broadcasts `member:read`. Returns `{ channelId, userId, lastReadMessageId, unreadCount, readAt }` |
| POST | `/chat/channels/:channelId/mute` | — | Self-only |
| POST | `/chat/channels/:channelId/unmute` | — | Self-only |
| POST | `/chat/channels/:channelId/archive` | — | Self-only. Works on any channel or DM, but only `GET /chat/dms` currently filters by it (see below) |
| POST | `/chat/channels/:channelId/unarchive` | — | Self-only |
| POST | `/chat/channels/:channelId/favourite` | — | Self-only. Same scope note as archive |
| POST | `/chat/channels/:channelId/unfavourite` | — | Self-only |

Archive/favourite/unarchive/unfavourite all return `{ channelId, userId, isArchived }` or `{ channelId, userId, isFavourite }`. **All four are per-person, not per-room** — same as mute: they flip a flag on only the caller's own `ChannelMember` row. Archiving/favouriting a DM is invisible to the other participant; their own list, their own `isArchived`/`isFavourite`, is completely unaffected.

### DMs
| Method | Path | Body / Query | Notes |
|---|---|---|---|
| POST | `/chat/dm` | `{ targetUserId }` | Returns the existing DM if one exists between caller and target in this workspace; otherwise creates one. Both users become MEMBER. Server emits a `dm_started` SYSTEM message in the new DM. 400 if `targetUserId === self`. Response includes `lastMessage` (see §3) — `null` for a brand-new DM, the `dm_started` SYSTEM row otherwise. |
| GET | `/chat/dms` | `?archived=` (default `false`), `?favourite=` (omit for no filter, `true`/`false` to narrow) | All DMs the caller participates in, in this workspace, matching both filters. Each entry includes `lastMessage`. |

**Filtering client-side is equally valid and often simpler**: every `Channel` object already carries `isArchived`/`isFavourite` for the caller, so you can fetch the plain unfiltered list once (`GET /chat/dms`) and do `dms.filter(d => d.isFavourite)` / `.filter(d => !d.isArchived)` yourself instead of round-tripping with the query params. Use whichever fits your data-fetching pattern — the query params exist for workspaces with enough DMs that fetching everything becomes wasteful, not because client-side filtering is wrong.

**How the DM list's `lastMessage` preview stays live — this is a client responsibility, not a server push.** There is no dedicated "DM list changed" socket event. What exists:
- The server always computes `lastMessage` **fresh from the DB** on every `GET /chat/dms` / `POST /chat/dm` call — so a re-fetch is always correct, never stale.
- The server broadcasts every new message live over the *same* `message:new` event (§6) that already powers an open chat thread — it is not a separate stream for the sidebar.

To get an instant-updating sidebar preview (rather than one that only refreshes when you next call `GET /chat/dms`), listen for `message:new` globally — not only while that DM's thread happens to be open — and patch your local list state yourself:
```ts
chat.on('message:new', (msg) => {
  store.updateDmListPreview(msg.channelId, {
    lastMessage: msg,
    // bump unreadCount here too unless msg.senderId === currentUserId
  });
  store.moveDmToTop(msg.channelId);
});
```
If your app instead just re-fetches `GET /chat/dms` whenever the sidebar screen is opened/focused, that also works correctly — it's a latency tradeoff (instant vs. next-open), not a correctness one.

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

## 16. User profile & avatars

`avatarUrl` shows up throughout chat — `ChatUserSummary` (sender, pinnedBy, mentions, reaction users), every `ChannelMember.user`, presence — so integrating chat means integrating this too. All under `/api/v1/user`, `Authorization` required (no `x-workspace-id` — profile is global, not workspace-scoped).

### The field itself
`User.avatarUrl` (surfaced everywhere as `avatarUrl`, set via the `profilePicture` field on the profile endpoints) is always one of:
- a full `https://...` URL, or
- `initials:AB` / bare `AB` (1–4 letters) — a placeholder meaning "render initials, no image." New users default to this (initials derived from their name) until they set a real picture.

Google sign-in auto-fills it from the Google account picture on first signup, and again on later login **only if the user still has no avatar** — it never overwrites a manually-set one.

### Changing it — two-step upload, then apply
There is no single "upload an avatar" call. Uploading and applying are deliberately separate:

| Step | Method | Path | Body | Returns |
|---|---|---|---|---|
| 1 | POST | `/user/profile/avatar/presign` | `{ mimeType, fileName?, fileSize? }` — `mimeType` must be one of `image/png`, `image/jpeg`, `image/webp`, `image/gif` | `{ uploadUrl, s3Key, publicUrl, expiresAt }` |
| 2 | — | *(direct to S3)* | `PUT` the raw file bytes to `uploadUrl` | — |
| 3 | PATCH | `/user/profile` | `{ profilePicture: publicUrl }` | Updated profile |

Notes on step 2: it's a plain `PUT`, no special headers required. Set `Content-Type` to the same `mimeType` you presigned with if you want the object to actually serve back with that content type later — it's not part of the signed request (so it can't cause a signature mismatch), but S3 stores whatever you send; skip it and the file serves as generic `binary/octet-stream` instead (still displays fine in an `<img>` tag, just not semantically correct). Do **not** attempt to set an ACL header of any kind — this upload's target bucket rejects ACLs outright (`AccessControlListNotSupported`, confirmed live); the bucket is already public at the policy level, no per-object ACL needed or possible.

**This is intentionally the same shape as `POST /bank-accounts/logo-presign`** (presign → PUT → apply via the URL) if you've already integrated that flow elsewhere — the upload mechanics are identical, just a different owning entity.

`publicUrl` (and therefore whatever ends up in `avatarUrl` after step 3) is reachable with **zero authentication, forever** — no signed URL, no expiry, plain public `https://` link. `uploadUrl` itself does expire (`expiresAt`, 15 minutes) — it's only good for the one PUT.

**Step 3 is not automatic.** Uploading a file and stopping there does nothing to your profile — you must still call `PATCH /user/profile` yourself with the `publicUrl` from step 1. This also means `profilePicture` on `PATCH`/`POST /user/profile` isn't restricted to avatars uploaded this way — any `https://` URL or an initials placeholder (`initials:AB` / `AB`) is accepted directly, no presign needed, if you already have an image hosted elsewhere.

### Reading the current profile
`GET /user/profile` (self) / `GET /user/:id` (any user) — returns the full profile including `avatarUrl` as `profilePicture`. The rest of the profile shape (name, status, bio, timezone, notification preferences) is unrelated to and unchanged by any of the above — full field-by-field docs are in Swagger (`/api/docs`, `users` tag), out of scope for this chat-focused doc beyond the avatar field chat itself depends on.

---

## 17. Versioning

This document tracks the actual implementation. If you find a divergence between this doc and the API behavior, the API behavior is the bug — file an issue and reference the affected section.
