# Accounting API

Summary
- Four new modules were added: `transactions`, `clients`, `bank-accounts`, and `accounting-dashboard`. None of these are workspace-scoped — they only require JWT auth (`Authorization: Bearer <token>`), no `x-workspace-id` header, since the underlying data has no `workspaceId` column.
- `accounting-dashboard` is read-only — it aggregates data from the other three modules (`GET /accounting-dashboard/overview`, `GET /accounting-dashboard/search`) and doesn't own any table of its own. See section 4.
- `Clients` and `Transaction` have a real one-to-many relation (`Clients.transactions[]` / `Transaction.clientId`). `BankAccount` is standalone — no relation to clients or transactions.
- A `role` column (`UserRole`: `CEO` | `ACCOUNTANT`, nullable) was added to `User`, replacing a previous hardcoded-by-email-address check. Signing in as an `ACCOUNTANT` redirects the frontend to a dedicated `/accounting-dashboard` area (own layout, own sidebar) — see "Role / Auth Changes" below.
- Standard response envelope for all three modules:
```json
{ "success": true, "data": {}, "message": null }
```
- Paginated list endpoints use:
```json
{ "success": true, "data": [], "meta": { "page": 1, "limit": 20, "total": 0, "total_pages": 0, "has_next": false, "has_prev": false }, "message": null }
```

## Common Rules

- Auth: `@UseGuards(JwtAuthGuard, UserRoleGuard)` on all four controllers, class-level `@RequireUserRole('CEO', 'ACCOUNTANT')` (both roles can read), with every `POST`/`PATCH`/`DELETE` handler in `clients`, `transactions`, and `bank-accounts` overridden to `@RequireUserRole('ACCOUNTANT')` only — `CEO` is read-only across all three. `accounting-dashboard` has no write routes, so `CEO` and `ACCOUNTANT` both get its `GET` routes unchanged. No `WorkspaceGuard`, no `x-workspace-id`. See "Role / Auth Changes" for what changed.
- Money fields (`saleAmount`, `amount`, `totalRevenue`) are stored as Prisma `Decimal(12, 2)` but always converted to a plain JS `number` before being returned — Prisma's raw `Decimal` would otherwise serialize as a string over JSON, which every service in these modules explicitly guards against (`Number(row.field)` in a mapper function).
- All list endpoints support `q` (search), `page`, `limit` (max 100), `sortBy`, `sortOrder`.
- `Currency` enum (shared across all three modules): `USD`, `HKD`, `PKR`.

## 1. Clients (`/clients`)

### Create
- `POST /clients`
- Body: `clientName` (required), `totalRevenue` (required, ≥ 0), `currencyType` (optional enum, no default — nullable in DB).
- No uniqueness constraint on `clientName`.

### List
- `GET /clients?q=&page=&limit=&sortBy=&sortOrder=`
- `sortBy`: `clientName` (default) | `createdAt` | `updatedAt`.
- Each row includes:
  - `_count.transactions` — count of linked transactions.
  - `totalSaleAmount` — **computed**, grouped by currency: `[{ currency, total }]`, summed from that client's `Transaction.saleAmount` rows. Not the same as `totalRevenue` (see Known Gaps).
  - `totalRevenue` / `currencyType` — the stored fields from `Clients`.
  - Does **not** include the `transactions[]` array (kept light for list views).

### Search
- `GET /clients/search?q=<text>`
- Word-order-independent: splits `q` on whitespace and requires `clientName` to contain **every** word (case-insensitive), regardless of order — e.g. `q=Corp Acme` matches "Acme Corp Inc".
- Returns a plain array (not paginated), each item just `{ id, clientName }`.
- Route is declared before `GET /clients/:clientId` in the controller so `/clients/search` isn't swallowed by the `:clientId` route.

### Get one
- `GET /clients/:clientId`
- Same shape as list rows, plus the full `transactions[]` array (newest first), each with `id, saleAmount, paymentPlatform, currency, refId, description, createdAt, updatedAt`.

### Update
- `PATCH /clients/:clientId`
- Body: `clientName` only. **Cannot** update `totalRevenue` or `currencyType` yet (see Known Gaps).

### Delete
- `DELETE /clients/:clientId`
- Blocked with `409` if the client still has any transactions (`_count.transactions > 0`), checked explicitly in the service before the delete. **This check is the only thing preventing data loss** — `Transaction.client` is `onDelete: Cascade` at the DB level, not `Restrict`, so anything that deletes a `Clients` row outside this service method (a raw query, a future code path) would silently delete all of that client's transactions along with it, with no DB-level safety net.

