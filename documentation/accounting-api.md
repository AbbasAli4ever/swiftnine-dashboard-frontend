# Accounting API

Summary
- Four new modules were added: `transactions`, `clients`, `bank-accounts`, and `accounting-dashboard`. None of these are workspace-scoped — they only require JWT auth (`Authorization: Bearer <token>`), no `x-workspace-id` header, since the underlying data has no `workspaceId` column.
- `accounting-dashboard` is read-only — it aggregates data from the other three modules (`GET /accounting-dashboard/overview`) and doesn't own any table of its own. See section 4.
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

- Auth: `@UseGuards(JwtAuthGuard, UserRoleGuard)` + `@RequireUserRole('CEO', 'ACCOUNTANT')` on all four controllers (`clients`, `transactions`, `bank-accounts`, `accounting-dashboard`). No `WorkspaceGuard`, no `x-workspace-id`. See "Role / Auth Changes" for what changed.
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
- Blocked with `409` if the client still has any transactions (`_count.transactions > 0`), checked explicitly in the service before the delete. This mirrors `Transaction.client`'s `onDelete: Restrict` at the DB level, giving a clean error instead of a raw FK-violation.

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
- Body: `bankName` (required), `accountType` (`LOCAL` | `INTERNATIONAL`, default `LOCAL`), `currencyType` (default `PKR`), `amount` (required, ≥ 0).

### List
- `GET /bank-accounts?q=&page=&limit=&accountType=&currencyType=&sortBy=&sortOrder=`
- `sortBy`: `createdAt` (default) | `updatedAt` | `bankName` | `accountType` | `currencyType` | `amount`.

### Get one / Update / Delete
- `GET /bank-accounts/:bankAccountId`
- `PATCH /bank-accounts/:bankAccountId` — any field, at least one required.
- `DELETE /bank-accounts/:bankAccountId`

## 4. Accounting Dashboard (`/accounting-dashboard`)

Read-only aggregation module — no table of its own. Pulls from `Clients`, `Transaction`, and `BankAccount` to back the accounting overview screen.

### Overview
- `GET /accounting-dashboard/overview?period=daily`
- `period` (optional, default `daily`): `daily` | `weekly` | `monthly` | `yearly` — controls only the granularity of `revenueOverview.points` (7 daily / 8 weekly / 12 monthly / 5 yearly buckets). Every other section of the response is independent of `period`.
- Seven independent queries are run via `Promise.all` (one service method per stat) and assembled into a single response:
  - **`balances`** — `BankAccount` grouped by `accountType` + `currencyType` (`byAccountType: [{ accountType, totals: [{currency, total}], accountCount }]`), plus `totalBalanceUsd` (every currency converted and summed) and the `exchangeRatesToUsd` table used to do it.
  - **`revenueSummary`** — `today`, `thisMonth`, `thisYear` (each `{ totalUsd, changePercent }` vs. the prior comparable period — yesterday / last month / last year), and `totalSales` (`{ count, changePercent }`, transaction count this month vs. last month). All date windows are evaluated against `Transaction.saleDate`, not `createdAt`.
  - **`revenueOverview`** — `{ period, points: [{ label, totalUsd }] }`, a time series bucketed in JS (not raw SQL) from all `Transaction` rows since the earliest bucket start, keyed by `saleDate`. `label` is a date (`YYYY-MM-DD`) for daily/weekly buckets, `YYYY-MM` for monthly, or a bare year for yearly.
  - **`revenueByPaymentPlatform`** — total `saleAmount` (converted to USD) grouped by `paymentPlatform`, summed across all currencies, sorted descending.
  - **`revenueByCurrency`** — total `saleAmount` grouped by `currency`: native `total`, converted `totalUsd`, and `percent` share of the USD grand total.
  - **`bankAccounts`** — top `{ local, international }` bank accounts by `amount` descending, capped at 5 per group (`BANK_ACCOUNTS_PER_GROUP_LIMIT`).
  - **`topClients`** — top 5 `Clients` (`TOP_CLIENTS_LIMIT`) ordered by the stored `totalRevenue` field descending (not the computed `totalSaleAmount` from transactions — see Known Gaps).
- All money values in the response are plain numbers (already converted from `Decimal`), and anything expressed "in USD" uses the fixed rate table in `accounting-dashboard.constants.ts`, not a live FX source (see Known Gaps).

## 5. Role / Auth Changes

