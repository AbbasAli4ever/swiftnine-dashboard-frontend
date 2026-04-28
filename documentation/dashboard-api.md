# Dashboard API

Summary
- This backend has one dedicated project overview endpoint under `dashboard`, plus a few task/activity endpoints that the frontend will likely use for the rest of the dashboard experience.
- Most dashboard-facing routes are workspace-scoped. They require:
  - `Authorization: Bearer <token>`
  - `x-workspace-id: <workspace-uuid>`
- Successful non-paginated responses use the envelope:
```json
{ "success": true, "data": {}, "message": null }
```
- Paginated task search uses:
```json
{ "success": true, "data": [], "meta": {}, "message": null }
```

## Common Rules

Authentication and workspace scoping
- `GET /projects/:projectId/dashboard`
- `GET /projects/:projectId/board/tasks`
- `PUT /projects/:projectId/board/tasks/reorder`
- `GET /projects/:projectId/tasks`
- `GET /tasks`
- `GET /activity`
- `GET /tasks/:taskId/activity`

All of the routes above use JWT auth plus `WorkspaceGuard`.

What `WorkspaceGuard` does
- Requires `x-workspace-id`.
- Confirms the authenticated user is an active member of that workspace.
- Adds `workspaceContext = { workspaceId, role }` to the request.

Important data-scoping behavior
- Soft-deleted rows are excluded.
- Archived projects/lists are excluded by default unless an endpoint explicitly supports `include_archived=true`.
- Dashboard overview counts only top-level tasks (`depth = 0`), not subtasks.

## 1. Project Overview Endpoint

Route
- `GET /projects/:projectId/dashboard`

Purpose
- This is the dedicated Overview tab endpoint for a single project.
- It returns a compact aggregate payload for:
  - project identity
  - task counts by status
  - task counts by list
  - attachment metadata across the project
  - a placeholder `docs` array

What it returns
- `project`
  - `id`
  - `name`
  - `color`
  - `icon`
- `statusSummary[]`
  - one row per active project status
  - includes statuses even when `count = 0`
- `lists[]`
  - one row per active, non-archived task list
  - each row includes `taskCount`, `completedCount`, `openCount`
  - each row can also include optional overview metadata:
    - `startDate`
    - `endDate`
    - `ownerUserId`
    - `owner`
    - `priority`
- `attachments[]`
  - newest first
  - includes task context and uploader info
- `docs`
  - currently always `[]`

Important implementation details
- Status rows are ordered by `group`, then `position`.
- Lists are ordered by `position`.
- Attachment rows are ordered by `createdAt desc`, then `id desc`.
- `taskKey` is generated server-side as `project.taskIdPrefix + "-" + task.taskNumber`.
- `fileSize` is converted from Prisma `BigInt` to a normal number before returning.

What it does not return
- It does not return signed attachment URLs.
- It does not return comments, activity, board columns, or task detail.
- It does not include archived lists.
- It does not include subtasks in list/status counts.

Response shape
```json
{
  "success": true,
  "data": {
    "project": {
      "id": "project-1",
      "name": "Backend API",
      "color": "#2563eb",
      "icon": "rocket"
    },
    "statusSummary": [
      {
        "statusId": "status-1",
        "name": "To Do",
        "color": "#94a3b8",
        "group": "NOT_STARTED",
        "position": 1000,
        "count": 1
      },
      {
        "statusId": "status-2",
        "name": "In Progress",
        "color": "#3b82f6",
        "group": "ACTIVE",
        "position": 1000,
        "count": 2
      }
    ],
    "lists": [
      {
        "id": "list-1",
        "name": "Backlog",
        "position": 1000,
        "startDate": "2026-04-24",
        "endDate": null,
        "ownerUserId": "user-1",
        "priority": "HIGH",
        "owner": {
          "id": "user-1",
          "fullName": "Ayesha Khan",
          "avatarUrl": null,
          "avatarColor": "#6366f1"
        },
        "taskCount": 2,
        "completedCount": 0,
        "openCount": 2
      }
    ],
    "attachments": [
      {
        "id": "attachment-1",
        "taskId": "task-1",
        "taskKey": "API-104",
        "taskTitle": "Implement filters",
        "listId": "list-2",
        "listName": "Current Sprint",
        "fileName": "api-contract.pdf",
        "mimeType": "application/pdf",
        "fileSize": 245760,
        "createdAt": "2026-04-24T09:30:00.000Z",
        "uploadedBy": {
          "id": "user-1",
          "fullName": "Ayesha Khan",
          "avatarUrl": null,
          "avatarColor": "#6366f1"
        }
      }
    ],
    "docs": []
  },
  "message": null
}
```

