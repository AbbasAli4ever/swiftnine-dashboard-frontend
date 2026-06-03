# Edge Cases And Gotchas

This is the frontend quick-reference for University behaviors that are easy to
misread from schemas alone: throttles, cancelled enrollments, resource dwell
gates, identifier stability, mandatory-course semantics, status boundaries, and
environment differences.

Read [`01-foundations.md`](./01-foundations.md) for the shared API contract.
Use [`02-flows/learner-core.md`](./02-flows/learner-core.md) for normal learner
call order, [`02-flows/certificates.md`](./02-flows/certificates.md) for async
certificate state, and [`03-local-dev.md`](./03-local-dev.md) for local/staging
cookie and CORS troubleshooting.

## Quick lookup

| Question | Fast answer |
| --- | --- |
| Why did the API return `429`? | A default or route-specific rate-limit bucket was exceeded. Check HTTP status, back off, and do not refresh auth. |
| Who refreshes an expired token? | Dashboard auth flow. University API validates bearer tokens but has no refresh endpoint. |
| Can a learner withdraw from a course? | Yes, only through cancellation of an active, not-completed, not-currently-certified enrollment. |
| Why did resource completion fail? | First completion requires prior resource URL access; required resource lessons also require a 10 second dwell after access. |
| Can FE use course slug as a durable key? | No. Use UUIDs for joins, cache keys, selections, and mutations. |
| Does `isMandatory=true` enforce compliance server-side? | No. It is current backend metadata/filter support, not a global LMS blocking gate. |
| Which status should the screen render? | Render the status family for the artifact on screen: enrollment, progress, certificate, or media readiness. |
| Why does dev behave differently from prod? | CORS, Swagger exposure, and signed-cookie behavior depend on environment config. |

## Throttling

The University API has a global in-memory rate-limit guard plus route-specific
overrides.

| Scope | Route or flow | Bucket key | Limit |
| --- | --- | --- | --- |
| Default | Endpoints without their own override | Authenticated user or IP, per controller handler | 60 requests per 60 seconds. |
| Playback session | `POST /lms/lessons/:lessonId/playback-session` | User and `lessonId` | 10 requests per 60 seconds. |
| Video progress | `POST /lms/lessons/:lessonId/progress` | User and `lessonId` | 1 request per 5 seconds. |
| Public certificate verify | `GET /lms/certificates/verify/:token` | IP | 10 requests per 60 seconds. |

| `429` detail | Current behavior |
| --- | --- |
| HTTP status | `429 Too Many Requests` |
| Error message | Too many requests |
| Normalized error code | Currently `REQUEST_FAILED` because `429` has no dedicated error-code mapping. |
| `Retry-After` header | Not added by the current rate-limit guard. |

Frontend handling:

| Do | Do not |
| --- | --- |
| Back off conservatively after `429`. | Treat `429` as token expiry or trigger token refresh. |
| Respect the 10 to 15 second progress tick cadence from learner-core. | Poll playback-session repeatedly for a loaded lesson. |
| Branch on HTTP status as well as normalized error code. | Depend on a `Retry-After` header that is not currently sent. |

## Token expiry

| Runtime case | Frontend interpretation |
| --- | --- |
| Dashboard bearer token is missing, invalid, or expired | University endpoint returns `401`. |
| Dashboard access token needs refresh | Dashboard auth owns refresh; University API has no login or refresh endpoint. |
| Protected University route returns `401` during active UI | Recover through the shared auth/session flow, then retry only when a fresh token exists. |

The shared access-token contract is short-lived, currently about 15 minutes.
Use the HTTP `401` path for auth recovery. Use the HTTP `429` path for backoff.

## Withdrawal and cancellation

Withdrawal is implemented as enrollment cancellation:

```text
PATCH /lms/courses/:courseId/enrollment
```

Only this payload is supported:

```json
{
  "status": "CANCELLED"
}
```

