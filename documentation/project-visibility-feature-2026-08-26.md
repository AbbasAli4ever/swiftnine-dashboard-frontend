# Project visibility (PUBLIC / PRIVATE) — [2026-08-26]

> **Update — see the "Follow-up: [2026-08-26] Password protection removed"
> section at the bottom of this doc.** The password-lock feature this entry
> references throughout (`assertPasswordManager`, `getLockStatus`,
> `PROJECT_SECURITY_PROJECT_SELECT` including `passwordHash`, the "locked"
> stub in list responses, `project-password.controller.ts`, and every
> `Project*` table below other than `ProjectMember`) **no longer exists** —
> it was fully removed the same day, superseded by this visibility feature.
> Everything below is left as-written, describing the state at the moment
> this feature shipped; it is not a description of the current codebase.

New feature: every project now has a `visibility` — `PUBLIC` (default, matches every project's behavior before this feature existed) or `PRIVATE` (visible only to its creator and explicitly invited members). Planned and confirmed with the user before building — see the four decisions below, each of which shaped the implementation.

## Decisions confirmed before building

| Question | Answer |
|---|---|
| Who can toggle visibility / manage invites? | **Creator only** — no OWNER override, unlike the existing password-lock feature's `canManagePassword` (which does allow OWNER). Deliberate divergence, commented in the code. |
| Does PRIVATE cascade to tasks/lists/board/attachments, or just the project card? | **Cascades to everything** scoped under `:projectId`. |
| What happens to existing assignees when a project is switched PUBLIC → PRIVATE? | **Auto-grandfathered in** as `ProjectMember`s — nobody already doing work on the project silently loses access. |
| Should the existing password-lock feature stay available on PRIVATE projects too? | **No** — private replaces the need for it. Setting a new password on a PRIVATE project is blocked; switching a project to PRIVATE clears any password it already had. |

## Schema

Migration `20260826150000_add_project_visibility`:
- New enum `ProjectVisibility { PUBLIC PRIVATE }`.
- `Project.visibility ProjectVisibility @default(PUBLIC)`.
- New `ProjectMember` table (`projectId`, `userId`, `invitedBy`, `createdAt`, `@@unique([projectId, userId])`, cascade deletes) — same shape as the existing `ProjectFavorite`/`ProjectUnlockSession` precedent. The creator gets a row automatically at creation (self-invited), so "can this user see the project" is always one check — `ProjectMember` — never a separate creator special-case scattered across every consumer.

## Enforcement — one choke point, not one per controller

The actual access check lives in exactly one place: `ProjectSecurityService.findProjectOrThrow(workspaceId, projectId, userId)` (`project-security.service.ts`) — already the function every other project-scoped check in the codebase routes through (`assertUnlocked`, `assertPasswordManager`, `getLockStatus`, and `ProjectUnlockedGuard`, which is already wired into `task-board.controller.ts`, `task-list-tasks.controller.ts`, `task-project-tasks.controller.ts`, `task-list.controller.ts`, `project-attachments.controller.ts`, and `dashboard.controller.ts`). Adding the visibility check there — throwing the *same* `projectNotFoundException()` a genuinely missing project throws, for a PRIVATE project the caller isn't a `ProjectMember` of — made every one of those controllers, plus `project.controller.ts`'s own `findOne`/`update`/`archive`/`restore`/`remove` (which call `assertUnlocked` directly), plus `favorites.service.ts`'s `favoriteProject`/`unfavoriteProject` (same call), enforce the new rule with **zero changes to any guard or controller**. `findProjectOrThrow`'s signature gained a required `userId` param; its three internal callers and the one external caller (`project-password.service.ts`'s `unlockProject`) were updated to pass it through — all five already had `userId` in scope.

`findAll()`/`findArchived()` (the list endpoints) needed a real change, since they don't go through `findProjectOrThrow` per-project: added `visibleToUserFilter(userId)` to the `where` clause — `OR: [{visibility: 'PUBLIC'}, {visibility: 'PRIVATE', members: {some: {userId}}}]`. A PRIVATE project a non-member can't see is **excluded from the query entirely** — unlike the password-lock feature (which still returns a `locked: true` stub so existence is visible), a private project a non-member can't see doesn't appear in the list at all.

**Deliberately not touched**: `channels.controller.ts`'s `listByProject` — channels already have their own independent `ChannelMember`-based access model, unrelated to this feature and out of the scope the user described (tasks/lists/board/attachments).

## Assignee restriction

`assertUsersAreMembers` (workspace-membership check) is unchanged. A new `ProjectSecurityService.assertUsersCanAccessProject(projectId, visibility, userIds)` runs alongside it in both places a task gets assignees: `TaskService.create()` (initial `assigneeIds`) and `TaskService.addAssignees()` (adding to an existing task). For a PUBLIC project it's a no-op (any workspace member, same as before); for PRIVATE it additionally requires every target `userId` to have a `ProjectMember` row for that project.

## New endpoints (`project.controller.ts`)

- `PATCH /projects/:projectId/visibility` — the toggle. Creator-only; clears any existing password and grandfathers in existing assignees when switching to PRIVATE (see below).
- `GET /projects/:projectId/members` — list current members (open to any current member — creator or invited — same "can view" check as everything else).
- `POST /projects/:projectId/members` — invite (creator-only, PRIVATE-only — inviting to a PUBLIC project is rejected with 400, since everyone already has access).
- `DELETE /projects/:projectId/members/:userId` — remove (creator-only; the creator themselves can't be removed; also **strips the removed user as an assignee from every task in the project** in the same transaction, since a dangling assignee reference to a project they can no longer open would be broken, not just stale).

## `updateVisibility()` transaction (`project.service.ts`)

On PUBLIC → PRIVATE: clears `passwordHash`/`passwordSetBy`/`passwordUpdatedAt` if a password was set, then finds every distinct `userId` currently assigned to any task in the project (`taskAssignee` joined through `task → list → project`) and `createMany`s `ProjectMember` rows for them (`skipDuplicates`), so nobody already doing work on the project is silently locked out. On PRIVATE → PUBLIC: just flips the flag — existing `ProjectMember` rows are left in place (cheap, reversible if toggled back).

## Verification

- `tsc --noEmit`, `nest build api` — clean.
- `eslint` — isolated true new errors from pre-existing formatting debt via a `git stash` baseline diff on every touched file (this codebase's established methodology), since several touched files carry substantial pre-existing CRLF-formatting debt unrelated to this change. 14 genuinely new errors found and hand-fixed (line-wrapping on newly-added lines only); confirmed post-fix count matches the pre-change baseline exactly on every file.
- Full test suite: identical to the established baseline (345 passed, 26 pre-existing failures, 9 failed suites, 371 total) — no regression.
- **Live, end-to-end, three real accounts** in the demo workspace (`811785b9-...`): the existing `demo-accountant@swiftnine.local` (OWNER, project creator), plus two newly registered accounts added specifically for this test — `private-project-test@swiftnine.local` ("tester", later invited) and `private-project-outsider@swiftnine.local` ("outsider", never invited). Both registered through the real `/auth/register` endpoint; since neither has a reachable inbox, `isEmailVerified` was flipped directly via a one-off Prisma script (the only non-HTTP step) so every subsequent step — login, workspace membership, and all project/task calls — went through real HTTP as this project's testing convention requires.

  | Step | Result |
  |---|---|
  | Create project (no visibility specified) | `visibility: "PUBLIC"` |
  | Tester sees it in `GET /projects` and `GET /projects/:id` while PUBLIC | ✅ 200 |
  | Toggle to PRIVATE as creator | ✅ 200 |
  | Tester: list no longer includes it; `GET /projects/:id`, `/lists`, `/board/tasks`, `/tasks`, `/attachments` | all `404` |
  | Outsider: `GET /projects/:id` | `404` |
  | Invited member (not creator) tries to toggle visibility / invite someone | `403` (not 404 — confirms the creator-only check runs *after* the view check, distinguishing "can't see it" from "can see it, can't manage it") |
  | Invite tester | `201`; inviting the same user again | `409` |
  | Tester regains access (list + detail) | ✅ 200 |
  | Assign a task to the invited tester at creation (`assigneeIds`) | `201` |
  | Assign a task to the outsider (never invited) at creation | `400` |
  | `addAssignees` (existing-task path) to the outsider | `400` — confirms both assignee code paths are covered |
  | Remove tester as a member | `200`; tester loses project access (`404`); the task's `assignees[]` automatically drops tester (auto-unassigned) |
  | Attempt to remove the creator from the member list | `400` |
  | Set a password on the still-PRIVATE project | `400` |
  | Toggle back to PUBLIC | `200` |
  | Invite someone while PUBLIC | `400` (cannot invite to a public project) |
  | While PUBLIC, assign a task to the outsider (allowed — everyone has access) | `201` |
  | Toggle to PRIVATE again | `200`; `GET /projects/:projectId/members` afterward shows the outsider auto-grandfathered in | ✅ |
  | Outsider's access after the grandfathering toggle | `200` (still has access, without ever being explicitly invited) |

  **Per explicit instruction, none of this test data was removed** — the project (`Private Visibility Test Project`, `PPTEST` prefix), its task list and two tasks, both `ProjectMember` invites, and both newly created test user accounts (added to the demo workspace as plain `MEMBER`s) are all still live in the `811785b9-...` workspace.

## Follow-up: [2026-08-26] Password protection removed

Requested directly: remove the project password-lock feature entirely. It had already been narrowed to PUBLIC-only projects earlier the same day (private replaces the need for it — see the decisions table above); this follow-up removes the remaining code, schema, and docs.

### The real scope: much bigger than "delete project-security's password files"

`ProjectSecurityService.findProjectOrThrow` — the exact function this feature's own "Enforcement" section above describes as the single PRIVATE-visibility choke point — was **also** the password-lock's choke point. Both concerns shared one call graph. Before touching anything, mapped every caller: `assertUnlocked` alone had ~50 call sites across **19 unrelated modules** (activity, chat, docs, comments, time-entry, notifications, status, attachments, favorites, dashboard, channels — none of them password-specific, all of them needing the *visibility* check to keep working). Naively deleting `ProjectSecurityService` would have broken PRIVATE-project enforcement everywhere, not just removed passwords.

**Resolution**: kept `findProjectOrThrow`, `assertUnlocked` (now a thin passthrough to `findProjectOrThrow`), `assertUsersCanAccessProject`, `activeUnlockedProjectIds`, and `activeUnlockedWorkspaceProjectIds` — every one of their ~50 call sites needed **zero changes**, since the method names, signatures, and "which project ids can this user see" contract stayed identical; only the internal logic (password/unlock-session checks) was stripped out, replaced with pure `visibility`/`ProjectMember` checks. **Deliberately not renamed**, despite "Unlocked"/"locked" now being stale terminology: renaming would have meant touching those same ~50 call sites across 19 modules purely for cosmetics, which is exactly the "refactor adjacent systems as a side effect" this project's own working conventions rule out. Commented clearly in the code instead. A few dozen *local* variable names in those 19 files (`lockedProjectIds`, `passwordProtectedProjectIds`, etc.) are similarly stale but left alone for the same reason — each was one-file-local, so the cost/benefit of renaming was different from the shared service, but still not worth the diff for a pure rename.

### Removed entirely

- **Schema** (migration `20260826170000_remove_project_password_protection`): `Project.passwordHash`/`passwordSetBy`/`passwordUpdatedAt` and its `passwordSetter` relation; the `ProjectUnlockSession`, `ProjectUnlockAttempt`, `ProjectPasswordResetToken` tables in full; the matching `User` back-relations. Verified no real password data existed before dropping (`prisma db push` completed without a data-loss prompt).
- **Files**: `project-password.service.ts`, `project-password.controller.ts` (7 routes: set/change/remove password, unlock, lock-status, reset-request, reset-confirm), `project-unlock.service.ts`, `project-reset.service.ts`, `project-realtime-lock.service.ts`, `project-security-cleanup.service.ts` (the background pruning job for all of the above), their 5 request DTOs, and their 2 dedicated spec files.
- **Dead-ended real-time plumbing**: `ChatGateway`/`DocsGateway` each subscribed to `ProjectRealtimeLockService.lockChanged$` to evict connected sockets from a project's rooms and emit a `project:lock-changed` event when a password changed — `evictProjectChannels`/`evictProjectDocs` (and `DocsGateway`'s now-orphaned `leaveSocketIdFromRoom` helper) removed along with it. This isn't replaced by anything — real-time eviction when a project's *visibility* changes was not requested and is out of scope for a removal.
- **Docs**: `project-password-protection.md`, `project-password-protection-feature-implementation-plan.md`, `project-password-protection-frontend-integration.md` deleted outright (would otherwise describe a feature that no longer exists).

### The other ~15 call sites: not just deletions, real query rewrites

Beyond the 19 modules whose calls needed no change, several had also queried `Project.passwordHash` **directly** (bypassing the service) as a fast-path optimization — e.g. "skip the unlock check entirely if nothing's locked." Each of these needed an actual rewrite, not just a deleted line: `activity.service.ts` (`buildLockedProjectExclusion`, renamed `buildInaccessibleProjectExclusion` — its only call site, so renamed freely), `attachments.service.ts`, `chat.gateway.ts` (plus removing the dead lock-eviction subscription), `chat.service.ts`, `docs/doc-search.service.ts`, `docs/docs.service.ts`, `favorites.service.ts` (`listProjectFavorites` — previously returned a `{locked: true}` stub for a locked-but-visible project; now, consistent with how PRIVATE projects already behave everywhere else in this feature, an inaccessible project is **filtered out of the favorites list entirely** rather than shown as a stub), `notifications.service.ts`, `task.service.ts` (2 sites), `time-entry.service.ts`. In most of these, since `activeUnlockedProjectIds`/`activeUnlockedWorkspaceProjectIds` now already fold "PUBLIC is always accessible" into their own result set, the old two-step pattern (fetch `passwordHash` → split into always-visible vs. needs-unlock-check → call the service only for the locked subset) collapsed into a single direct call — several of these files got **shorter**, not longer.

### Verification

- `tsc --noEmit`, `nest build api` — clean.
- `eslint` — same baseline-diff methodology as the rest of this project. Every touched file's post-change error count came out **at or below** its pre-change baseline (several dropped significantly, e.g. `favorites.service.ts` 24→6, `task.service.ts` 136→133) — expected, since this was a net code-deletion change. The handful of genuinely new formatting issues (multi-line calls needing to wrap) were hand-fixed.
- Full test suite: **9 failed suites, 26 failed tests, 337 passed, 363 total** — identical to the established baseline in every count except total (down from 371, exactly matching the 8 tests in the two deleted spec files). Two spec files needed real updates, not just deletion, because they asserted on the exact query shape that changed: `attachments.service.spec.ts` (asserted the old `OR: [{passwordHash: null}, {id: {in:...}}]` shape — updated to the simplified `id: {in:...}` clause) and `notifications.service.spec.ts` (mocked `prisma.project.findMany` returning `passwordHash`, which `filterVisibleNotificationsForUser` no longer calls at all — updated to mock `projectSecurity.activeUnlockedProjectIds` directly, matching how the method actually gets its answer now).
- No live re-verification of the full private-project E2E flow was re-run after this change — the existing test data and assertions above (from the visibility feature's own verification) still hold, since `assertUnlocked`/`findProjectOrThrow`'s external contract didn't change, only its internal password check was removed. Live-checked specifically: `PATCH /projects/:id/password` style routes are gone from the router (the whole controller was deleted), and `PATCH /projects/:projectId/visibility`, `GET/POST/DELETE .../members`, and ordinary project/task access continue to work exactly as documented above.

## Follow-up: [2026-08-27] Create-time visibility, invite picker, batch invite — plus a 404-vs-403 fix found along the way

Three additions, requested directly after walking through the invite UX: (1) `visibility` settable at project creation, not just via the toggle afterward; (2) a combined endpoint for the invite picker instead of the frontend cross-referencing two separate member lists; (3) a batch-invite endpoint so a multi-select picker can grant access to several people in one call. All three confirmed with the user before building, including the decision to keep the existing single-invite endpoint alongside the new batch one rather than replace it.

### 1. `visibility` at creation

`CreateProjectDto` gained an optional `visibility: 'PUBLIC' | 'PRIVATE'` field, defaulting to `PUBLIC` (unchanged behavior for every existing caller). `ProjectService.create()` passes it straight into the `project.create()` call — no other change was needed, since the creator was already being auto-inserted as the sole `ProjectMember` unconditionally, regardless of visibility. A project created as `PRIVATE` is private from its very first moment; there's no window where it was briefly visible workspace-wide before an immediate follow-up toggle, the way the old two-step (`create` then `PATCH .../visibility`) flow required.

### 2. `GET /projects/:projectId/members/candidates`

Creator-only. Returns every workspace member (`GET /workspaces/:workspaceId/members`'s population) each annotated with `isProjectMember` and `isCreator`, computed server-side from a `ProjectMember` lookup — so the frontend renders the invite picker directly from one response instead of fetching the workspace member list and the project member list separately and diffing them itself. Not restricted to PRIVATE projects (harmless, just less useful, on a PUBLIC one where everyone already has access).

### 3. `POST /projects/:projectId/members/batch`

Mirrors `WorkspaceService.addMembersByUserIds`'s existing shape exactly (`BatchAddMembersDto`/`BatchAddResponseDto` in the workspace module) rather than inventing a new one: `{ userIds: string[] }` (max 50, same cap), each id processed independently inside a `try/catch` so one bad id doesn't fail the batch, returning a `results[]` (`invited` / `already_member` / `failed`, with a message on failure) plus a `summary` (`total`/`invited`/`alreadyMember`/`failed`). Same creator-only, PRIVATE-only rules as the single-invite endpoint, which is kept as-is alongside this one — the single endpoint stays useful for a one-off "add just this person" action; the batch endpoint is for multi-select.

### Bug found and fixed while live-testing: non-members got 403, not 404

Testing the new candidates endpoint against a genuine non-member returned `403` ("Only the project creator can...") instead of `404`. Tracing it: `inviteMember`, `removeMember`, and (inheriting the same pattern) the new `listMemberCandidates` all did their own raw `prisma.project.findFirst` and checked `createdBy` directly — never routing through `ProjectSecurityService.assertUnlocked`/`findProjectOrThrow`, the function that actually enforces "can this user see the project at all" for PRIVATE projects. A non-member calling any of these three got far enough to fail the *creator* check, and 403 (vs. 404) is itself a signal that the project exists — exactly the existence leak this feature's own design was built to avoid (`updateVisibility` already did this correctly, by calling `assertUnlocked` first; these three didn't).

**Fix**: `assertCanManageInvites` (the shared helper for `inviteMember`/`inviteMembersBatch`), `removeMember`, and `listMemberCandidates` now all call `projectSecurity.assertUnlocked(...)` first — which already returns `{createdBy, visibility, ...}`, so the second, now-redundant raw project query was deleted too, not just reordered. A non-member now gets `404` from every project-membership-management endpoint, uniformly; a real member who isn't the creator still correctly gets `403` (they can see the project, they just can't manage it) — verified both cases live, not just the fix.

### Verification

- `tsc --noEmit`, `nest build api` — clean.
- `eslint` — baseline-diffed as usual; final count matched the pre-round baseline exactly (28=28) after hand-fixing the handful of genuinely new lines.
- Full test suite: `9 failed suites / 26 failed tests / 337 passed / 363 total` — identical to the established baseline, no regression.
- **Live**, demo workspace, same three accounts as the original feature build:
  - `POST /projects` with `visibility: "PRIVATE"` → created private immediately; a non-member got `404` on it with no prior PUBLIC window.
  - `GET .../members/candidates` → correctly flagged the creator (`isProjectMember: true, isCreator: true`) and two not-yet-invited members (`false, false`).
  - `POST .../members/batch` with `[validId, validId, bogusId]` → `2 invited, 0 alreadyMember, 1 failed` with a per-item message; re-run with one already-invited id → correctly reported `already_member`; attempted while the project was `PUBLIC` → `400`.
  - The 404-vs-403 fix: re-tested all four endpoints (`candidates`, single invite, batch invite, remove) against a genuine non-member (`404` on all, confirmed only after restarting the dev server — the first live check was accidentally run against a stale, pre-fix build since it had been started via a one-shot `nest start`, not `--watch`) and against a real member who isn't the creator (`403`, correctly distinct).
  - Test project deleted after verification (cascades its data); the three shared test accounts were left as they were — nothing else in the workspace was touched.