Frontend notes
- Treat `docs` as a placeholder for now.
- `attachments[]` is good for a recent-files widget, but not enough to preview/download files directly.
- Zero-count statuses are intentionally included, so the frontend should render them instead of filtering them out.
- List-level overview metadata is optional. Any of `startDate`, `endDate`, `ownerUserId`, `owner`, or `priority` may be `null`.

## 1.1 Update List Overview Metadata

Route
- `PATCH /projects/:projectId/lists/:listId`

Purpose
- Use this when the user edits a list card/row from the project overview and wants to save optional list metadata.
- This is the same task-list update endpoint; it now supports both renaming a list and updating its dashboard metadata.

What can be updated
- `name`
- `startDate`
- `endDate`
- `ownerId`
- `priority`

Important rules
- List creation still only requires `name`.
- These fields are optional and can be added later from the overview UI.
- `startDate` and `endDate` must be date-only strings in `YYYY-MM-DD` format.
- If both dates are sent, `startDate` cannot be after `endDate`.
- `priority` reuses the existing global enum:
  - `URGENT`
  - `HIGH`
  - `NORMAL`
  - `LOW`
  - `NONE`
- `ownerId` may be either:
  - a `workspaceMemberId`
  - or a `userId`
- The backend resolves `ownerId` to a stored `ownerUserId`.

How to clear optional fields
- Send `null` for:
  - `startDate`
  - `endDate`
  - `ownerId`
  - `priority`

Example request
```json
{
  "startDate": "2026-04-24",
  "endDate": "2026-04-30",
  "ownerId": "workspace-member-or-user-id",
  "priority": "HIGH"
}
```

Example request to clear fields
```json
{
  "ownerId": null,
  "priority": null,
  "endDate": null
}
```

Response shape
- Standard success envelope.
- The returned list includes the saved optional metadata in normalized form.

Example response
```json
{
  "success": true,
  "data": {
    "id": "list-1",
    "projectId": "project-1",
    "name": "Backlog",
    "position": 1000,
    "startDate": "2026-04-24",
    "endDate": "2026-04-30",
    "ownerUserId": "user-1",
    "priority": "HIGH",
    "isArchived": false,
    "createdBy": "user-9",
    "createdAt": "2026-04-20T00:00:00.000Z",
    "updatedAt": "2026-04-27T00:00:00.000Z",
    "owner": {
      "id": "user-1",
      "fullName": "Ayesha Khan",
      "avatarUrl": null,
      "avatarColor": "#6366f1"
    }
  },
  "message": "Task list updated successfully"
}
```

Frontend recommendation
- Use the `owner` object for display.
- Use `ownerUserId` for saved/current state checks.
- If your picker is based on workspace members, it is safe to submit `workspaceMemberId` as `ownerId`.
- If the overview screen allows partial edits, send only the fields that changed.

## 2. Project Board Endpoints

### Get board

Route
- `GET /projects/:projectId/board/tasks`

Purpose
- Returns the project board grouped by status.
- This is the board/tab endpoint, not the overview endpoint.

Behavior
- Every active project status is returned as a board column, even if it has zero tasks.
- Tasks are ordered inside each column by `boardPosition`.
- It accepts the same task search/filter query params as the general task search endpoints.

Useful filters
- `q`
- `status_ids`
- `status_groups`
- `priority` / `priorities`
- `assignee_ids` or `assignee`
- `me`
- `tag_ids`
- `due_date`
- `include_closed`
- `include_subtasks`
- `completed`

Defaults worth knowing
- `include_subtasks = false`
- `include_closed = true`
- `include_archived = false`
- `me = false`

Response shape
- `data.groupBy` is always `"status"`
- `data.columns[]` contains:
  - `status`
  - `tasks`
  - `total`

