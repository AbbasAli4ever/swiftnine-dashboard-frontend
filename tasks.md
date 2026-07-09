# SwiftBot — Tasks Completed

Chronological record of everything built and fixed for the SwiftBot AI chatbot feature, across both the frontend (`swiftnine-dashboard-frontend`) and backend (`swiftnine-dashboard-backend`) repos.

## 1. Initial build — chatbot in the sidebar

- Added a third left-sidebar rail entry (after Home and LMS) that opens a ChatGPT-style assistant.
- New route `/chat` (`src/app/(admin)/(others-pages)/chat/page.tsx`), rendering `ChatbotPage`.
- New Next.js API route `src/app/api/chat/route.ts` — server-side proxy that streams OpenAI chat completions (`gpt-4o-mini`) back to the browser, keeping the API key server-only.
- New UI components under `src/components/chatbot/`: `ChatbotPage`, `ChatMessageBubble`, `ChatMessageInput`, `ChatTypingIndicator`, `ChatbotPanelContent` (the sidebar's conversation list).
- New `useChatConversations` hook (originally `localStorage`-backed) and `chatbot.service.ts` (handles the streaming `fetch` to `/api/chat`).
- Added `openai` npm dependency and `OPENAI_API_KEY` env var wiring.
- **Bug fixed:** the `OpenAI` client was constructed at module load time, so a missing API key crashed *every* request (even unauthenticated ones) with a raw 500 instead of a clean 401. Fixed by constructing it lazily inside the try/catch.
- Verified via curl: 401 (no auth header), 400 (bad body), 500 (OpenAI error), and a real streamed completion.

## 2. Branding and formatting

- Named the assistant **SwiftBot**, applied throughout (sidebar label, panel header, message sender name, composer placeholder, page title).
- Added a reusable `bg-swiftnine-gradient` Tailwind utility (`src/app/globals.css`) reusing the site's signature pink→purple→blue gradient for the bot's avatar/branding accents.
- Added a branded welcome screen with clickable suggested-prompt chips.
- Added markdown rendering for assistant responses via `react-markdown` + `remark-gfm` (`src/components/chatbot/ChatMarkdown.tsx`) — bold, lists, links, tables, code blocks.

## 3. Backend persistence (`swiftnine-dashboard-backend`)

Conversation history was upgraded from browser-only `localStorage` to real backend persistence, so it follows a user across devices.

- **Prisma schema** (`prisma/schema.prisma`): new `AiConversation` and `AiConversationMessage` models, `AiMessageRole`/`AiMessageStatus` enums, back-relations on `User` and `Workspace`. Migration: `prisma/migrations/20260707082928_add_ai_conversations/`.
- **New `ai-conversations` module** (`apps/api/src/ai-conversations/`): controller, service, DTOs (`create-conversation`, `update-conversation`, `create-message`), constants. Registered in `app.module.ts`.
  - `GET /ai-conversations` — list current user's conversations in the active workspace
  - `POST /ai-conversations` — create
  - `GET /ai-conversations/:id` — get with full message list
  - `PATCH /ai-conversations/:id` — rename
  - `DELETE /ai-conversations/:id` — soft delete
  - `POST /ai-conversations/:id/messages` — append a message (sets the conversation's title from the first user message if not already set)
  - `DELETE /ai-conversations/:id/messages/:messageId` — hard-delete one message (needed for the regenerate/retry flow, since messages are otherwise append-only)
- Guards: `JwtAuthGuard` + `WorkspaceGuard`, plus explicit `userId` ownership checks in the service layer (a conversation belonging to another user in the same workspace returns 404, not 403).
- **Verified via curl**: full CRUD, Zod validation errors (422), missing `x-workspace-id` header (403), and — importantly — that a second user in the same workspace cannot see or modify the first user's conversations (404).
- Set up local dev infrastructure to test this safely: a local Postgres database (`swiftnine_dashboard_dev`) and a local `.env`, since the credentials initially provided pointed at the **production** RDS database and migrations shouldn't run there from a chat session.

## 4. Frontend integration with the new backend

- New `src/services/aiConversations.service.ts` — wraps the shared `api` axios instance, maps between the backend's uppercase `USER`/`ASSISTANT` wire format and the frontend's internal lowercase `user`/`assistant` types.
- New query keys in `src/queries/keys.ts` (`aiConversations`, `aiConversation`), scoped by workspace.
- Rewrote `useChatConversations.ts` to be React-Query-backed instead of `localStorage`-only, following this codebase's existing data-fetching convention (plain `useQuery` + hand-written mutating functions that patch the cache via `setQueryData`/`invalidateQueries`, no `useMutation`).
- Split message-cache updates into cache-only (`insertLocalMessage`, `updateLastMessage` — used while a response is still streaming) vs. network-persisting (`persistMessage` — called once per finished turn) halves, since the backend's message table is append-only and can't take a write per streamed token.
- Updated `ChatbotPage.tsx` and `ChatbotPanelContent.tsx` for the now-async `createConversation()`/`deleteConversation()`/`renameConversation()`.

## 5. Feature polish

- **Copy-to-clipboard**: new `src/hooks/useCopyToClipboard.ts`, applied to code blocks (`ChatMarkdown.tsx`) and whole assistant messages (`ChatMessageBubble.tsx`).
- **Syntax highlighting**: added `rehype-highlight` + `highlight.js`, wired into `ChatMarkdown.tsx`'s existing `react-markdown` pipeline, with a hand-rolled light/dark token-color theme in `globals.css` matching the app's own palette (rather than importing a prebuilt highlight.js theme).
- **Retry/regenerate**: extracted the streaming logic into a shared `runCompletion()` helper (`ChatbotPage.tsx`) used by both a fresh send and `retryLastMessage()`, which deletes the discarded response (via the new backend endpoint) before streaming a fresh one — avoiding duplicate responses after a reload.
- **Rate-limit handling**: `src/app/api/chat/route.ts` now forwards OpenAI's real HTTP status (e.g. 429) instead of flattening every error to 500; `chatbot.service.ts` throws a `ChatbotHttpError` carrying that status; `ChatbotPage.tsx` shows a distinct "SwiftBot is getting a lot of requests right now" message for 429s instead of a generic error.

## 6. End-to-end verification

- Ran a full scripted browser walkthrough (Playwright) against the local backend + a test account: sign in → open SwiftBot → send a prompt requesting bold text and a code example → confirm streaming, formatting, and syntax highlighting → hard reload and confirm the conversation persisted from the backend → click "Try again" and confirm the old response is cleanly replaced (no duplicate) → dark mode pass.
- Confirmed clean `tsc --noEmit` (frontend) and `nest build` (backend) throughout, with no new errors introduced.

## 7. Bugs found and fixed during manual testing

- **Stale `activeConversationId` causing 404s**: switching between backends (or a conversation being deleted elsewhere) could leave the frontend pointing at a conversation ID that no longer exists, permanently breaking sends. Fixed by detecting a 404 on the conversation-detail fetch or on a message append, and automatically clearing the stale ID (`useChatConversations.ts`).
- **"New chat" not updating the main view**: `ChatbotPage` and `ChatbotPanelContent` each called `useChatConversations()` independently, and `activeConversationId` lived in a plain per-component `useState` — so switching conversations in the sidebar panel didn't update the main chat view. Fixed by moving `activeConversationId` into a shared, persisted Zustand store (`src/stores/chatbotUi.store.ts`), mirroring how the existing DM chat feature shares `activeDmUserId` via `useUiStore`.
- **Conversation title never getting set**: the title-on-first-message logic checked "did we just create this conversation in this exact function call," which was false if the conversation had already been created via the sidebar's "+ New chat" button before the user typed anything — so the title stayed "New chat" forever. Fixed by checking "does this conversation have zero messages yet" instead.
- **Copy button hidden + "Try again" visually overlapping it**: the copy button only appeared on hover, and the separately-positioned "Try again" link sat close enough underneath that the browser's tooltip for "Copy message" visually collided with it. Redesigned into one always-visible action row (Copy + Try again together) rendered inside `ChatMessageBubble` for the last assistant message.

## Key files touched

**Backend** (`swiftnine-dashboard-backend`)
- `prisma/schema.prisma`, `prisma/migrations/20260707082928_add_ai_conversations/`
- `apps/api/src/ai-conversations/*` (new module)
- `apps/api/src/app.module.ts`

**Frontend** (`swiftnine-dashboard-frontend`)
- `src/layout/AppSidebar.tsx`
- `src/app/(admin)/(others-pages)/chat/page.tsx`
- `src/app/api/chat/route.ts`
- `src/components/chatbot/*` (ChatbotPage, ChatbotPanelContent, ChatMessageBubble, ChatMessageInput, ChatTypingIndicator, ChatMarkdown)
- `src/hooks/useChatConversations.ts`, `src/hooks/useCopyToClipboard.ts`
- `src/services/chatbot.service.ts`, `src/services/aiConversations.service.ts`
- `src/stores/chatbotUi.store.ts`
- `src/queries/keys.ts`
- `src/app/globals.css`
- `package.json` (`openai`, `react-markdown`, `remark-gfm`, `rehype-highlight`, `highlight.js`)

## Not yet done / explicitly deferred

- Responsive/mobile layout for the chat UI (deferred — the whole dashboard shell has no responsive handling today, so doing it just for SwiftBot would be inconsistent).
- Deploying the backend changes to production: the migration (`prisma migrate deploy`, not `migrate dev`) and new code still need to be applied to the real RDS database and EC2 instance — everything above was built and verified against a local Postgres database, production has not been touched.