- Added `User.role` — nullable `UserRole` enum (`CEO` | `ACCOUNTANT`), no default. Most users have `role = null`.
- `AuthService.issueTokens()` (the single choke point behind `/auth/login`, `/auth/verify-email`, `/auth/refresh`, and Google OAuth) previously set role by comparing `user.email` against two hardcoded addresses. That block is now fully replaced — `role` is read straight from `user.role`.
- `/user/profile` (`UserService.toUserProfile()`) had the same hardcoded-email logic; also switched to read `user.role`.
- Response shape:
  - `/auth/login`, `/auth/verify-email`, `/auth/refresh` return `role` **nested inside `user`** (`user.role`), not as a separate top-level key.
  - The Google OAuth callback (`GET /auth/google/callback`) is a redirect, not a JSON body, so it still appends `role` as a flat query param on the redirect URL (`/auth/callback?token=...&role=...`) — derived from `user.role` at redirect time, not a separate stored value.
- Frontend: `useAuthStore`'s `AuthUser` type now carries `role`; `login()` / `verifyEmail()` / session-restore read `data.user.role` instead of a top-level `data.role`.
- **Enforcement added:** `role` is no longer purely informational. A new `UserRoleGuard` (`apps/api/src/auth/guards/user-role.guard.ts`) reads `req.user.role` — already populated by `JwtAuthGuard` via `AUTH_USER_SELECT` — and a `@RequireUserRole(...roles)` decorator marks which roles a route allows. All four accounting controllers are gated with `@RequireUserRole('CEO', 'ACCOUNTANT')`; any other authenticated user (including `role: null`) now gets `403 Forbidden`. This is a separate, simpler guard from the pre-existing workspace-membership `RolesGuard`/`@Roles()` (`apps/api/src/roles/`), which checks a different `Role` enum (`OWNER`/`ADMIN`/`MEMBER`) via a DB lookup — `UserRoleGuard` needs no DB lookup since `role` is already on the JWT-authenticated user.

## 6. Known Gaps / Current Limitations

- `PATCH /clients/:clientId` cannot update `totalRevenue` or `currencyType` — only `clientName`. These fields are currently create-only.
- `Clients.totalRevenue` (manually entered at creation) and `totalSaleAmount` (computed by summing `Transaction.saleAmount` per currency) are two independent "how much has this client generated" numbers. Nothing keeps them in sync — creating/updating transactions does not touch `totalRevenue`, and there's no reconciliation job. This also means the dashboard's `topClients` (ranked by `totalRevenue`) can disagree with what `/clients` shows as `totalSaleAmount` for the same client.
- Role enforcement is coarse: `CEO` and `ACCOUNTANT` both get identical, full access (read + write) to all four modules. There's no finer-grained split (e.g. `ACCOUNTANT` can enter data but only `CEO` can delete) — not built because nothing asked for it yet.
- None of these four modules are workspace-scoped, unlike most of the rest of the API. They are effectively single global ledgers shared across the whole app, not per-workspace.
- `findOrCreateClientByName` is dead code (commented out) in `transaction.service.ts`, kept intentionally for reference.
- `BankAccount` has no relation to `Clients` or `Transaction` — it's a separate, unconnected ledger for now.
- `EXCHANGE_RATES_TO_USD` (in `accounting-dashboard.constants.ts`) is a hardcoded, manually-maintained rate table — there's no live FX rate provider wired up. Every "in USD" figure in the dashboard overview is only as accurate as those fixed rates.
- `revenueOverview`'s bucketing loads every matching `Transaction` row into memory and buckets it in JS rather than doing the grouping in SQL — fine at current data volumes, but worth revisiting (e.g. `groupBy` with a truncated date) if the table grows large.
- **Migration note for `saleDate`:** the column was added as `DateTime @default(now())`, so `prisma db push` backfills existing rows with the timestamp of whenever the migration is run — not their true historical sale date. If preserving historical accuracy for rows that existed before this change matters, run `UPDATE "Transaction" SET "saleDate" = "createdAt";` once, by hand, right after applying the schema change (this wasn't run automatically — nothing here executes DB-writing commands on its own). Seeded/test data doesn't need this since re-running `npm run seed:accounting` populates `saleDate` correctly from scratch.

## 7. Suggested Frontend Data Flow

Accounting dashboard (`/accounting-dashboard/*`)
1. On sign-in, if `user.role === "ACCOUNTANT"`, redirect to `/accounting-dashboard` (Overview).
2. Overview / Transactions / Clients / Accounts & Balances / Reports are separate routes sharing one sidebar layout — currently static placeholders, not yet wired to these APIs.
3. When wiring up real data:
   - Overview screen → `GET /accounting-dashboard/overview?period=daily|weekly|monthly|yearly` — one call backs the whole screen (balances, revenue summary cards, revenue chart, platform/currency breakdowns, bank account lists, top clients).
   - Clients list/detail → `GET /clients` / `GET /clients/:clientId`.
   - Client picker (e.g. "assign transaction to client") → `GET /clients/search?q=`.
   - Transactions table → `GET /transactions`, filterable by `clientId`.
   - Bank accounts / balances → `GET /bank-accounts`.
4. Creating a transaction from the UI requires a resolved `clientId` up front (e.g. via the client search/picker) — the API no longer accepts a bare client name.
