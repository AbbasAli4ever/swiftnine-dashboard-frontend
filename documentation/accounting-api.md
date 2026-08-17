# Accounting API

Summary
- Four modules: `transactions`, `clients`, `bank-accounts`, and `accounting-dashboard`. All four are **workspace-scoped** — every request requires an `x-workspace-id` header (same convention as `/projects`, `/tasks`, etc.), and every `Clients`/`Transaction`/`BankAccount` row belongs to exactly one workspace.
- `accounting-dashboard` is read-only — it aggregates data from the other three modules (`GET /accounting-dashboard/overview`, `GET /accounting-dashboard/search`) and doesn't own any table of its own. See section 4.
- `Clients` and `Transaction` have a real one-to-many relation (`Clients.transactions[]` / `Transaction.clientId`). `Transaction` and `BankAccount` also have a one-to-many relation (`BankAccount.transactions[]` / `Transaction.bankAccountId`) — every transaction credits exactly one bank account. See section 2.
- An `accountingRole` column (`UserRole`: `CEO` | `ACCOUNTANT`, nullable) lives on `WorkspaceMember`, not `User` — accounting access is granted per-workspace, not app-wide. See "Role / Auth Changes" below.
- Standard response envelope for all four modules:
```json
{ "success": true, "data": {}, "message": null }
```
- Paginated list endpoints use:
```json
{ "success": true, "data": [], "meta": { "page": 1, "limit": 20, "total": 0, "total_pages": 0, "has_next": false, "has_prev": false }, "message": null }
```

## Common Rules

- Auth: `@UseGuards(JwtAuthGuard, WorkspaceGuard, AccountingRoleGuard)` on all four controllers, class-level `@RequireAccountingRole('CEO', 'ACCOUNTANT')` (both roles can read), with every `POST`/`PATCH`/`DELETE` handler in `clients`, `transactions`, and `bank-accounts` overridden to `@RequireAccountingRole('ACCOUNTANT')` only — `CEO` is read-only across all three. `accounting-dashboard` has no write routes, so `CEO` and `ACCOUNTANT` both get its `GET` routes unchanged. See "Role / Auth Changes" for how this works.
- `x-workspace-id` header is **required** on every route in all four modules — `WorkspaceGuard` 403s without it, or if the caller isn't a member of that workspace.
- Money fields (`saleAmount`, `amount`, `totalRevenue`) are stored as Prisma `Decimal(12, 2)` but always converted to a plain JS `number` before being returned — Prisma's raw `Decimal` would otherwise serialize as a string over JSON, which every service in these modules explicitly guards against (`Number(row.field)` in a mapper function).
- All list endpoints support `q` (search), `page`, `limit` (max 100), `sortBy`, `sortOrder`.
- `Currency` enum (shared across all four modules): `USD`, `HKD`, `PKR`, `AED`, `EUR`, `GBP`, `CRYPTO`. Source of truth is `enum Currency` in `prisma/schema.prisma`, mirrored by `CURRENCY_VALUES` in `transaction.constants.ts`. Note that every currency here needs a matching entry in `EXCHANGE_RATES_TO_USD` (`accounting-dashboard.constants.ts`) for the dashboard's USD conversions — `CRYPTO` is a `1:1` placeholder, not a real rate.

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
- Same shape as list rows, plus the full `transactions[]` array (newest first), each with `id, saleAmount, currency, refId, description, createdAt, updatedAt`.

### Update
- `PATCH /clients/:clientId`
- Body: `clientName` only. **Cannot** update `totalRevenue` or `currencyType` yet (see Known Gaps).

### Delete
- `DELETE /clients/:clientId`
- Blocked with `409` if the client still has any transactions (`_count.transactions > 0`), checked explicitly in the service before the delete. **This check is the only thing preventing data loss** — `Transaction.client` is `onDelete: Cascade` at the DB level, not `Restrict`, so anything that deletes a `Clients` row outside this service method (a raw query, a future code path) would silently delete all of that client's transactions along with it, with no DB-level safety net.

## 2. Transactions (`/transactions`)