## 2. Transactions (`/transactions`)

### Create
- `POST /transactions`
- Body: `clientId` (required UUID — **the client must already exist**), `paymentPlatform` (default `WHOP`), `currency` (default `USD`), `saleAmount` (default `0`, ≥ 0), `saleDate` (optional ISO datetime — defaults to now if omitted), `refId` (required, unique), `description` (optional).
- `404 Client not found` if `clientId` doesn't resolve to an existing client.
- `409` if `refId` is already used by another transaction.
- `clientName` is **not** part of the payload anymore — it's snapshotted server-side from the resolved client at creation time and stored denormalized on the `Transaction` row (so the record shows the client's name as of that moment, even if the client is renamed later).
- `saleDate` is the date the sale actually happened — separate from `createdAt` (when the row was inserted). Set it explicitly to backdate a sale entered late; omit it to default to now.

> **Changed behavior:** transactions previously accepted a free-text `clientName`, looked up a client by exact name, and **auto-created one if no match was found**. That find-or-create logic (`findOrCreateClientByName` in `transaction.service.ts`) is now commented out, not deleted, in case it needs to come back. Client creation is now exclusively via `POST /clients`.

### List
- `GET /transactions?q=&page=&limit=&clientId=&paymentPlatform=&currency=&dateFrom=&dateTo=&sortBy=&sortOrder=`
- `q` searches the denormalized `clientName` and `refId` (contains, case-insensitive).
- `clientId` filters to one client's transactions.
- `paymentPlatform` / `currency` accept comma-separated values.
- `dateFrom` / `dateTo` filter by `saleDate` (not `createdAt`). A bare `YYYY-MM-DD` is treated as the start/end of that UTC day respectively (mirrors `parseDateBoundary` in `task.service.ts`); a full ISO datetime is used as-is.
- `sortBy`: `createdAt` (default) | `updatedAt` | `clientName` | `saleAmount` | `saleDate`.

### Get one
- `GET /transactions/:transactionId` — includes nested `client: { id, clientName }` in addition to the flat `clientId`/`clientName` fields.

### Update
- `PATCH /transactions/:transactionId`
- Body (all optional, at least one required): `clientId` (reassign — must exist, `404` otherwise), `clientName`, `paymentPlatform`, `saleAmount`, `currency`, `saleDate`, `description`.
- Note: reassigning `clientId` does **not** automatically refresh the denormalized `clientName` unless `clientName` is also sent in the same request.

### Delete
- `DELETE /transactions/:transactionId`

## 3. Bank Accounts (`/bank-accounts`)

Standalone ledger — no relation to `Clients` or `Transaction`.

### Create
- `POST /bank-accounts`
- Body: `bankName` (required), `accountType` (`LOCAL` | `INTERNATIONAL`, default `LOCAL`), `currencyType` (default `PKR`), `amount` (required, ≥ 0), `logoUrl` (optional, must be a valid URL).

### List
- `GET /bank-accounts?q=&page=&limit=&accountType=&currencyType=&sortBy=&sortOrder=`
- `sortBy`: `createdAt` (default) | `updatedAt` | `bankName` | `accountType` | `currencyType` | `amount`.

### Get one / Update / Delete
- `GET /bank-accounts/:bankAccountId`
- `PATCH /bank-accounts/:bankAccountId` — any field (including `logoUrl`), at least one required.
- `DELETE /bank-accounts/:bankAccountId`