| Withdrawal case | Backend result | Frontend consequence |
| --- | --- | --- |
| Enrollment does not exist | Not found. | Show the normal missing/unavailable state. |
| Enrollment is already `CANCELLED` | Returns the cancelled enrollment. | Treat repeat cancellation as settled state. |
| Enrollment is `ACTIVE` and has no completion/certificate block | Status changes to `CANCELLED`. | Remove from default active my-courses views after refresh. |
| Enrollment is not `ACTIVE` | Conflict. | Do not offer withdrawal from completed rows. |
| Course progress or enrollment is completed | Conflict. | Completion is a withdrawal boundary. |
| A certificate is currently `PROCESSING` or `VALID` for the user/course | Conflict. | Do not assume a completed/certified learner can cancel afterward. |

Cancelled enrollment effects:

| Surface | Current behavior |
| --- | --- |
| `GET /lms/my-courses` | Excludes `CANCELLED` enrollments by default unless the status filter asks for them. |
| Playback session and resource URL access | Cancelled enrollment fails the enrollment gate. |
| Video progress and resource completion | Cancelled enrollment fails the enrollment gate. |
| Lesson notes | Cancelled enrollment fails the enrollment gate. |
| Review create/update/delete | Cancelled enrollment cannot mutate reviews. Existing review visibility is a separate review-list concern. |

Do not confuse cancellation with deleting learner history. The API changes the
enrollment state and uses that state for access gates.

## Video progress edge cases

| Condition | Current rule | Frontend handling |
| --- | --- | --- |
| Progress cadence | Route throttle allows one tick per 5 seconds per user and lesson. | Prefer 10 to 15 second ticks plus pause/seek/ended flushes. |
| Segment direction | `watchedTo` must be greater than `watchedFrom`. | Flush real watched ranges only. |
| Segment size | One submitted watched interval must be at most 60 seconds. | Split long accumulated playback into smaller intervals. |
| Interval outside lesson bounds | Backend clamps positions, then rejects a range that becomes empty. | Use player duration/current time carefully. |
| Exact duplicate interval | Insert is idempotent. | Retries can reuse the same exact segment safely. |
| Too many stored watch segments | New non-duplicate intervals can hit a conflict after the lesson segment cap. | Stop noisy resend loops and inspect client tick behavior. |
| Video lesson completion | Server completes when merged watched percentage reaches at least 90 percent. | Render response state instead of guessing from player-side percent. |

## Resource completion edge cases

First completion of a resource lesson depends on the resource access event
created by:

```text
GET /lms/lessons/:lessonId/resource/:resourceId/url
```

| Resource case | Rule | Frontend handling |
| --- | --- | --- |
| Completion before any resource URL access | Conflict: open resource first. | Open/request the resource URL before enabling completion. |
| Required resource lesson completed too soon after access | Conflict until 10 seconds after latest recorded access. | Gate the completion UI or handle the retryable conflict. |
| Non-required resource lesson after access | Prior access still matters; required dwell delay does not. | Keep access-before-complete order even without a countdown. |
| Already completed resource lesson | Existing completion avoids the first-completion access/dwell check. | Render returned progress state. |

Resource completion and video progress return the recomputed course progress
summary. Use that response when completion changes course UI.

## Identifier stability

| Identifier | Frontend rule | Why |
| --- | --- | --- |
| UUIDs for courses, modules, lessons, resources, enrollments, certificates, reviews, notes | Use for joins, cache keys, mutations, selections, and long-lived frontend state. | These are the API identity values across flow responses. |
| Course slug | Use only where a route/display concern explicitly needs it. | It is not the stable frontend join key. |
| Seed source file identity | Treat content changes as backend/content-ops concerns. | File renames can affect seeded lesson identity and learner history paths. |

Current content-operation note:

| Seed/content fact | Consequence |
| --- | --- |
| Course seed upsert keys by course slug. | Changing a production slug is risky and can create a new seeded course path instead of preserving existing UUID-linked learner data. |
| Seeded lesson matching uses module/file-derived identity. | Renaming a lesson source file can create a different lesson record path. |

The frontend rule stays simple even when content operations are nuanced: keep
UUID identity in app state.

