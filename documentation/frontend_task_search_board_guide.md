# FocusHub — Frontend Guide for Task Search, List View, and Board View

This document is the frontend handoff for the task discovery and board APIs.

It explains:

- which endpoint to call for each screen
- how search and filters should be sent
- how list ordering and board ordering work
- when drag/drop reorder is allowed
- how to handle valid vs invalid board moves

Base URL:

```text
/api/v1
```

All task endpoints in this document require:

```http
Authorization: Bearer <access_token>
x-workspace-id: <workspace_uuid>
```

---

## 1. Which Endpoint to Use

### Workspace-wide task search

Use:

```http
GET /api/v1/tasks
```

Use this for:

- global search
- My Tasks
- dashboard task widgets
- assigned-to-user views

---

### Project-wide task search

Use:

```http
GET /api/v1/projects/:projectId/tasks
```

Use this for:

- project task search
- project-level filtered task tables
- project “all tasks” views across all lists

---

### List view tasks

Use:

```http
GET /api/v1/projects/:projectId/lists/:listId/tasks
```

Use this for:

- a single list screen
- list table view
- list-local drag/drop reorder

This endpoint is paginated.

---

### Project board view

Use:

```http
GET /api/v1/projects/:projectId/board/tasks
```

Use this for:

- Kanban board grouped by status
- board columns with cards from all project lists

This endpoint is **not paginated**. It returns grouped board columns.

---

## 2. Shared Search and Filter Params

These endpoints support the task search/filter query contract:

- `GET /api/v1/tasks`
- `GET /api/v1/projects/:projectId/tasks`
- `GET /api/v1/projects/:projectId/lists/:listId/tasks`
- `GET /api/v1/projects/:projectId/board/tasks`

Common params:

| Param | Example | Meaning |
| --- | --- | --- |
| `q` | `login bug` | Instant search text |
| `search` | `login bug` | Alias for `q` |
| `status_ids` | `uuid1,uuid2` | Selected statuses |
| `status_groups` | `ACTIVE,DONE` | High-level status groups |
| `priority` | `HIGH,URGENT` | Selected priorities |
| `due_date` | `today_or_earlier` | Due date preset |
| `due_date_from` | `2026-04-01` | Due date range start |
| `due_date_to` | `2026-04-30` | Due date range end |
| `assignee_ids` | `user1,user2` | Filter by assignees |
| `me` | `true` | Current user assigned tasks |
| `tag_ids` | `tag1,tag2` | Filter by tags |
| `include_subtasks` | `true` | Show subtasks as rows/cards |
| `include_closed` | `false` | Hide closed statuses |
| `include_archived` | `true` | Include archived lists/projects where supported |
| `page` | `1` | Page number for paginated endpoints |
| `limit` | `20` | Page size for paginated endpoints |
| `sort_by` | `due_date` | Sort field |
| `sort_order` | `asc` | Sort direction |

Frontend behavior:

- debounce `q` requests by about `250-400ms`
- when search/filter changes, reset `page=1`
- clear search by removing `q` and `search`
- clear all filters by removing all active filter params

---

## 3. Response Shapes

### Paginated task list response

Used by:

- `GET /api/v1/tasks`
- `GET /api/v1/projects/:projectId/tasks`
- `GET /api/v1/projects/:projectId/lists/:listId/tasks`