### Reorder board

Route
- `PUT /projects/:projectId/board/tasks/reorder`

Purpose
- Use this for board drag/drop.

Behavior the frontend must respect
- `orderedTaskIds` must contain the full final order of all active top-level tasks in the destination status column.
- It is not enough to send only the moved card plus neighbors.
- Subtasks cannot be dragged on the board.
- If `toStatusId` changes, the task status changes too.
- If `toListId` is sent, the task can also move to another list.
- After board reorder, the backend also rewrites list `position` values to keep list view aligned with board ordering.

Very important response note
- The reorder endpoint returns a fresh board snapshot using the backend default board query.
- It does not preserve whatever filters the frontend used on the original board request.
- That returned snapshot effectively uses:
  - `include_subtasks = false`
  - `include_closed = true`
  - `include_archived = false`
  - no search/filter params

Frontend recommendation
- If the UI supports filtered board views, treat the reorder response as a success confirmation only, then refetch the board with the user’s active filters.

## 3. Task Search Endpoints Used by Dashboard Widgets

### Workspace-wide task search

Route
- `GET /tasks`

Purpose
- Use this for global task widgets, My Tasks, home/dashboard cards, and assignee-focused views.

### Project-scoped task search

Route
- `GET /projects/:projectId/tasks`

Purpose
- Same search model as `GET /tasks`, but limited to one project.

Returned task shape
- Each item includes:
  - `id`
  - `taskId` like `CU-104`
  - `taskNumber`
  - `title`
  - `priority`
  - `startDate`
  - `dueDate`
  - `position`
  - `boardPosition`
  - `depth`
  - `isCompleted`
  - `completedAt`
  - `createdAt`
  - `updatedAt`
  - `status`
  - `assignees`
  - `tags`
  - `list`
  - `_count.children`

Search/filter details that matter
- `q` searches:
  - title
  - description
  - status name
  - tag name
  - assignee full name
  - task number if the search text looks like a task key/number
- `me=true` adds the current user to the assignee filter.
- `assignee=unassigned` is supported.
- `assignee_match=all` requires all selected assignees.
- `tag_match=all` requires all selected tags.
- If `status_groups` is not provided and `include_closed=false`, closed statuses are filtered out.

Frontend recommendation
- Use `GET /tasks` for cross-project widgets.
- Use `GET /projects/:projectId/tasks` for project-specific tables/cards.
- Use `GET /projects/:projectId/board/tasks` only for board UI, not for a generic task list.

## 4. Activity Endpoints for Dashboard Cards

### Workspace/project activity

Route
- `GET /activity`

Purpose
- Use this for recent activity cards.
- You can scope it to a project with `projectId`.
- This is the endpoint the project dashboard should call for "Recent Activity".
- Recent activity is not embedded inside `GET /projects/:projectId/dashboard`; fetch it separately from this route.

Recommended dashboard request
- `GET /activity?projectId=<projectId>&limit=10`
- Send the same auth headers used by the rest of the dashboard routes:
  - `Authorization: Bearer <token>`
  - `x-workspace-id: <workspace-uuid>`

What project scoping includes
- the project row itself
- activity on that project's statuses
- activity on that project's task lists
- activity on tasks in that project
- related comment activity for those tasks
- related attachment activity for those tasks
- related time-entry activity for those tasks

Useful query params
- `projectId`
- `listId`
- `taskId`
- `q`
- `actorIds`
- `actions`
- `categories`
- `me`
- `from`
- `to`
- `cursor`
- `limit`

Common dashboard examples
- Most recent project activity:
  - `GET /activity?projectId=project-uuid&limit=10`
- Only comments and file activity:
  - `GET /activity?projectId=project-uuid&categories=comments,attachments&limit=10`
- Only my activity in that project:
  - `GET /activity?projectId=project-uuid&me=true&limit=10`
- Paginate older activity:
  - `GET /activity?projectId=project-uuid&limit=10&cursor=<nextCursor>`

