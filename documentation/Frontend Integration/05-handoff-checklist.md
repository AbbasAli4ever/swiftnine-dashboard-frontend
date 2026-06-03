# Frontend Handoff Checklist

Use this checklist when a frontend engineer starts University integration, when
they finish a screen, and when a handoff symptom needs the right backend doc
quickly.

This folder documents call order and backend rules. Current Swagger/OpenAPI
documents endpoint schemas. The Postman collection is a convenience snapshot:
if it disagrees with current Swagger/OpenAPI later, trust Swagger/OpenAPI.

## Before you start

| Check | Why |
| --- | --- |
| Read [`01-foundations.md`](./01-foundations.md). | API base URL, bearer auth, success envelopes, errors, pagination, IDs, and throttling start there. |
| Set an API base URL that includes `/api/v1`. | Every integration call depends on the canonical prefix. |
| Obtain a current dashboard access token. | University API validates dashboard bearer JWTs and does not issue or refresh them. |
| Import [`postman/swiftnine-university.postman_collection.json`](./postman/swiftnine-university.postman_collection.json) when manual endpoint probes help. | The collection exposes current handoff variables and request samples. |
| Confirm handoff seed values for media/admin work. | A playable seeded course, a READY video lesson, and an admin-row user are environment data, not frontend guesses. |

Read the flow doc for the screen being built:

| Screen or feature | Doc |
| --- | --- |
| Catalog, enroll, playback, resource lessons, progress, dashboard | [`02-flows/learner-core.md`](./02-flows/learner-core.md) |
| Certificates and public verification | [`02-flows/certificates.md`](./02-flows/certificates.md) |
| Profile, preferences, avatar | [`02-flows/profile-and-settings.md`](./02-flows/profile-and-settings.md) |
| Reviews, bookmarks, lesson notes | [`02-flows/reviews-and-bookmarks.md`](./02-flows/reviews-and-bookmarks.md) |
| Admin reports, CSV exports, revocation | [`02-flows/admin.md`](./02-flows/admin.md) |
| Local/staging media, cookies, CORS | [`03-local-dev.md`](./03-local-dev.md) |
| Cross-flow edge cases and statuses | [`04-edge-cases.md`](./04-edge-cases.md) |

## Run the smoke path

Use the smoke script after `API_BASE_URL` and a dashboard JWT are available:

```bash
API_BASE_URL=https://university-api.example/api/v1 \
JWT=<dashboard-access-token> \
scripts/fe-smoke-test.sh
```

The default smoke expects protected playback-session cookie headers. For local
unsigned media work where backend runs with `DISABLE_SIGNED_COOKIES=true`, run:

```bash
API_BASE_URL=http://localhost:3003/api/v1 \
JWT=<dashboard-access-token> \
EXPECT_SIGNED_COOKIES=false \
scripts/fe-smoke-test.sh
```

| Smoke result | Meaning |
| --- | --- |
| Auth probe succeeds | Base URL and current bearer token are accepted. |
| Course and enroll checks succeed | Catalog/enrollment route shape is reachable. |
| READY lesson is selected | Seed data includes playable media on the first catalog page. |
| Playback manifest URL returns | Playback-session JSON path is alive. |
| Signed-cookie header check succeeds | API response produced CloudFront playback cookies for that environment. |

The smoke script proves reachability and one learner happy path. It is not full
frontend QA and it does not replace browser cookie/CDN verification.

## Before you commit

| Check | Expected result |
| --- | --- |
| Re-open Swagger/OpenAPI for the endpoints touched by the screen. | Request and response shapes match current backend docs. |
| Run the smoke script against the integration environment when the screen uses the learner happy path. | The baseline is still green before debugging UI-only regressions. |
| Parse successful JSON through `data` and keep paginated `meta`. | UI does not assume raw body arrays or records. |
| Parse normalized error envelopes while branching on important HTTP statuses. | `401`, `403`, `422`, and `429` have the correct UI paths. |
| Keep UUIDs in durable frontend state. | Slugs remain route/display values, not long-lived join keys. |
| Keep bearer tokens, signed URLs, signed cookies, and verification tokens out of logs/fixtures. | Handoff tooling does not leak secrets. |

## Before you ship a screen

Every integrated screen should handle the states that its flow can actually
produce.

| State class | Screen check |
| --- | --- |
| Loading | Initial request and follow-up mutation/poll states do not look like empty data. |
| Empty | Legitimate no-data results have product copy and no false error banner. |
| `401` | Auth recovery goes to the dashboard/session flow. |
| `403` | Enrollment/admin access denial is distinct from empty and not-found states. |
| `404` | Missing resource/course/certificate paths do not strand the UI. |
| `409` | Conflict states such as inactive course, resource dwell, duplicate review, or blocked withdrawal have recoverable handling where relevant. |
| `422` | Validation details can surface near the input that failed. |
| `429` | Rate-limit path backs off and does not trigger auth refresh. |
| Async/polling | Certificates show processing/readiness states instead of assuming immediate PDF availability. |

## Tooling notes

| Artifact | Use | Boundary |
| --- | --- | --- |
| Swagger/OpenAPI | Current endpoint schema truth. | Non-production UI/docs endpoint is not mounted in production. |
| Postman collection | Manual request probes with FE-friendly variables and sample bodies. | Snapshot can rot as endpoints evolve. |
| `scripts/fe-smoke-test.sh` | Baseline API and learner playback-session smoke. | Requires real JWT and seeded READY media. |
| Narrative flow docs | Order of operations, UI consequences, and gotchas. | Link to Swagger for shapes instead of treating prose as generated schema. |

## When you are stuck

| Symptom | Open this doc first |
| --- | --- |
| API client wraps success/error bodies incorrectly | [`01-foundations.md`](./01-foundations.md) |
| Playback starts but HLS cookies/CDN requests fail | [`03-local-dev.md`](./03-local-dev.md) |
| Progress tick, resource completion, or dashboard meaning is unclear | [`02-flows/learner-core.md`](./02-flows/learner-core.md) |
| Resource completion says open/wait first | [`04-edge-cases.md`](./04-edge-cases.md) |
| Course is complete but certificate download is not ready | [`02-flows/certificates.md`](./02-flows/certificates.md) |
| Certificate verify/download status looks revoked or expired | [`02-flows/certificates.md`](./02-flows/certificates.md) |
| Profile JSON prefs or avatar upload behavior is unclear | [`02-flows/profile-and-settings.md`](./02-flows/profile-and-settings.md) |
| Review, bookmark, or note mutation behaves differently than expected | [`02-flows/reviews-and-bookmarks.md`](./02-flows/reviews-and-bookmarks.md) |
| Admin route returns `403` or CSV download needs auth | [`02-flows/admin.md`](./02-flows/admin.md) |
| You are mixing enrollment, progress, certificate, or media statuses | [`04-edge-cases.md`](./04-edge-cases.md) |

## Handoff ready

The first frontend handoff is ready when:

1. Base URL, JWT path, playable seed data, and any admin-row test user are
   provided for the target environment.
2. Smoke test is green in the intended mode.
3. Flow docs and current Swagger/OpenAPI agree for the screen being started.
4. The frontend engineer knows which local/staging media mode they are using.
