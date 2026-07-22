# Performance Audit — Tasks Completed

Site-wide effort to cut redundant backend requests and make navigation feel instant.
Aggressive caching posture: rely on the existing SSE/socket realtime layer + mutation
cache-patching for freshness. Spans the frontend (`swiftnine-dashboard-frontend`) and the
sibling backend (`swiftnine-dashboard-backend`).

**Status:** all phases done. Both repos build clean. Nothing committed yet.

---

## Phase 1 — Global React Query config + kill forced refetches

- [x] `src/lib/queryClient.ts` — `refetchOnWindowFocus: false`, default `staleTime` 30s → 60s,
      `gcTime` 5min → 30min (kept `refetchOnReconnect: true`).
- [x] Explicit `staleTime: 5min` on slow-changing queries:
  - `src/context/ProjectContext.tsx`, `src/context/DocsContext.tsx`, `src/context/TaskListContext.tsx`
  - `src/hooks/useWorkspaceTags.ts`, `useFavorites.ts`, `useChannelList.ts`, `useProfile.ts`
  - `src/hooks/useUniversityDashboard.ts`, `useCourseLibrary.ts`, `useMyLearning.ts`
  - `src/components/projects/TaskDashboardHome.tsx`
  - `src/hooks/useWorkspaceMembers.ts` (10s → 60s)
- [x] Removed forced refetch of already-cached data:
  - `src/layout/AppHeader.tsx` — deleted the `fetchProfile()` mount effect (useProfile already fetches).
  - `src/components/channels/AddMembersModal.tsx` — dropped `invalidateQueries(["workspace-members"])` on open.
  - `src/components/channels/ChannelChatView.tsx` — dropped members refetch on sidebar toggle.

**Effect:** switching browser tabs no longer refetches every list; structural data is reused within the session.

---

## Phase 2 — Route-scope providers + dedup uncached fetches

- [x] Moved `ProjectProvider`, `TaskListProvider`, `DocsProvider` out of `src/app/layout.tsx`
      into `src/app/(admin)/AdminLayoutClient.tsx`. University/auth/full-width pages no longer
      fire `GET /projects` or `GET /docs`. (Verified no non-admin route consumes these contexts.)
- [x] New shared hook `src/hooks/useStatuses.ts` — caches the grouped statuses response under
      `["statuses", projectId]`, exposes a flattened selector.
- [x] `src/components/projects/TasksPage.tsx` — uses `useStatuses` (removed its inline query).
- [x] `src/components/projects/EditSpaceModal.tsx` — invalidates `["statuses", projectId]` after
      editing statuses (needed now that statuses are cached 5 min).
- [x] `src/lib/queryPersister.ts` — bumped `QUERY_CACHE_BUSTER` `v1` → `v2` (statuses cache shape
      changed from flattened array to grouped object).

**Not done (intentional):**
- WorkspaceContext → React Query migration — **deferred**. Risky refactor of the area behind the
  earlier list-restore bug; `GET /workspaces` fires only once per session (low benefit).
- WorkspaceSettingsPage members swap — **skipped**. Its People tab shows PENDING invites, which the
  shared `useWorkspaceMembers` hook filters out; swapping would drop pending invitees (not truly redundant).

---

## Phase 3 — Stop refetching collections after mutations

- [x] `src/context/TaskListContext.tsx` — removed `await refetchProjects()` from `createList`,
      `archiveList`, `restoreList`, `deleteList` (4 full `GET /projects` calls eliminated).
      The only field they refreshed (`_count.taskLists`) is never rendered; list display comes from
      the already-patched task-lists cache. Removed the now-unused `useProjects` import.

**Left as-is (intentional):** `useFavorites` invalidate-on-toggle — infrequent user action, two cheap
calls, correctness-safe; optimistic "add" would need the full object (fragile).

---

## Phase 4 — N+1 / waterfalls (frontend + backend)

### Backend (`swiftnine-dashboard-backend`)
- [x] New endpoint `GET /api/v1/tasks/batch?ids=a,b,c` — bulk task lookup.
  - `apps/api/src/task/task.controller.ts` — `findManyByIds` handler, placed **before** `@Get(':taskId')`.
  - `apps/api/src/task/task.service.ts` — `findManyByIds()` (workspace + unlocked-project scoped,
    `TASK_LIST_ITEM_SELECT` + `creator`); new exported types `UserBrief`, `TaskListItemWithCreator`.
  - `apps/api/src/task/dto/list-task-ids.dto.ts` — new Zod DTO (`uuidCsvOrArray`).
  - `apps/api/src/task/task.constants.ts` — exported `USER_BRIEF_SELECT`.

### Frontend
- [x] `src/services/task.service.ts` — added `getByIds(ids)` → `GET /tasks/batch`; new
      `TaskListItemWithCreator` type.
- [x] `src/components/inbox/InboxPage.tsx` — replaced the per-notification
      `Promise.allSettled(map(taskService.get))` N+1 with a single `getByIds` batch call
      (keeps `creator`, so actor avatars/names are unchanged).
- [x] `src/app/(admin)/(others-pages)/my-tasks/page.tsx` — `fetchMyTasks` now fetches page 1, then
      requests the remaining pages (cap 5) in **parallel** instead of serially.

---

## Phase 5 — Cleanup

- [x] `src/lib/universityApi.ts` — removed the `console.debug` token log that ran on every LMS request.

---

## Verification

**Automated (done):** frontend `npm run build` ✓ · backend `npm run build` ✓ · changed files lint-clean
(remaining lint errors are all pre-existing in untouched code).

**Manual (please spot-check in browser — Network tab):**
- [ ] `/projects`: switch to another browser tab and back → no burst of refetches.
- [ ] `/university/*`: confirm **no** `GET /projects` or `GET /docs` requests fire.
- [ ] Navigate `/projects` → `/docs` → `/university` → back: lists served from cache within staleTime.
- [ ] Inbox with task-linked notifications → a single `GET /tasks/batch?ids=…` (not many `GET /tasks/:id`).
- [ ] Create/delete a list → sidebar updates with **no** `GET /projects` call.
- [ ] Edit a project's statuses → board reflects the changes (no stale statuses).
- [ ] Log out / switch workspace → persisted caches cleared (no cross-user/workspace leakage).