Shape:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "taskId": "CU-104",
      "taskNumber": 104,
      "title": "Implement task board reorder",
      "priority": "HIGH",
      "startDate": null,
      "dueDate": "2026-04-30T18:00:00.000Z",
      "position": 2000,
      "depth": 0,
      "isCompleted": false,
      "completedAt": null,
      "createdAt": "2026-04-24T12:00:00.000Z",
      "updatedAt": "2026-04-24T12:30:00.000Z",
      "status": {
        "id": "uuid",
        "name": "In Progress",
        "color": "#3b82f6",
        "group": "ACTIVE"
      },
      "assignees": [],
      "tags": [],
      "list": {
        "id": "uuid",
        "name": "Sprint",
        "project": {
          "id": "uuid",
          "name": "ClickUp Clone",
          "taskIdPrefix": "CU"
        }
      },
      "_count": {
        "children": 0
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "total_pages": 1,
    "has_next": false,
    "has_prev": false
  },
  "message": null
}
```

Important fields frontend can rely on:

- `taskId` for human-readable key like `CU-104`
- `position` for manual list ordering
- `assignees[].user.fullName`
- `assignees[].user.avatarUrl`
- `assignees[].user.avatarColor`
- `list.id`
- `list.name`
- `status.id`
- `status.name`
- `status.group`

---

### Board response

Used by:

```http
GET /api/v1/projects/:projectId/board/tasks
```

Shape:

```json
{
  "success": true,
  "data": {
    "groupBy": "status",
    "projectId": "uuid",
    "columns": [
      {
        "status": {
          "id": "uuid",
          "name": "In Progress",
          "color": "#3b82f6",
          "group": "ACTIVE",
          "position": 2000,
          "isDefault": true,
          "isProtected": false,
          "isClosed": false
        },
        "tasks": [],
        "total": 0
      }
    ],
    "total": 0
  },
  "message": null
}
```

Board columns are always statuses.

Each board card is the same task shape used in list/search responses.

---

## 4. The Ordering Model

This is the most important rule.

There is **one canonical task ordering model**:

- `TaskList.position` decides which list comes first in a project
- `Task.position` decides which task comes first inside that list

Board view does **not** have a separate board-only order field.

Board order is derived from:

```ts
orderBy: [
  { list: { position: 'asc' } },
  { position: 'asc' },
  { id: 'asc' }
]
```

That means:

- list reorder changes board stacking
- task reorder changes both list view and board view
- board reorder rewrites real task `position` values in affected lists

### Example

Project lists:

```text
List 1
List 2
```

Tasks:

```text
List 1: 1, 2, 3
List 2: 4, 5
```

Board column order becomes:

```text
1, 2, 3, 4, 5
```

If List 2 is reordered above List 1, board becomes:

```text
4, 5, 1, 2, 3
```

---

## 5. List Reorder

List-local reorder already exists:

```http
PUT /api/v1/projects/:projectId/lists/:listId/tasks/reorder
```

Payload:

```json
{
  "taskIds": ["task-1", "task-2", "task-3"]
}
```

Rules:

- payload must include every active top-level task in that list exactly once
- use this only inside a single list screen

Use this when:

- dragging within list view
- manual sort inside one list

---

## 6. Board Reorder

Use:

```http
PUT /api/v1/projects/:projectId/board/tasks/reorder
```

Payload:

```json
{
  "mode": "manual",
  "taskId": "uuid",
  "toStatusId": "uuid",
  "toListId": "uuid-optional",
  "orderedTaskIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

### What each field means

| Field | Meaning |
| --- | --- |
| `mode` | Must be `"manual"` |
| `taskId` | The dragged task |
| `toStatusId` | Destination status column |
| `toListId` | Optional destination list |
| `orderedTaskIds` | Full destination status column order after the move |

### Backend behavior

The backend:

1. validates the task/project/status/list
2. rejects subtasks
3. checks `orderedTaskIds` contains every active top-level task in the destination status
4. checks the requested order is possible under project list order
5. updates:
   - `statusId` if needed
   - `listId` if needed
   - `position` in affected lists

### Important frontend rule

`orderedTaskIds` is not “just the visible cards I moved.”

It must be the **full destination status column after the move**.

If the board UI is filtered and only shows part of the destination column, the frontend should **disable drag/drop** or avoid sending reorder requests.

---

## 7. When Board Drag/Drop Should Be Disabled

Frontend should disable board drag/drop when any of these are true:

- search is active (`q` / `search`)
- non-default filters are active
- custom sort mode is active
- the visible board column is partial / filtered
- the UI cannot provide the full destination column order

Why:

- reorder API requires the full destination status column
- partial reorder can corrupt hidden task order

Recommended rule:

Enable board drag/drop only in **manual unfiltered board mode**.

---

## 8. Impossible Order Rule

A task from a later list cannot appear above tasks from an earlier list unless:

- it moves into that earlier list with `toListId`, or
- the lists themselves are reordered

### Example

Current state:

```text
List 1: 1, 2, 3
List 2: 4, 5
```

Board order:

```text
1, 2, 3, 4, 5
```

If the frontend sends:

```text
5, 1, 2, 3, 4
```

while task `5` still belongs to List 2, the backend rejects it.

Reason:

- List 2 is below List 1 in project order
- so List 2 tasks cannot render above List 1 tasks

How to make that move valid:

1. move task `5` into List 1 with `toListId`, or
2. reorder List 2 above List 1 first

---

## 9. Recommended Frontend Drag Logic

### Drag within same status and same list

- allowed
- send full destination status column order
- backend rewrites affected list positions

### Drag within same status but across lists

- only allow if UI also lets the user choose/change list
- send `toListId`
- otherwise reject on frontend

### Drag across statuses

- allowed
- send `toStatusId`
- if list should change too, also send `toListId`

### Drag while filtered/searching

- disable drag/drop

---

## 10. Suggested UI Rules

### List screen

- use `GET /projects/:projectId/lists/:listId/tasks`
- enable list drag/drop
- use list reorder API

### Board screen

- use `GET /projects/:projectId/board/tasks`
- group by status
- show cards in returned order
- enable drag/drop only in manual unfiltered mode
- on drop, send full destination status column via board reorder API

### My Tasks / Search screens

- use `GET /tasks` or `GET /projects/:projectId/tasks`
- these are search/filter views, not manual reorder views
- do not allow drag/drop reorder here

---

## 11. Example Flows

### A. Instant search in a project

```http
GET /api/v1/projects/:projectId/tasks?q=auth&page=1&limit=20
```

### B. Board fetch

```http
GET /api/v1/projects/:projectId/board/tasks?include_closed=false
```

### C. Move task to another status, same list

```json
{
  "mode": "manual",
  "taskId": "task-4",
  "toStatusId": "status-in-progress",
  "orderedTaskIds": ["task-1", "task-2", "task-5", "task-4"]
}
```

### D. Move task to another status and another list

```json
{
  "mode": "manual",
  "taskId": "task-5",
  "toStatusId": "status-in-progress",
  "toListId": "list-1",
  "orderedTaskIds": ["task-1", "task-5", "task-2", "task-3", "task-4"]
}
```

---

## 12. Error Handling Notes for Frontend

Expected board reorder failures:

| Error case | What frontend should do |
| --- | --- |
| partial destination column payload | refetch board and show light error |
| impossible cross-list order | show message and reset board from refetch |
| task/status/list stale or deleted | refetch board |
| drag in filtered mode | prevent request from being sent |

For board reorder failures, safest recovery is:

1. show toast/snackbar
2. refetch board data
3. reset local optimistic state

---

## 13. Related Docs

- [search_filter.md](./search_filter.md)
- [frontend_integration.md](./frontend_integration.md)
- [api_contracts.md](./api_contracts.md)
- [rbac_permissions.md](./rbac_permissions.md)