### Create
- `POST /transactions`
- Body: `clientId` (required UUID — **the client must already exist**), `bankAccountId` (required UUID — **the bank account must already exist**), `currency` (default `USD`), `saleAmount` (default `0`, ≥ 0), `saleDate` (optional ISO datetime — defaults to now if omitted), `refId` (required, unique **per workspace**, not globally), `description` (optional).
- `404 Client not found` / `404 Bank account not found` if either id doesn't resolve within the current workspace.
- `400` if `currency` doesn't exactly match the bank account's `currencyType` — there's no FX conversion, so this is a hard requirement, not a warning.
- `409` if `refId` is already used by another transaction **in the same workspace**.
- `clientName` is **not** part of the payload anymore — it's snapshotted server-side from the resolved client at creation time and stored denormalized on the `Transaction` row (so the record shows the client's name as of that moment, even if the client is renamed later).
- `saleDate` is the date the sale actually happened — separate from `createdAt` (when the row was inserted). Set it explicitly to backdate a sale entered late; omit it to default to now.

> **Changed behavior:** transactions previously accepted a free-text `clientName`, looked up a client by exact name, and **auto-created one if no match was found**. That find-or-create logic (`findOrCreateClientByName` in `transaction.service.ts`) is now commented out, not deleted, in case it needs to come back. Client creation is now exclusively via `POST /clients`.

### Bank-balance sync
Every transaction credits exactly one bank account's balance, in the same DB transaction as the write itself (`prisma.$transaction`) so the two never drift apart. There is no debit/credit choice and no inter-account transfers — a transaction is always a sale that adds to its bank account:
- **On create**: the bank account's `amount` is incremented by `saleAmount` atomically alongside the transaction row being created.
- **On update**: if `bankAccountId`, `saleAmount`, or `currency` change, the transaction's *prior* effect (its old `saleAmount`) is reversed on its *old* bank account, then the *new* `saleAmount` is applied to the new (possibly same) bank account — both inside one DB transaction, so a same-account edit nets out correctly and a cross-account move never leaves one side updated without the other. Changing only `clientId`/`clientName`/`description`/`saleDate` does **not** touch any balance.
- **On delete**: the transaction's effect is reversed on its bank account before the row is removed.
- **Currency is locked to the bank account's currency** — see the `400` above. Moving a transaction to a bank account in a different currency requires also changing `currency` to match in the same request.
- `BankAccount.amount` is still directly editable via `PATCH /bank-accounts` (e.g. for an opening balance or manual correction) — nothing reconciles that against the sum of linked transactions. Same category of drift as `Clients.totalRevenue` vs. `totalSaleAmount` (see Known Gaps), just on a second field.
- A bank account can't be deleted while it still has transactions — see section 3.

### List
- `GET /transactions?q=&page=&limit=&clientId=&currency=&dateFrom=&dateTo=&sortBy=&sortOrder=`
- `q` searches the denormalized `clientName` and `refId` (contains, case-insensitive).
- `clientId` filters to one client's transactions.
- `currency` accepts comma-separated values.
- `dateFrom` / `dateTo` filter by `saleDate` (not `createdAt`). A bare `YYYY-MM-DD` is treated as the start/end of that UTC day respectively (mirrors `parseDateBoundary` in `task.service.ts`); a full ISO datetime is used as-is.
- `sortBy`: `createdAt` (default) | `updatedAt` | `clientName` | `saleAmount` | `saleDate`.

### Get one
- `GET /transactions/:transactionId` — includes nested `client: { id, clientName }` and `bankAccount: { id, bankName, logoUrl }`, in addition to the flat `clientId`/`clientName`/`bankAccountId` fields.

### Update
- `PATCH /transactions/:transactionId`
- Body (all optional, at least one required): `clientId` (reassign — must exist, `404` otherwise), `clientName`, `bankAccountId`, `saleAmount`, `currency`, `saleDate`, `description`.
- Note: reassigning `clientId` does **not** automatically refresh the denormalized `clientName` unless `clientName` is also sent in the same request.
- See "Bank-balance sync" above for what happens to bank balances when `bankAccountId`/`saleAmount`/`currency` change.