## Mandatory courses

| Question | Current answer |
| --- | --- |
| What does `isMandatory` do now? | Marks course metadata and supports catalog filtering/display. |
| Does backend block other courses or certificates until mandatory courses finish? | No current global mandatory-course gate exists. |
| Can FE show required/mandatory UX? | Yes, using returned course data and product requirements. |
| Should FE assume backend compliance enforcement already exists? | No. Treat any stronger compliance workflow as a separate contract. |

## Status families

Render the status family that belongs to the screen. A learner can have an
enrollment status, a course progress status, a certificate status, and media
readiness at the same time.

### Enrollment status

| Status | Backend meaning | Frontend use |
| --- | --- | --- |
| `ACTIVE` | Enrollment exists and has not completed or been cancelled. | Learner can continue when other access gates pass. |
| `COMPLETED` | Course completion promoted the enrollment. | Render completed enrollment state; do not offer withdrawal. |
| `CANCELLED` | Learner withdrew/cancelled before the blocked completion boundaries. | Hide from default my-courses view and expect learner access gates to fail. |

### Course progress status

| Status | Backend meaning | Frontend use |
| --- | --- | --- |
| `NOT_STARTED` | No completed required lesson or watched-learning activity has moved the course yet. | Render start state. |
| `IN_PROGRESS` | Learning activity exists but required lessons are not all complete. | Render resume/progress state. |
| `COMPLETED` | All required lessons counted complete. | Render course completion and hand certificate readiness to the certificate flow. |

Course progress completion triggers enrollment completion and certificate
issuance work. It does not mean the certificate PDF is already ready.

### Certificate status

| Status | Backend meaning | Frontend use |
| --- | --- | --- |
| `PROCESSING` | Certificate artifact is reserved/being issued. | Learner list/detail/verify routes hide it; use certificate readiness state after course completion. |
| `VALID` | Issued active certificate. | Render valid state and available owned download. |
| `EXPIRED` | Certificate passed expiry processing. | Render expired status; current owned download route does not block this status. |
| `REVOKED` | Admin revoked the certificate. | Render revoked state; owned download is blocked. |

Do not collapse certificate readiness (`NONE`, `PENDING`, `FAILED`, `READY`)
into certificate status. They answer different questions.

### Media asset status

| Status | Backend meaning | Frontend use |
| --- | --- | --- |
| `PENDING` | Media is not ready for playback. | Do not assume the lesson can start playback yet. |
| `READY` | Video media is available for playback-session checks. | Request playback only when enrollment/course gates also pass. |
| `FAILED` | Media processing/seeding failed. | Show unavailable/error state; retrying learner playback alone does not repair media. |

Media readiness does not grant learner access. Playback still checks lesson type,
active course, enrollment, and manifest availability.

## Dev and production differences

| Concern | Development/non-production | Production |
| --- | --- | --- |
| CORS origin when `FRONTEND_ORIGIN` is unset | Broader development behavior is allowed. | Env validation requires `FRONTEND_ORIGIN`; missing config fails closed. |
| Swagger UI | Available at `/api/docs`. | Not mounted. |
| Signed-cookie media | May be bypassed with `DISABLE_SIGNED_COOKIES=true` for local/dev media behavior. | Expected to use configured CloudFront signed-cookie path. |
| Browser cookie troubleshooting | Localhost/domain mismatch is common. | Parent-domain and CDN config should be coherent; failures point to env/browser/CDN setup. |

Use local-dev for the setup details behind those differences.

## Do not assume

| Assumption to avoid | Use instead |
| --- | --- |
| `429` means the token expired. | Treat `429` as rate limiting and back off. |
| A completed course means the certificate download is ready. | Poll certificate readiness. |
| A resource lesson can complete before resource access. | Request resource URL first and respect required dwell. |
| A course slug is the durable frontend ID. | Use UUIDs. |
| Mandatory course flag is a backend compliance engine. | Treat it as current metadata/filter contract. |
| `READY` media means learner is authorized. | Apply media readiness and learner access gates separately. |
