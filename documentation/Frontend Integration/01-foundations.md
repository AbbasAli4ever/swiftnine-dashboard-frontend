# Frontend Integration Foundations

This doc defines the client contract shared by every SwiftNine University
frontend flow. It documents backend behavior that the frontend API wrapper must
get right before screen-specific integration begins.

Use Swagger for endpoint schemas and examples. Use this doc for conventions that
apply across endpoints.

## Base URL contract

The University API sets the global prefix to `/api/v1`. Treat that path as part
of the API base URL, not as an optional route prefix.

Examples:

```text
GET {UNIVERSITY_API_BASE_URL}/health
GET {UNIVERSITY_API_BASE_URL}/lms/courses
```

For a deployed University API host, `UNIVERSITY_API_BASE_URL` should therefore
end in `/api/v1`.

Swagger is mounted at `/api/docs` only when `NODE_ENV` is not `production`.
Production clients must not depend on Swagger routes being present.

## Authentication

University API authentication is bearer-token based. Send the dashboard-issued
access token on protected requests:

```http
Authorization: Bearer <dashboard-access-token>
```

The University API verifies the JWT signature, payload shape, and expiry with
the shared `JWT_ACCESS_SECRET`. It does not provide login or refresh-token
endpoints. The frontend refreshes access through the dashboard auth flow, then
uses the current access token when calling University endpoints.

The accepted access-token payload has:

| Field | Requirement | Use |
| --- | --- | --- |
| `sub` | Required UUID | Stable authenticated user ID. |
| `email` | Required email | User email available to LMS features. |
| `name` | Optional | Preferred display name when present. |
| `fullName` | Optional | Display-name fallback. |
| `firstName`, `lastName` | Optional | Joined display-name fallback. |
| `iat`, `exp` | Optional in payload parsing | Dashboard JWT timing claims; expiry handling follows the token expiry claim presented to JWT verification. |

The shared auth contract expects short-lived dashboard access tokens, currently
about 15 minutes. A runtime `401` from University should be handled as an
expired, missing, or invalid access token, not as a University refresh flow.

LMS profile data is separate from the dashboard identity. Do not treat
University profile extras as the source of truth for the authenticated user ID,
email, or dashboard-issued name fields.

## Success envelopes

Successful JSON responses use a `{ data }` envelope. If a controller returns a
plain value, the global response interceptor wraps it automatically.

```json
{
  "data": {
    "id": "449ea4e0-a077-45ea-9d47-622fc41ebdf5"
  }
}
```

Controllers that already return an envelope keep it. This is how paginated
responses add `meta`:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

The frontend API client should unwrap `data` deliberately. Do not assume the
body itself is a course, note, certificate, or array.

## Error envelopes

Errors are normalized into one envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "pageSize",
        "message": "Number must be less than or equal to 100"
      }
    ]
  }
}
```

`details` is optional. Zod validation failures currently use it as an array of
field/message entries. Other failures may only include `code` and `message`.

| HTTP class | Error code | Frontend meaning |
| --- | --- | --- |
| `400` | `BAD_REQUEST` | Request is structurally unacceptable for this route or references invalid related data. |
| `401` | `UNAUTHORIZED` | Bearer token is missing, invalid, or expired. |
| `403` | `FORBIDDEN` | User is authenticated but cannot perform this action. |
| `404` | `NOT_FOUND` | Route target or record is not available. |
| `409` | `CONFLICT` | Request conflicts with current LMS state or a uniqueness rule. |
| `422` | `VALIDATION_ERROR` | Zod request validation failed. Inspect `details` when present. |
| Other non-5xx statuses without a dedicated mapping, including current `429` responses | `REQUEST_FAILED` | Check the HTTP status and message for route-specific handling. |
| `500+` | `INTERNAL_SERVER_ERROR` | Backend failure; show a recoverable error state and avoid client-side contract guesses. |

The HTTP status remains important. In particular, throttled requests are HTTP
`429` today even though their normalized error code is `REQUEST_FAILED`.

## Pagination

Learner-facing paginated list endpoints use these query conventions:

| Query param | Convention |
| --- | --- |
| `page` | One-based integer. Default `1`. Minimum `1`. |
| `pageSize` | Integer. Default `20`. Minimum `1`. Maximum `100`. |

The paginated response metadata is:

```json
{
  "page": 1,
  "pageSize": 20,
  "total": 42,
  "totalPages": 3
}
```

Read endpoint Swagger before sharing a pagination helper with admin surfaces.
Admin reports currently use their own report query defaults and limits.

## Rate limits

A global rate-limit guard applies a default request bucket of 60 requests per 60
seconds per user or IP when an endpoint does not override it.

High-frequency or public-sensitive endpoints currently override that default:

| Flow | Route | Limit key | Limit |
| --- | --- | --- | --- |
| Video playback session | `POST /lms/lessons/:lessonId/playback-session` | Authenticated user and `lessonId` | 10 requests per 60 seconds. |
| Video progress tick | `POST /lms/lessons/:lessonId/progress` | Authenticated user and `lessonId` | 1 request per 5 seconds. |
| Public certificate verification | `GET /lms/certificates/verify/:token` | IP address | 10 requests per 60 seconds. |

Rate-limit failures return HTTP `429` with the normalized error envelope. The
current guard does not add a `Retry-After` header, so frontend retry behavior
must use conservative backoff instead of assuming server-provided retry timing.
Do not treat `429` as a token refresh event.

Progress integration must respect its own flow cadence. The progress flow doc
adds the playback tick and flush rules beyond the raw throttle limit.

## IDs and routes

Use UUIDs as the stable identity for frontend joins, cache keys, selections, and
mutations across courses, modules, lessons, enrollments, resources,
certificates, reviews, notes, and profiles.

Course slugs are display and route-friendly identifiers where a flow exposes
them. Do not use a slug as a cross-response join key or long-lived object
identity in frontend state.

## Dates and times

University API date/time fields are returned as ISO 8601 strings produced from
UTC timestamps, for example:

```json
{
  "createdAt": "2026-05-22T11:45:10.000Z"
}
```

Parse and display them with timezone intent on the frontend. Do not assume a
server-local timestamp or manually append timezone information.

## Browser integration note

CORS is configured with credentials enabled. In production the API requires an
explicit `FRONTEND_ORIGIN`; in non-production it allows broader local
development behavior when no origin is configured.

That does not mean bearer-auth API calls need browser cookies. Media playback
and CDN signed-cookie behavior are a separate integration concern and belong in
the local-dev and learner playback docs.

## API client checklist

Before implementing a screen, the shared frontend client should:

1. Build requests from a base URL that already includes `/api/v1`.
2. Attach the current dashboard bearer token to protected University requests.
3. Parse success bodies through `data` and preserve paginated `meta`.
4. Parse normalized error envelopes while still branching on HTTP status where
   it matters, especially `401`, `403`, `422`, and `429`.
5. Send UUIDs for stable resource selection and treat timestamps as ISO UTC
   values.