### Delete
- `DELETE /transactions/:transactionId` — reverses the transaction's effect on its linked bank account's balance before deleting the row.

## 3. Bank Accounts (`/bank-accounts`)

Now linked to `Transaction` (one bank account has many transactions) — no relation to `Clients`.

### Create
- `POST /bank-accounts`
- Body: `bankName` (required), `accountType` (`LOCAL` | `INTERNATIONAL`, default `LOCAL`), `currencyType` (default `PKR`), `amount` (required, ≥ 0), `logoUrl` (optional, must be a valid URL).

### List
- `GET /bank-accounts?q=&page=&limit=&accountType=&currencyType=&sortBy=&sortOrder=`
- `sortBy`: `createdAt` (default) | `updatedAt` | `bankName` | `accountType` | `currencyType` | `amount`.

### Get one / Update / Delete
- `GET /bank-accounts/:bankAccountId`
- `PATCH /bank-accounts/:bankAccountId` — any field (including `logoUrl`), at least one required. Directly editing `amount` here is independent of transaction-driven balance changes — see "Bank-balance sync" in section 2.
- `DELETE /bank-accounts/:bankAccountId` — blocked with `409` if the bank account still has any transactions linked to it, checked explicitly in the service (mirrors the same check on `Clients` delete). Backed by a DB-level `ON DELETE RESTRICT` on `Transaction.bankAccountId` too, so even a raw query bypassing the service can't silently cascade-delete transaction history the way `Clients` deletion still can (see section 1's Delete note) — this one has both layers.

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

Read-only aggregation module — no table of its own. Pulls from `Clients`, `Transaction`, and `BankAccount`, all scoped to the current `x-workspace-id`, to back the accounting overview screen.

### Overview
- `GET /accounting-dashboard/overview?period=daily`
- `period` (optional, default `daily`): `daily` | `weekly` | `monthly` | `yearly` — controls only the granularity of `revenueOverview.points` (7 daily / 8 weekly / 12 monthly / 5 yearly buckets). Every other section of the response is independent of `period`.
- Seven independent queries are run via `Promise.all` (one service method per stat), each filtered to the current workspace, and assembled into a single response:
  - **`balances`** — `BankAccount` grouped by `accountType` + `currencyType` (`byAccountType: [{ accountType, totals: [{currency, total}], accountCount }]`), plus `totalBalanceUsd` (every currency converted and summed) and the `exchangeRatesToUsd` table used to do it.
  - **`revenueSummary`** — `today`, `thisMonth`, `thisYear` (each `{ totalUsd, changePercent }` vs. the prior comparable period — yesterday / last month / last year), and `totalSales` (`{ count, changePercent }`, transaction count this month vs. last month). All date windows are evaluated against `Transaction.saleDate`, not `createdAt`.
  - **`revenueOverview`** — `{ period, points: [{ label, totalUsd }] }`, a time series bucketed in Postgres via `generate_series` + a `LEFT JOIN` on `Transaction` (grouped by bucket + currency, filtered to the workspace inside the join condition), keyed by `saleDate` — only the aggregated rows (buckets × currencies present) cross into Node, not every matching transaction. `label` is a date (`YYYY-MM-DD`) for daily/weekly buckets, `YYYY-MM` for monthly, or a bare year for yearly. `weekly` is a rolling 7-day window ending today, not a calendar week — the query's bucket boundaries (`getBucketConfig()` in `accounting-dashboard.service.ts`) are computed in JS and passed in as parameters so this stays true for every period.
  - **`revenueByBankAccount`** — **all-time revenue** per `BankAccount`, both `LOCAL` and `INTERNATIONAL`, uncapped, each `{ id, bankName, accountType, currencyType, totalRevenue, totalRevenueUsd, salesCount }`, sorted by `totalRevenueUsd` descending. Accounts with no sales are still listed, at `0`. **Transaction-driven** (`Transaction.saleAmount`, no `saleDate` filter) — not to be confused with the account's balance, which is `BankAccount.amount`; see `bankAccounts`. Grouped by `[bankAccountId, currency]` so each currency converts at its own rate. `totalRevenue` is the native-currency figure and is `null` in the edge case of an account holding sales in more than one currency (`TransactionService.assertCurrencyMatches` currently prevents this, but the schema permits it).
  - **`revenueByCurrency`** — **all-time revenue** grouped by `Transaction.currency`: native `total`, converted `totalUsd`, and `percent` share of the USD grand total. Transaction-driven.
  - **`bankAccounts`** — top `{ local, international }` bank accounts by **balance** (`BankAccount.amount`) descending, capped at 4 per group (`BANK_ACCOUNTS_PER_GROUP_LIMIT`). This is the balance-driven cut; `revenueByBankAccount` is the revenue-driven one over the same accounts.
  - **`topClients`** — top 5 `Clients` (`TOP_CLIENTS_LIMIT`) ordered by the stored `totalRevenue` field descending (not the computed `totalSaleAmount` from transactions — see Known Gaps).
