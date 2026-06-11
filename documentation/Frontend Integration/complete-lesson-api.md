# POST /api/v1/lms/lessons/:lessonId/complete

## What it does

Marks a lesson as complete for the authenticated user. Handles two lesson types:

- **RESOURCE** — PDF, file, or document lessons. Requires the learner to have opened the resource URL first; required lessons additionally enforce a 10-second dwell period.
- **VIDEO** — Video lessons. Can be explicitly marked complete at any time once the media is ready. Videos also auto-complete at 90 % watched via the progress-tick endpoint.

The call is idempotent: calling it a second time on an already-completed lesson returns the same state with no error or side effect.

---

## Authentication

Bearer JWT required (`Authorization: Bearer <token>`).

---

## URL parameter

| Parameter  | Type | Description       |
|------------|------|-------------------|
| `lessonId` | UUID | ID of the lesson  |

---

## Request body

None. The endpoint takes no request body.

---

## Preconditions by lesson type

### RESOURCE lessons

1. The lesson's course must be **active**.
2. The lesson must have a resource file uploaded (an S3 key must exist on the resource record).
3. The user must be **enrolled** in the course and the enrollment must not be `CANCELLED`.
4. The user must have previously **opened the resource URL** by calling `GET /api/v1/lms/lessons/:lessonId/resource/:resourceId/url` at least once. That call creates an access event — completion is gated on this event existing.
5. If `lesson.required === true`, at least **10 seconds** must have elapsed since the resource URL was last accessed.

### VIDEO lessons

1. The lesson's course must be **active**.
2. The lesson must have a `MediaAsset` record with `status === READY`.
3. The user must be **enrolled** in the course and the enrollment must not be `CANCELLED`.
4. No minimum watch time is required for the explicit complete call. The call marks the lesson complete immediately.

---

## Behavior on success

- Sets `lessonProgress.isCompleted = true` and `watchedPercentage = 100`.
- Preserves the original `completedAt` timestamp if the lesson was already completed (idempotent path).
- Recomputes the course progress record (percentage, status, counts).
- If the course becomes fully completed (all required lessons done) for the first time:
  - Marks the enrollment as `COMPLETED`.
  - Creates a `CertificateIssuanceJob` and fires the course-completion event, which triggers certificate PDF generation.

---

## Response

HTTP `200 OK`

```json
{
  "data": {
    "lessonId": "uuid",
    "watchedSeconds": 0,
    "watchedPercentage": 100,
    "isCompleted": true,
    "completedAt": "2026-06-11T12:00:00.000Z",
    "lastPositionSeconds": 0,
    "courseProgress": {
      "percentage": 75,
      "status": "IN_PROGRESS",
      "isCompleted": false,
      "completedRequiredLessons": 3,
      "totalRequiredLessons": 4
    }
  }
}
```

`watchedSeconds` for a RESOURCE lesson will be `0` (no video tracking). For a VIDEO lesson it reflects accumulated watch time from progress ticks.

---

## Error responses

| Status | Code | Reason |
|--------|------|--------|
| `401` | `UNAUTHORIZED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | User is not enrolled, or enrollment is `CANCELLED` |
| `404` | `NOT_FOUND` | Lesson does not exist |
| `409` | `CONFLICT` | Lesson type is not `RESOURCE` or `VIDEO` |
| `409` | `CONFLICT` | Course is inactive |
| `409` | `CONFLICT` | RESOURCE: no resource file has been uploaded for this lesson |
| `409` | `CONFLICT` | VIDEO: media asset is not seeded or status is not `READY` |
| `409` | `CONFLICT` | RESOURCE: the resource URL has never been opened (no access event) |
| `409` | `CONFLICT` | RESOURCE + `required`: 10-second dwell period has not elapsed since the resource was last opened |
| `422` | `UNPROCESSABLE_ENTITY` | `lessonId` is not a valid UUID |

---

## Typical client flow

### Resource lesson

```
1.  GET  /api/v1/lms/lessons/:lessonId/resource/:resourceId/url
        → user receives presigned URL, opens the file
2.  (wait ≥ 10 s if required lesson)
3.  POST /api/v1/lms/lessons/:lessonId/complete
        → lesson marked complete, course progress updated
```

### Video lesson (auto-complete path)

```
1.  POST /api/v1/lms/lessons/:lessonId/playback-session
2.  POST /api/v1/lms/lessons/:lessonId/progress  (every 10–15 s)
        → lesson auto-completes at 90 % watched
```

### Video lesson (explicit complete path)

```
1.  POST /api/v1/lms/lessons/:lessonId/playback-session
2.  POST /api/v1/lms/lessons/:lessonId/complete
        → lesson marked complete immediately (no watch % required)
```

---

## Related endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET  /api/v1/lms/lessons/:lessonId/resource/:resourceId/url` | Opens a resource — must be called before completing a RESOURCE lesson |
| `POST /api/v1/lms/lessons/:lessonId/progress` | Records video watch segments — triggers auto-completion at 90 % |
| `POST /api/v1/lms/lessons/:lessonId/playback-session` | Starts a video playback session and returns the HLS manifest URL |
