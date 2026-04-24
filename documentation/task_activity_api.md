# GET /tasks/:taskId/activity

Returns a newest-first activity timeline for a single task. Used for the task side panel.

---

## Request

**Method:** `GET`  
**URL:** `/api/v1/tasks/:taskId/activity`

### Path Parameter

| Param | Type | Required | Description |
|---|---|---|---|
| `taskId` | UUID | Yes | ID of the task |

### Headers

| Header | Required | Description |
|---|---|---|
| `Authorization` | Yes | `Bearer <jwt_token>` |
| `x-workspace-id` | Yes | Active workspace ID |

### Query Parameters

All query params are optional.

| Param | Type | Default | Description |
|---|---|---|---|
| `cursor` | UUID | — | Row ID from `nextCursor`. Returns activity **older** than this row (cursor pagination) |
| `limit` | number | `25` | Page size. Max `100` |
| `q` | string | — | Search across action, field name, old/new values, actor name/email |
| `categories` | string (CSV) | — | Filter by ClickUp-style category. See valid values below |
| `actions` | string (CSV) | — | Filter by action name e.g. `status_changed,tag_added` |
| `actorIds` | string (CSV) | — | Filter by user IDs who performed the activity |
| `includeSubtasks` | boolean | `true` | Include activity from direct subtasks |
| `me` | boolean | `false` | Only return activity by the currently authenticated user |
| `from` | ISO datetime | — | Lower bound on `createdAt` e.g. `2026-04-01T00:00:00.000Z` |
| `to` | ISO datetime | — | Upper bound on `createdAt` e.g. `2026-04-30T23:59:59.999Z` |

### Valid `categories` Values

```
task_creation, name, description, status, priority,
start_date, due_date, completion, assignee, tags,
attachments, comments, time_tracked, list_moved,
subtask, archived_deleted, reorder
```

### Example Request

```
GET /api/v1/tasks/5efb9b46-156c-43bb-b7e4-2b4fca537aa7/activity?limit=25&categories=status,assignee&includeSubtasks=true
```

---

## Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "4650c5ff-b89e-4988-9b51-2f6a184c2eba",
        "kind": "activity",
        "category": "status",
        "entityType": "task",
        "entityId": "5efb9b46-156c-43bb-b7e4-2b4fca537aa7",
        "action": "status_changed",
        "fieldName": "status",
        "oldValue": "To Do",
        "newValue": "In Progress",
        "metadata": {
          "taskTitle": "Build activity feed",
          "taskNumber": 42,
          "projectName": "Backend",
          "listName": "Sprint",
          "oldStatusId": "0cfb5a62-6db7-4203-8391-e82ad3f6ed22",
          "newStatusId": "76024116-3fa6-4c8f-8ec6-f8b8561a9757"
        },
        "actor": {
          "id": "3f6c6c5e-4a8f-4f55-8f49-f6e2d15e7f24",
          "fullName": "Ayesha Khan",
          "email": "ayesha@example.com",
          "avatarUrl": "https://cdn.example.com/avatar.png",
          "avatarColor": "#6366f1"
        },
        "displayText": "Ayesha Khan changed status from To Do to In Progress",
        "createdAt": "2026-04-23T09:30:00.000Z"
      },
      {
        "id": "a812f3cc-2201-4d11-b4e0-91c2e8e40012",
        "kind": "activity",
        "category": "assignee",
        "entityType": "task",
        "entityId": "5efb9b46-156c-43bb-b7e4-2b4fca537aa7",
        "action": "assignee_added",
        "fieldName": null,
        "oldValue": null,
        "newValue": "Bilal Raza",
        "metadata": {
          "taskTitle": "Build activity feed",
          "taskNumber": 42,
          "projectName": "Backend",
          "listName": "Sprint",
          "assigneeId": "57a817db-e109-4eca-b3bf-eec1e56df1fa"
        },
        "actor": {
          "id": "3f6c6c5e-4a8f-4f55-8f49-f6e2d15e7f24",
          "fullName": "Ayesha Khan",
          "email": "ayesha@example.com",
          "avatarUrl": null,
          "avatarColor": "#6366f1"
        },
        "displayText": "Ayesha Khan added Bilal Raza as assignee",
        "createdAt": "2026-04-23T09:15:00.000Z"
      }
    ],
    "nextCursor": "a812f3cc-2201-4d11-b4e0-91c2e8e40012"
  }
}
```

### Response Fields

#### Top level

| Field | Type | Description |
|---|---|---|
| `success` | boolean | Always `true` on 200 |
| `data.items` | array | Activity rows, newest first |
| `data.nextCursor` | UUID \| null | Pass as `cursor` to load the next (older) page. `null` means no more pages |

#### Each item in `data.items`

| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | No | Row ID — use as `cursor` for pagination |
| `kind` | `"activity"` \| `"comment"` | No | Always `"activity"` currently; `"comment"` reserved for future comment timeline rows |
| `category` | string | No | ClickUp-style category (see valid values above) |
| `entityType` | string | No | Entity that produced the row e.g. `task`, `attachment`, `time_entry` |
| `entityId` | UUID | No | ID of that entity |
| `action` | string | No | Normalized action name e.g. `status_changed`, `file_uploaded` |
| `fieldName` | string | Yes | Field that changed, if applicable |
| `oldValue` | string | Yes | Previous value stringified, if applicable |
| `newValue` | string | Yes | New value stringified, if applicable |
| `metadata` | object | No | Denormalized context for rendering (task title, project name, IDs, etc.) |
| `actor.id` | UUID | No | User who performed the action |
| `actor.fullName` | string | No | Display name |
| `actor.email` | string | Yes | Email (null for deleted/anonymous users) |
| `actor.avatarUrl` | string | Yes | Avatar URL |
| `actor.avatarColor` | string | Yes | Fallback avatar background color |
| `displayText` | string | No | Ready-to-render fallback sentence |
| `createdAt` | ISO datetime | No | When the activity was recorded |

---

## Pagination Flow

1. First call — no `cursor`, get newest 25 rows.
2. If `nextCursor` is not `null`, pass it as `cursor` in the next call to get older rows.
3. Stop when `nextCursor` is `null`.