### Logo upload
- `POST /bank-accounts/logo-presign` — `ACCOUNTANT` only (same write restriction as create/update/delete). Declared before the `:bankAccountId` routes in the controller, though since it's a distinct static path it wouldn't actually collide even out of order.
- Body: `multipart/form-data` with a single field named `file` — the actual image, not JSON metadata. `fileName`/`mimeType`/`fileSize` are extracted server-side from the uploaded file itself (via `FileInterceptor('file')`/`@UploadedFile()`), not trusted from client-supplied fields. Deliberate choice: the file is uploaded twice in this flow (once here just to determine metadata, again by the client straight to S3) — less efficient than a pure JSON-metadata presign request, but the metadata used to build the S3 key and validate mime/size is guaranteed accurate rather than client-claimed.
- Validation: mime type must be one of `image/png` | `image/jpeg` | `image/svg+xml` | `image/webp`, size ≤ 2MB. `multer`'s `limits.fileSize` on `FileInterceptor` rejects an oversized file before it's fully buffered; the service also re-checks `file.size` and mime type explicitly, `400` either way.
- Response: `{ uploadUrl, logoUrl, expiresIn }`. `uploadUrl` is a presigned S3 `PUT` URL (expires in `expiresIn` seconds, default 900) — the client uploads the same file's raw bytes there directly in a second request, not through this API. `logoUrl` is the resulting **permanent** public URL; once that upload succeeds, pass it as `logoUrl` on `POST`/`PATCH /bank-accounts`.
- This uploads to a **separate S3 bucket** (`public-data-swiftnine`, `us-east-1`) via a new `PublicAssetsS3Service` (`libs/common/src/s3/public-assets-s3.service.ts`) — distinct bucket and credentials from the private attachments bucket `S3Service` already uses. Env vars: `PUBLIC_ASSETS_AWS_REGION`, `PUBLIC_ASSETS_AWS_S3_BUCKET`, `PUBLIC_ASSETS_AWS_S3_PREFIX` (default `accounts_dashboard_assets`), `PUBLIC_ASSETS_AWS_ACCESS_KEY_ID`, `PUBLIC_ASSETS_AWS_SECRET_ACCESS_KEY`.
- Object keys: `accounts_dashboard_assets/bank-logos/<uuid>-<sanitized-file-name>`.
- **No confirm step** — unlike the `ai-attachments`/`attachments` presign flows elsewhere in this API, there's no placeholder DB row and no `POST .../confirm` endpoint. The client presigns, uploads directly to S3, then just includes the already-known `logoUrl` in the create/update body. Nothing here verifies the second upload (to S3) actually happened before the URL gets saved.
- **Depends on bucket-level public-read configuration.** `logoUrl` is computed as a plain `https://<bucket>.s3.<region>.amazonaws.com/<key>` URL, not a signed one — this only resolves for end users if the bucket policy grants public `s3:GetObject`. That's an AWS-console-side setting, not something this API configures.
- This is the only endpoint in these four modules that accepts `multipart/form-data` — everywhere else is JSON. `multer` (via `@nestjs/platform-express`'s `FileInterceptor`) is used for exactly this one route; nothing else in the accounting feature needs it, since every other upload in this app is a pure presigned-URL flow with no file bytes touching the backend at all.

#### End-to-end client flow
1. `POST /bank-accounts/logo-presign` with the image as `multipart/form-data` (`file` field) → response gives `{ uploadUrl, logoUrl, expiresIn }`.
2. `PUT` the same file's raw bytes to `uploadUrl` directly — not through this API. **Must explicitly set a `Content-Type` header matching the real file type** (e.g. `image/png`). `createPresignedPutUrl()` deliberately signs the `PutObjectCommand` without a `ContentType`, so nothing here enforces or defaults it — whatever the client's `PUT` request sends (or doesn't) becomes the object's stored content type. Skip this header and the upload still succeeds (`200`), but S3 stores it as `application/octet-stream`, so `logoUrl` downloads as a generic file instead of rendering inline in a browser. Postman specifically: its **binary** body mode does not auto-set `Content-Type` from the picked file (unlike `form-data` mode) — add it manually.
3. Once the `PUT` returns `200`, `logoUrl` from step 1 is already live — pass it as `logoUrl` on `POST`/`PATCH /bank-accounts`. No confirm/finalize call.

Verified manually end-to-end (2026-08-06): presign → `PUT` with `Content-Type: image/png` set → `curl -I <logoUrl>` returned `200`, `Content-Type: image/png`, `Content-Length` matching the uploaded file exactly, no auth required (confirms the bucket's public-read policy is correctly configured) → `POST /bank-accounts` with that `logoUrl` persisted successfully.

## 4. Accounting Dashboard (`/accounting-dashboard`)

Read-only aggregation module — no table of its own. Pulls from `Clients`, `Transaction`, and `BankAccount` to back the accounting overview screen.

### Overview
- `GET /accounting-dashboard/overview?period=daily`
- `period` (optional, default `daily`): `daily` | `weekly` | `monthly` | `yearly` — controls only the granularity of `revenueOverview.points` (7 daily / 8 weekly / 12 monthly / 5 yearly buckets). Every other section of the response is independent of `period`.
- Seven independent queries are run via `Promise.all` (one service method per stat) and assembled into a single response:
  - **`balances`** — `BankAccount` grouped by `accountType` + `currencyType` (`byAccountType: [{ accountType, totals: [{currency, total}], accountCount }]`), plus `totalBalanceUsd` (every currency converted and summed) and the `exchangeRatesToUsd` table used to do it.
  - **`revenueSummary`** — `today`, `thisMonth`, `thisYear` (each `{ totalUsd, changePercent }` vs. the prior comparable period — yesterday / last month / last year), and `totalSales` (`{ count, changePercent }`, transaction count this month vs. last month). All date windows are evaluated against `Transaction.saleDate`, not `createdAt`.
  - **`revenueOverview`** — `{ period, points: [{ label, totalUsd }] }`, a time series bucketed in Postgres via `generate_series` + a `LEFT JOIN` on `Transaction` (grouped by bucket + currency), keyed by `saleDate` — only the aggregated rows (buckets × currencies present) cross into Node, not every matching transaction. `label` is a date (`YYYY-MM-DD`) for daily/weekly buckets, `YYYY-MM` for monthly, or a bare year for yearly. `weekly` is a rolling 7-day window ending today, not a calendar week — the query's bucket boundaries (`getBucketConfig()` in `accounting-dashboard.service.ts`) are computed in JS and passed in as parameters so this stays true for every period.
  - **`revenueByPaymentPlatform`** — total `saleAmount` (converted to USD) grouped by `paymentPlatform`, summed across all currencies, sorted descending.
  - **`revenueByCurrency`** — total `saleAmount` grouped by `currency`: native `total`, converted `totalUsd`, and `percent` share of the USD grand total.
  - **`bankAccounts`** — top `{ local, international }` bank accounts by `amount` descending, capped at 5 per group (`BANK_ACCOUNTS_PER_GROUP_LIMIT`).
  - **`topClients`** — top 5 `Clients` (`TOP_CLIENTS_LIMIT`) ordered by the stored `totalRevenue` field descending (not the computed `totalSaleAmount` from transactions — see Known Gaps).
- All money values in the response are plain numbers (already converted from `Decimal`), and anything expressed "in USD" uses the fixed rate table in `accounting-dashboard.constants.ts`, not a live FX source (see Known Gaps).

### Search
- `GET /accounting-dashboard/search?q=Acme` — backs the dashboard's global search bar ("Search client, transaction, reference..."). `q` is required, 1-200 chars after trimming.
- Not paginated — runs two independent queries via `Promise.all` and returns up to 5 of each (`DASHBOARD_SEARCH_RESULT_LIMIT`):
  - **`clients`** — `{ id, clientName, totalRevenue, currencyType }`. `q` is split on whitespace and every token must match somewhere in `clientName` (case-insensitive, any order) — same multi-word logic as `GET /clients/search`.
  - **`transactions`** — `{ id, refId, clientName, saleAmount, currency, saleDate, description }`, ordered by `saleDate` descending. Matches if `q` (as a whole string, not tokenized) is contained in `refId`, `clientName`, or `description` (case-insensitive) — same fields `GET /transactions?q=` already searches, plus `description`.
- No filter on `Clients`/`Transaction` beyond the text match — no date range, no pagination. If a caller needs more than 5 results of either kind, use `GET /clients?q=` or `GET /transactions?q=` directly, which are paginated.

## 5. Role / Auth Changes

- Added `User.role` — nullable `UserRole` enum (`CEO` | `ACCOUNTANT`), no default. Most users have `role = null`.
- `AuthService.issueTokens()` (the single choke point behind `/auth/login`, `/auth/verify-email`, `/auth/refresh`, and Google OAuth) previously set role by comparing `user.email` against two hardcoded addresses. That block is now fully replaced — `role` is read straight from `user.role`.
- `/user/profile` (`UserService.toUserProfile()`) had the same hardcoded-email logic; also switched to read `user.role`.
- Response shape:
  - `/auth/login`, `/auth/verify-email`, `/auth/refresh` return `role` **nested inside `user`** (`user.role`), not as a separate top-level key.
  - The Google OAuth callback (`GET /auth/google/callback`) is a redirect, not a JSON body, so it still appends `role` as a flat query param on the redirect URL (`/auth/callback?token=...&role=...`) — derived from `user.role` at redirect time, not a separate stored value.
- Frontend: `useAuthStore`'s `AuthUser` type now carries `role`; `login()` / `verifyEmail()` / session-restore read `data.user.role` instead of a top-level `data.role`.
- **Enforcement added:** `role` is no longer purely informational. A new `UserRoleGuard` (`apps/api/src/auth/guards/user-role.guard.ts`) reads `req.user.role` — already populated by `JwtAuthGuard` via `AUTH_USER_SELECT` — and a `@RequireUserRole(...roles)` decorator marks which roles a route allows. Any authenticated user whose role isn't in the allowed set (including `role: null`) gets `403 Forbidden`. This is a separate, simpler guard from the pre-existing workspace-membership `RolesGuard`/`@Roles()` (`apps/api/src/roles/`), which checks a different `Role` enum (`OWNER`/`ADMIN`/`MEMBER`) via a DB lookup — `UserRoleGuard` needs no DB lookup since `role` is already on the JWT-authenticated user.
- **Read vs. write split:** all four controllers carry class-level `@RequireUserRole('CEO', 'ACCOUNTANT')`, so both roles can read (`GET`). Nest's `Reflector.getAllAndOverride` means a handler-level `@RequireUserRole(...)` fully replaces the class-level one for that handler (not merged) — every `POST`/`PATCH`/`DELETE` handler in `clients`, `transactions`, and `bank-accounts` is individually overridden to `@RequireUserRole('ACCOUNTANT')`, so `CEO` gets `403` on all of them. `CEO` is effectively read-only across the accounting feature; `ACCOUNTANT` has full read/write.

## 6. Known Gaps / Current Limitations

- `PATCH /clients/:clientId` cannot update `totalRevenue` or `currencyType` — only `clientName`. These fields are currently create-only.
- `Clients.totalRevenue` (manually entered at creation) and `totalSaleAmount` (computed by summing `Transaction.saleAmount` per currency) are two independent "how much has this client generated" numbers. Nothing keeps them in sync — creating/updating transactions does not touch `totalRevenue`, and there's no reconciliation job. This also means the dashboard's `topClients` (ranked by `totalRevenue`) can disagree with what `/clients` shows as `totalSaleAmount` for the same client.
- None of these four modules are workspace-scoped, unlike most of the rest of the API. They are effectively single global ledgers shared across the whole app, not per-workspace.
- `findOrCreateClientByName` is dead code (commented out) in `transaction.service.ts`, kept intentionally for reference.
- `BankAccount` has no relation to `Clients` or `Transaction` — it's a separate, unconnected ledger for now.
- `EXCHANGE_RATES_TO_USD` (in `accounting-dashboard.constants.ts`) is a hardcoded, manually-maintained rate table — there's no live FX rate provider wired up. Every "in USD" figure in the dashboard overview is only as accurate as those fixed rates.
- `revenueOverview` is the only place in these four modules using raw SQL (`this.prisma.$queryRaw`) — everywhere else is plain Prisma (`groupBy`/`findMany`). Needed because Prisma's `groupBy` can't group by a computed expression like a date bucket, only by real columns. Kept minimal: the query only does bucket/currency aggregation; USD conversion and everything else stays in TypeScript.
- **Migration note for `saleDate`:** the column was added as `DateTime @default(now())`, so `prisma db push` backfills existing rows with the timestamp of whenever the migration is run — not their true historical sale date. If preserving historical accuracy for rows that existed before this change matters, run `UPDATE "Transaction" SET "saleDate" = "createdAt";` once, by hand, right after applying the schema change (this wasn't run automatically — nothing here executes DB-writing commands on its own). Seeded/test data doesn't need this since re-running `npm run seed:accounting` populates `saleDate` correctly from scratch.

## 7. Suggested Frontend Data Flow

Accounting dashboard (`/accounting-dashboard/*`)
1. On sign-in, if `user.role === "ACCOUNTANT"`, redirect to `/accounting-dashboard` (Overview).
2. Overview / Transactions / Clients / Accounts & Balances / Reports are separate routes sharing one sidebar layout — currently static placeholders, not yet wired to these APIs.
3. When wiring up real data:
   - Overview screen → `GET /accounting-dashboard/overview?period=daily|weekly|monthly|yearly` — one call backs the whole screen (balances, revenue summary cards, revenue chart, platform/currency breakdowns, bank account lists, top clients).
   - Dashboard search bar → `GET /accounting-dashboard/search?q=...` — debounce keystrokes client-side; each result item carries enough (`id` + type) to link straight to the matching client or transaction.
   - Clients list/detail → `GET /clients` / `GET /clients/:clientId`.
   - Client picker (e.g. "assign transaction to client") → `GET /clients/search?q=`.
   - Transactions table → `GET /transactions`, filterable by `clientId`.
   - Bank accounts / balances → `GET /bank-accounts`.
4. Creating a transaction from the UI requires a resolved `clientId` up front (e.g. via the client search/picker) — the API no longer accepts a bare client name.