- All money values in the response are plain numbers (already converted from `Decimal`), and anything expressed "in USD" uses the fixed rate table in `accounting-dashboard.constants.ts`, not a live FX source (see Known Gaps).

### Daily Report
- `GET /accounting-dashboard/daily-report?date=2026-07-28` — `date` is required, `YYYY-MM-DD`.
- **Live-computed, not a frozen snapshot** — recalculated from `Transaction`/`BankAccount` on every call, the same way `/overview` is. There is no "submit" step and no persisted per-day record.
- Response: `revenueUsd` (sum of that date's transactions, USD-converted), `salesCount` (count of that date's transactions), `balances` (same shape as `/overview`'s `balances` — **current** balances, not a historical balance-as-of-that-date, since no balance history is tracked), `clientPayments` (that date's transactions listed, each with `clientName`, `saleAmount`, `currency`, and `bankAccount: { id, bankName, logoUrl }`, matching the same nested bank-account shape `GET /transactions` returns).

### Monthly Breakdown
- `GET /accounting-dashboard/monthly-breakdown?year=2026` — `year` is required.
- Returns exactly 12 points, January through December of that calendar year: `{ year, points: [{ label: 'YYYY-MM', totalUsd }] }`. This is **not** the same as `/overview?period=yearly`, which buckets by year (5 yearly totals) — this one is the Jan–Dec-of-one-specific-year monthly view. "Best revenue month" is just `max()` over `points` — not a separate field.
- Reuses the same `generate_series` + `LEFT JOIN` bucketing technique as `revenueOverview` on `/overview`, just with fixed year bounds instead of "N buckets ending today."

### Search
- `GET /accounting-dashboard/search?q=Acme` — backs the dashboard's global search bar ("Search client, transaction, reference..."). `q` is required, 1-200 chars after trimming.
- Not paginated — runs two independent queries via `Promise.all`, both scoped to the current workspace, and returns up to 5 of each (`DASHBOARD_SEARCH_RESULT_LIMIT`):
  - **`clients`** — `{ id, clientName, totalRevenue, currencyType }`. `q` is split on whitespace and every token must match somewhere in `clientName` (case-insensitive, any order) — same multi-word logic as `GET /clients/search`.
  - **`transactions`** — `{ id, refId, clientName, saleAmount, currency, saleDate, description }`, ordered by `saleDate` descending. Matches if `q` (as a whole string, not tokenized) is contained in `refId`, `clientName`, or `description` (case-insensitive) — same fields `GET /transactions?q=` already searches, plus `description`.
- No filter on `Clients`/`Transaction` beyond the text match — no date range, no pagination. If a caller needs more than 5 results of either kind, use `GET /clients?q=` or `GET /transactions?q=` directly, which are paginated.

## 5. Role / Auth Changes