Response shape
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "activity-1",
        "kind": "activity",
        "category": "status",
        "entityType": "task",
        "entityId": "task-1",
        "action": "status_changed",
        "fieldName": "status",
        "oldValue": "To Do",
        "newValue": "In Progress",
        "metadata": {
          "taskTitle": "Implement filters",
          "projectId": "project-1",
          "listId": "list-2"
        },
        "actor": {
          "id": "user-1",
          "fullName": "Ayesha Khan",
          "email": "ayesha@example.com",
          "avatarUrl": null,
          "avatarColor": "#6366f1"
        },
        "displayText": "Ayesha Khan changed status from To Do to In Progress",
        "createdAt": "2026-04-27T09:15:00.000Z"
      },
      {
        "id": "activity-2",
        "kind": "activity",
        "category": "attachments",
        "entityType": "attachment",
        "entityId": "attachment-1",
        "action": "file_uploaded",
        "fieldName": null,
        "oldValue": null,
        "newValue": null,
        "metadata": {
          "taskId": "task-1",
          "taskTitle": "Implement filters",
          "taskNumber": 104,
          "projectId": "project-1",
          "projectName": "Backend API",
          "listId": "list-2",
          "listName": "Current Sprint",
          "fileName": "api-contract.pdf",
          "mimeType": "application/pdf",
          "fileSize": 245760
        },
        "actor": {
          "id": "user-2",
          "fullName": "Ali Raza",
          "email": "ali@example.com",
          "avatarUrl": null,
          "avatarColor": "#0ea5e9"
        },
        "displayText": "Ali Raza updated attachments on Implement filters",
        "createdAt": "2026-04-27T08:55:00.000Z"
      }
    ],
    "nextCursor": "activity-2"
  },
  "message": null
}
```

Useful item fields
- `category`
- `entityType`
- `entityId`
- `action`
- `fieldName`
- `oldValue`
- `newValue`
- `metadata`
- `actor`
- `displayText`
- `createdAt`

Frontend usage notes
- Use `displayText` directly for the simple activity line in a dashboard card.
- Use `actor`, `category`, and `createdAt` for avatar, badge, and timestamp UI.
- Use `metadata.taskTitle`, `metadata.fileName`, `metadata.projectName`, and similar fields when you want richer custom rendering.
- Use `nextCursor` for "Load more" or infinite scroll behavior.
- If you only need a small dashboard widget, request a small `limit` like `5` or `10`.

### Task side-panel activity

Route
- `GET /tasks/:taskId/activity`

Purpose
- Use this for a task detail side panel or activity drawer.

## 5. Attachment Follow-up Endpoint

Dashboard overview only returns attachment metadata. To actually open files, use:

Route
- `POST /attachments/view`

Request body
```json
{
  "taskId": "task-uuid",
  "memberId": "current-user-id-or-workspace-member-id"
}
```

Important note
- `memberId` can be either the workspace member ID or the user ID. The backend resolves both.
- This route is JWT-protected, but it does not use `x-workspace-id`.

Frontend recommendation
- Do not expect signed URLs in the dashboard overview response.
- Fetch signed URLs lazily when the user opens a file preview or attachment list.

## 6. Known Gaps / Current Limitations

- `docs` in the dashboard overview is reserved for future work and currently returns `[]`.
- Dashboard overview attachments do not include signed URLs.
- Board reorder returns a default board snapshot, not a filter-preserving snapshot.
- Overview counts ignore subtasks because only top-level tasks are aggregated.

## 7. Suggested Frontend Data Flow

Overview page
1. Call `GET /projects/:projectId/dashboard`.
2. Render project header, status summary, per-list stats, and recent attachments.
3. In parallel, call `GET /activity?projectId=<projectId>&limit=<n>` for the Recent Activity card.
4. Render each activity row from `data.items`.
5. If the user clicks an attachment, call `POST /attachments/view` for that task.

Board page
1. Call `GET /projects/:projectId/board/tasks` with the active board filters.
2. Render columns from `data.columns`.
3. On drag/drop, call `PUT /projects/:projectId/board/tasks/reorder`.
4. After success, refetch `GET /projects/:projectId/board/tasks` with the same filters if the board was filtered.

Task widgets
1. Use `GET /tasks` for global widgets.
2. Use `GET /projects/:projectId/tasks` for project-level widgets.
3. Use the shared task query params for tabs like My Tasks, Unassigned, Overdue, Done, etc.
