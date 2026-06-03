# SwiftNine University Frontend Integration

This folder is the narrative handoff for frontend integration. Use Swagger for
endpoint schemas and this folder for the calling rules, order of operations, and
backend behaviors that do not fit cleanly into generated OpenAPI docs.

## Read first

1. Read [`01-foundations.md`](./01-foundations.md) before building the API
   client. It defines the base path, bearer auth, envelopes, errors,
   pagination, throttling, IDs, and timestamp conventions shared by the later
   flow docs.
2. Read the flow doc for the screen being integrated. Flow docs should link
   back to the foundations doc instead of redefining shared client behavior.
3. Check Swagger for the latest request and response shapes while implementing.
   The Swagger UI is exposed outside production at `/api/docs` under the API
   host.

## Planned docs

| Doc | Purpose |
| --- | --- |
| [`01-foundations.md`](./01-foundations.md) | Shared University API client contract. |
| [`02-flows/learner-core.md`](./02-flows/learner-core.md) | Browse, enroll, playback, resource access, progress, and dashboard stats. |
| [`02-flows/certificates.md`](./02-flows/certificates.md) | Async issuance, readiness polling, download, and public verification. |
| [`02-flows/profile-and-settings.md`](./02-flows/profile-and-settings.md) | LMS profile fields, avatar upload, notification prefs, and appearance data. |
| [`02-flows/reviews-and-bookmarks.md`](./02-flows/reviews-and-bookmarks.md) | Reviews, bookmarks, and lesson note lifecycle. |
| [`02-flows/admin.md`](./02-flows/admin.md) | Admin gating, reports, CSV downloads, and certificate revocation. |
| [`03-local-dev.md`](./03-local-dev.md) | Local and staging setup, CORS symptoms, and signed-cookie troubleshooting. |
| [`04-edge-cases.md`](./04-edge-cases.md) | Searchable reference for throttles, withdrawal, dwell time, status semantics, and ID stability. |
| [`05-handoff-checklist.md`](./05-handoff-checklist.md) | Frontend pre-integration, pre-commit, and pre-ship checks. |

## Companion artifacts

- Swagger / OpenAPI carries endpoint-level schemas and examples.
- `Docs/api-examples/` contains reusable payload examples for learner flows.
- [`postman/swiftnine-university.postman_collection.json`](./postman/swiftnine-university.postman_collection.json)
  is the frontend handoff request collection.
- `scripts/fe-smoke-test.sh` checks authenticated reachability, enrollment, and
  playback-session wiring against a seeded environment.
- `Docs/AWS_SETUP.md` remains the infrastructure and media delivery runbook.
- `Docs/PRE_FRONTEND_PRODUCTION_REVIEW.md` remains the production review
  record; this folder documents the current integration contract.

## Editing rule

When backend behavior changes, update Swagger first for schema drift and update
the relevant integration doc for flow or client-behavior drift.