- `accountingRole` — nullable `UserRole` enum (`CEO` | `ACCOUNTANT`), no default — lives on **`WorkspaceMember`**, not `User`. A person's accounting access is a property of their membership in a specific workspace, not a global attribute of their account: the same user can be `ACCOUNTANT` in one workspace and have no accounting access at all in another.
- This replaced an earlier design where `role` lived directly on `User` (global, one role for the whole app). That's gone now — `User` has no `role` column, `AUTH_USER_SELECT` no longer selects it, and neither `/auth/login` nor the Google OAuth redirect return a role at all anymore. If a caller needs to know their accounting role, it comes from workspace membership context, not the auth response.
- **Enforcement**: `AccountingRoleGuard` (`apps/api/src/auth/guards/accounting-role.guard.ts`, renamed from the old global `UserRoleGuard`) reads `req.workspaceContext.accountingRole` — populated by `WorkspaceGuard`, which now selects `accountingRole` alongside the pre-existing workspace `role` in the same `WorkspaceMember` lookup (one query, no extra DB round-trip). A `@RequireAccountingRole(...roles)` decorator marks which roles a route allows; anyone whose `accountingRole` isn't in the allowed set (including `null`) gets `403`. Must run *after* `WorkspaceGuard` in the guard chain, since it depends on `req.workspaceContext` already being populated.
- This is a separate, independent field from the pre-existing workspace-membership `role` (`OWNER`/`ADMIN`/`MEMBER`) checked by `RolesGuard`/`@Roles()` (`apps/api/src/roles/`) — the two roles coexist on the same `WorkspaceMember` row without interacting. An `OWNER` isn't automatically `CEO`; a plain `MEMBER` can still be `ACCOUNTANT`.
- **Reading it:** `GET /workspaces/:workspaceId` returns the caller's own `role` and `accountingRole` — this is the "who am I in this workspace" check. Use it to decide whether to show the accounting area, and to distinguish `CEO` (read-only) from `ACCOUNTANT` (read/write) so write controls can be disabled up front. Don't try to infer this from a `403`: `AccountingRoleGuard` returns an identical bare `403` whether the role is `null` or merely insufficient, so the two are indistinguishable by probing. `GET /workspaces/:workspaceId/members` and `/members/:memberId` also include `accountingRole` per member (pending invites report `null`, since no membership row exists until acceptance).
- **Setting it:** `PUT /organizations/members/:id/accounting-role`, OWNER-only, body `{ workspaceId, accountingRole }` where `accountingRole` is `'CEO' | 'ACCOUNTANT' | null` (`null` revokes accounting access entirely). `:id` accepts either a workspace-member id or a user id. Mirrors the neighbouring `PUT /organizations/members/:id/role` in shape, guards, and audit logging. Note this is **not** granted at invite/add-member time — invite and add-member DTOs still only accept the workspace `role` (`OWNER`/`MEMBER`), so accounting access is a separate, explicit step after the member exists.
- Not currently restricted: an `OWNER` can set their *own* `accountingRole`, i.e. grant themselves full accounting access. Reasonable given an OWNER already controls the workspace, but flagged in `docs/accounting-workspace-migration-changes.md` as an open decision if a stricter separation is wanted.
- **Read vs. write split:** all four controllers carry class-level `@RequireAccountingRole('CEO', 'ACCOUNTANT')`, so both roles can read (`GET`). Nest's `Reflector.getAllAndOverride` means a handler-level `@RequireAccountingRole(...)` fully replaces the class-level one for that handler (not merged) — every `POST`/`PATCH`/`DELETE` handler in `clients`, `transactions`, and `bank-accounts` is individually overridden to `@RequireAccountingRole('ACCOUNTANT')`, so `CEO` gets `403` on all of them. `CEO` is effectively read-only across the accounting feature; `ACCOUNTANT` has full read/write.

## 6. Known Gaps / Current Limitations

- `PATCH /clients/:clientId` cannot update `totalRevenue` or `currencyType` — only `clientName`. These fields are currently create-only.
- `Clients.totalRevenue` (manually entered at creation) and `totalSaleAmount` (computed by summing `Transaction.saleAmount` per currency) are two independent "how much has this client generated" numbers. Nothing keeps them in sync — creating/updating transactions does not touch `totalRevenue`, and there's no reconciliation job. This also means the dashboard's `topClients` (ranked by `totalRevenue`) can disagree with what `/clients` shows as `totalSaleAmount` for the same client.
- `BankAccount.amount` has the same category of drift risk against the sum of its linked transactions — see "Bank-balance sync" in section 2.
- `findOrCreateClientByName` is dead code (commented out) in `transaction.service.ts`, kept intentionally for reference.
- `EXCHANGE_RATES_TO_USD` (in `accounting-dashboard.constants.ts`) is a hardcoded, manually-maintained rate table — there's no live FX rate provider wired up. Every "in USD" figure in the dashboard overview is only as accurate as those fixed rates.
- `revenueOverview` is the only place in these four modules using raw SQL (`this.prisma.$queryRaw`) — everywhere else is plain Prisma (`groupBy`/`findMany`). Needed because Prisma's `groupBy` can't group by a computed expression like a date bucket, only by real columns. Kept minimal: the query only does bucket/currency aggregation; USD conversion and everything else stays in TypeScript.
- **`scripts/seed-accounting.js` is currently broken** against this schema — it inserts `Clients`/`Transaction`/`BankAccount` rows via raw SQL and never populated `workspaceId` (new requirement) or `bankAccountId`/`type` on `Transaction` (new requirement). It needs to target a real workspace id and needs updating before it can be used again; not fixed as part of this change since it requires deciding which workspace to seed into.
- **Migration note for `saleDate`:** the column was added as `DateTime @default(now())`, so `prisma db push` backfills existing rows with the timestamp of whenever the migration is run — not their true historical sale date. Not a live concern right now since this feature's existing data was wiped (not backfilled) when workspace-scoping was added — see the migration note below — but worth knowing if a similar situation comes up again.
- **Migration note for the workspace-scoping migration:** existing `Clients`/`Transaction`/`BankAccount` rows had no workspace to backfill into, so the migration (`20260811083456_accounting_per_workspace`) `TRUNCATE`s all three tables before adding the now-required `workspaceId` (and `Transaction.bankAccountId`) columns, rather than backfilling. This was confirmed acceptable because the only data present was test/seed data. Anyone applying this migration against a database with real accounting data would lose it — that wasn't the situation here, but it's not a decision this migration makes silently.

## 7. Suggested Frontend Data Flow

Accounting dashboard (`/accounting-dashboard/*`)
1. Accounting access is now workspace-scoped — call `GET /workspaces/:workspaceId` (with `x-workspace-id`) and read `accountingRole` off the response, **not** a global `user.role` (which no longer exists). `null` → hide the accounting area entirely; `CEO` → show it read-only, disabling every create/edit/delete control; `ACCOUNTANT` → full access. The same response also carries the workspace `role` (`OWNER`/`ADMIN`/`MEMBER`) if the UI needs both.
2. Overview / Transactions / Clients / Accounts & Balances / Reports are separate routes sharing one sidebar layout — currently static placeholders, not yet wired to these APIs.
3. Every request needs the current workspace's id in `x-workspace-id`, same as the rest of this app's workspace-scoped modules.
4. When wiring up real data:
   - Overview screen → `GET /accounting-dashboard/overview?period=daily|weekly|monthly|yearly` — one call backs the whole screen (balances, revenue summary cards, revenue chart, platform/currency breakdowns, bank account lists, top clients).
   - Dashboard search bar → `GET /accounting-dashboard/search?q=...` — debounce keystrokes client-side; each result item carries enough (`id` + type) to link straight to the matching client or transaction.
   - Clients list/detail → `GET /clients` / `GET /clients/:clientId`.
   - Client picker (e.g. "assign transaction to client") → `GET /clients/search?q=`.
   - Bank account picker (for a transaction's `bankAccountId`) → `GET /bank-accounts`, filtered client-side to the transaction's chosen currency, since the API rejects a mismatch.
   - Transactions table → `GET /transactions`, filterable by `clientId`.
   - Bank accounts / balances → `GET /bank-accounts`.
5. Creating a transaction from the UI requires a resolved `clientId` and `bankAccountId` up front (e.g. via search/pickers) — the API no longer accepts a bare client name, and every transaction must specify which bank account it affects.
