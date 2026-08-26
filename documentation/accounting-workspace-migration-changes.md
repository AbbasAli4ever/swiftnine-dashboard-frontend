# Accounting Feature — Changelog

Record of what changed and why, in chronological order. This is the *only* doc that gets updated for accounting changes — earlier sections describe what was true *at that point* and later sections may supersede them (e.g. the debit/credit balance sync described early on was later replaced — see "Follow-up: remove CREDIT/DEBIT from transactions"). `docs/accounting-api.md` exists as an older reference snapshot but is **not** kept in sync anymore — treat anything in it as potentially stale; this file is the source of truth.

**Standing convention**: every change to the accounting feature (`clients`, `transactions`, `bank-accounts`, `accounting-dashboard`, workspace `accountingRole`) gets a new dated/titled `## Follow-up: ...` section appended here — not just left in git history, not documented elsewhere. Nothing else gets updated for this — not `accounting-api.md`, no separate doc. Only this file.

## Why

The accounting feature (`clients`, `transactions`, `bank-accounts`, `accounting-dashboard`) was originally built as a single global ledger shared across the whole app, with one global `role` (`CEO` | `ACCOUNTANT`) on `User`. The business need changed: an accountant should be scoped to one workspace, and every client/transaction/bank account should belong to a specific workspace instead of one shared pool. Separately, transactions needed to be linked to a specific bank account, debiting or crediting its balance based on the transaction's type.

## Schema changes (`prisma/schema.prisma`)

- **Role relocated, not duplicated**: removed `role UserRole?` from `User`. Added `accountingRole UserRole?` to `WorkspaceMember`, sitting alongside the pre-existing workspace `role` (`OWNER`/`ADMIN`/`MEMBER`) and `aiModelTier` — same "independent per-membership attribute" pattern already used there. The `UserRole` enum itself (`CEO`, `ACCOUNTANT`) is unchanged, just relocated to a different model.
- Added required `workspaceId` (+ FK to `Workspace`, `onDelete: Cascade`, `@@index`) to `Clients`, `Transaction`, and `BankAccount`.
- Changed `Transaction.refId` from a global `@@unique` to `@@unique([workspaceId, refId])` — reference IDs only need to be unique within a workspace now.
- Added `enum TransactionType { CREDIT DEBIT }`.
- Added to `Transaction`: required `bankAccountId` (FK to `BankAccount`, `onDelete: Restrict` — deliberately not `Cascade`, unlike `Transaction.clientId`, so a bank account with transaction history can never be silently deleted along with its ledger) and `type TransactionType @default(CREDIT)`.
- Added back-relation fields on `Workspace` (`clients`, `transactions`, `bankAccounts`) and on `BankAccount` (`transactions`), required by Prisma for the new relations.

## Migration

One migration: `prisma/migrations/20260811083456_accounting_per_workspace/migration.sql`.

- Existing `Clients`/`Transaction`/`BankAccount` rows were **wiped** (`TRUNCATE`), not backfilled — confirmed as disposable test/seed data with no real business records at the time. Anyone applying this migration against a database with real accounting data would lose it; that wasn't the situation here.
- Generated via schema-to-schema diff (`prisma migrate diff --from-schema <old> --to-schema <new> --script`) — no database or shadow database was touched to produce it. The `TRUNCATE` line was added by hand afterward since diffing doesn't emit data-destructive statements on its own.

## Auth changes

- `WorkspaceGuard` (`apps/api/src/workspace/workspace.guard.ts`) now also selects `accountingRole` in its existing `WorkspaceMember` lookup and includes it in `req.workspaceContext` — one query, no extra DB round-trip.
- `WorkspaceContext` type (`apps/api/src/workspace/workspace.types.ts`) gained `accountingRole: UserRole | null`.
- `RolesGuard` (`apps/api/src/roles/roles.guard.ts`) updated to match — it independently constructs `req.workspaceContext` in its own fallback path, so it needed the same field to stay consistent with `WorkspaceGuard`. Also switched its local type to reuse `WorkspaceContext` instead of a duplicate inline type, so the two can't drift apart again.
- **Renamed** `apps/api/src/auth/guards/user-role.guard.ts` → `accounting-role.guard.ts`: `UserRoleGuard` → `AccountingRoleGuard`, `RequireUserRole` → `RequireAccountingRole`, `USER_ROLE_KEY` → `ACCOUNTING_ROLE_KEY`. Internals changed from reading `req.user?.role` (global, no DB lookup needed) to reading `req.workspaceContext?.accountingRole` (per-workspace, populated by `WorkspaceGuard`) — must now run *after* `WorkspaceGuard` in the guard chain.
- Removed now-dead `User.role` references:
  - `AUTH_USER_SELECT` (`auth.constants.ts`) no longer selects `role`.
  - `AuthUserDto` (`auth-response.dto.ts`) no longer has a `role` field.
  - The Google OAuth callback (`auth.controller.ts`) no longer appends `role` to its redirect URL.
  - `USER_PROFILE_SELECT` / `UserProfile` / `toUserProfile()` (`user.service.ts`) no longer select or return `role`.

## The four modules

Applied the same pattern to `clients`, `bank-accounts`, `transactions`, and `accounting-dashboard`:

- Controllers: guard chain changed to `@UseGuards(JwtAuthGuard, WorkspaceGuard, AccountingRoleGuard)`, class-level `@RequireAccountingRole('CEO', 'ACCOUNTANT')`, added `@ApiHeader({ name: 'x-workspace-id', required: true, ... })`. Every handler now takes `@Req() req: WorkspaceRequest` and passes `req.workspaceContext.workspaceId` into the service call. No route paths changed — scoping is header-only, matching how `/projects` already works.
- Services: every Prisma query's `where`/`data` now includes `workspaceId`. `findOne`/`update`/`remove` scope lookups by `{ id, workspaceId }` together so a caller can't reach another workspace's row by guessing an id.
- Modules: added `imports: [WorkspaceModule]` (bank-accounts keeps its existing `CommonModule` import too, for `PublicAssetsS3Service`).
- `accounting-dashboard.service.ts`: all 8 query methods (including the raw-SQL `getRevenueOverview`, where the workspace filter was added inside the `LEFT JOIN`'s `ON` clause) now scope by workspace.

### Transactions ↔ bank accounts: debit/credit balance sync

New logic in `transaction.service.ts`:

- **Validation**: a new `findBankAccountOrThrow` (mirrors the existing `findClientOrThrow`) resolves the target bank account within the workspace, `404` if missing. `assertCurrencyMatches` rejects with `400` if the transaction's `currency` doesn't exactly match the bank account's `currencyType` — there's no FX conversion anywhere in this feature, so this is a hard requirement.
- **Create**: bank account balance adjustment and transaction-row creation happen inside one `prisma.$transaction`, using Prisma's atomic `increment` (a negative value for `DEBIT`) rather than read-then-write, to avoid races under concurrent requests.
- **Update**: if `bankAccountId`, `saleAmount`, `currency`, or `type` change, the transaction's prior effect is reversed on its *old* bank account and the new effect applied to the new (possibly same) one — both inside one `$transaction`, so a same-account edit nets out correctly and a cross-account move never leaves one side unmatched. Changing only `clientId`/`clientName`/`description`/`saleDate` skips this entirely — no balance touched.
- **Delete**: the transaction's effect is reversed on its bank account before the row is removed.
- **Bank account delete**: `bank-account.service.ts`'s `remove()` now checks for linked transactions and returns `409` (`BANK_ACCOUNT_HAS_TRANSACTIONS`) rather than letting the new DB-level `ON DELETE RESTRICT` surface as a raw, unhandled error.
- DTOs (`create-transaction.dto.ts`, `update-transaction.dto.ts`), the response shape (`transaction-response.dto.ts`, `TRANSACTION_SELECT`), and Swagger docs on the controller were all updated to carry `bankAccountId`/`type` and the nested `bankAccount: { id, bankName }`. **Correction**: `type` on create is **required** at the API/DTO level (no `.default('CREDIT')` on the zod schema — omitting it returns `422`), not optional as originally implemented and documented here. The Prisma schema still carries `type TransactionType @default(CREDIT)` (a DB-level default, unaffected by this) — that's a deliberate safety net for any future direct-DB writer, not a contradiction; the API simply now requires the caller to state intent explicitly rather than silently assuming `CREDIT`. `bankAccountId` was correctly required from the start.

## Follow-up: making `accountingRole` reachable through the API

The refactor above left `accountingRole` **enforced but unreachable** — it gated every accounting endpoint, but no endpoint returned it and no endpoint could set it. Every membership was `NULL`, so the whole accounting feature 403'd for every user, and the only way to grant access was a direct DB write. `docs/accounting-api.md` told the frontend to "check the current workspace membership's `accountingRole`" via an endpoint that didn't exist. This was originally written up as a known limitation; that was wrong — an enforced field with no read or write path is a broken feature, not a documented gap. Closed as follows:

**Read:**
- `GET /workspaces/:workspaceId` now includes the caller's own `role` and `accountingRole`, sourced straight from `req.workspaceContext` (already populated by `WorkspaceGuard`) — no extra query, no schema change. This is the "who am I in this workspace" check the frontend needs to decide whether to show the accounting area at all, and to tell `CEO` (read-only) apart from `ACCOUNTANT` (read/write) so it can disable write controls. Probing can't substitute: `AccountingRoleGuard` throws an identical bare `403` for a null role and a wrong role.
- `accountingRole` added to `listMembers()` (`GET /workspaces/:workspaceId/members`) and `getMember()` (`GET /workspaces/:workspaceId/members/:memberId`), plus `MemberResponseDto` and `MemberDetailResponseDto`. Follows the `aiModelTier` precedent — the sibling per-membership attribute already exposed there. Pending invites report `accountingRole: null`, same reasoning as `aiModelTier` reporting its default: no membership row exists until the invite is accepted.

**Write:**
- New `PUT /organizations/members/:id/accounting-role`, OWNER-only, body `{ workspaceId, accountingRole }` where `accountingRole` is `'CEO' | 'ACCOUNTANT' | null` (`null` revokes access entirely). Deliberately mirrors the existing `PUT /organizations/members/:id/role` next to it — same controller, same guard chain (`JwtAuthGuard, RolesGuard` + `@Roles('OWNER')`), same `workspaceId`-in-body convention, same `memberId`-or-`userId` fallback resolution.
- Backed by `WorkspaceService.changeMemberAccountingRole()`, which mirrors `changeMemberRole()` exactly, including the `activityLog` entry (`action: 'member_accounting_role_changed'`, `fieldName: 'accountingRole'`) so role grants are auditable the same way workspace-role changes already are.
- New `ChangeMemberAccountingRoleDto` uses `@IsIn([...values, null])` rather than `@IsEnum` — `@IsEnum` can't express "or null", and `null` is a meaningful value here (revoke), not a missing one.

**Deliberately not done — needs a product decision:**
- **Self-elevation is unguarded.** An `OWNER` can grant themselves `CEO`/`ACCOUNTANT` and read all accounting data. Arguably fine (an OWNER already controls the workspace and can grant it to anyone anyway), but the previous DB-only state was an accidental air gap, so removing it is a real change. Options if it's not wanted: block `userId === req.user.id`, or require a shared secret the way `ChangeAiTierDto` does for AI tier changes.

## Follow-up: accountingRole at invite time, and auto-provisioned default bank accounts

**accountingRole settable at invite time**
- `WorkspaceInvite` gained `accountingRole UserRole?` (nullable, same enum, `@map("accounting_role")`) — one additive column, no data loss (`prisma/migrations/20260812090935_workspace_invite_accounting_role/migration.sql`).
- `InviteMemberDto` and `BatchInviteMembersDto` both gained `accountingRole: z.enum(['ACCOUNTANT','CEO']).nullable().default(null)` — independent of the existing `role` field, same "sits alongside, doesn't merge into" pattern as `aiModelTier`.
- `WorkspaceService.sendInviteToEmail` threads `accountingRole` through to `WorkspaceInvite.create()`; `sendInvite`/`sendBatchInvites` pass `dto.accountingRole` down. `getInviteDetails` also now selects and returns it, so an invite-preview screen can show what accounting access the invitee will get.
- `claimInvite` and `acceptInvite` both copy `invite.accountingRole` onto the new `WorkspaceMember` row verbatim, exactly as they already did for `role`.
- Verified live end-to-end: sent an invite with `accountingRole: 'ACCOUNTANT'`, confirmed the `workspace_invites` row, claimed it via a self-generated/self-hashed token (bypassing real email delivery), confirmed the resulting `workspace_members` row had `accounting_role: 'ACCOUNTANT'`. Test data cleaned up after.

**Auto-provisioned default bank accounts on first CEO/ACCOUNTANT acceptance**
- The moment `claimInvite` or `acceptInvite` creates a `WorkspaceMember` whose `accountingRole` is `CEO` or `ACCOUNTANT`, and the target workspace has zero `BankAccount` rows, a new private helper `WorkspaceService.provisionDefaultBankAccountsIfNeeded()` bulk-creates whatever starter set is defined in `apps/api/src/bank-accounts/default-bank-accounts.data.ts` — originally 12 accounts (5 `LOCAL`/`PKR`: HBL, UBL, Alfalah, BOP, Faysal; 7 `INTERNATIONAL`/`USD`: Whop, Slash, Payoneer, Airwallex, Wio, Mamo, Kraken), later edited directly in that file (outside this changelog's own changes) to 17 — 9 local, 8 international, including per-brand variants like "HBL Trio Cafe" and "Slash – 9Figures". Each entry gets `amount: 0` and a real `logoUrl` already uploaded to the public assets S3 bucket. Runs inside the same `$transaction` that creates the membership, right after it. **See that file directly for the current exact list** — deliberately not re-enumerated here since it's edited independently of this doc and has already drifted out of sync with an earlier version of this note once.
- Why: nothing previously created a workspace's bank accounts automatically — every account was either hand-created via `POST /bank-accounts` or came from the now-removed global seed script. A brand-new workspace's accounting screen would otherwise start completely empty.
- Starter list lives in `apps/api/src/bank-accounts/default-bank-accounts.data.ts` — logo URLs copied verbatim from `assets/bank-logo-urls.json` (hardcoded rather than read from that JSON at runtime, since it's a build-script artifact for `scripts/upload-bank-logos.ts`, not something the app's build copies into `dist/`). Every currently-uploaded logo is used; the two UAE-based platforms (`Wio`, `Mamo`) default to `USD` since `Currency` has no `AED` — the one place a currency choice was assumed rather than derived.
- Guarded twice: `if (!accountingRole) return;` (a plain `MEMBER` invite never triggers it) and `if (existingCount > 0) return;` (idempotent — accepting a second CEO/ACCOUNTANT invite into an already-provisioned workspace does not duplicate the starter accounts).
- **Known accepted race**: the count-then-create isn't safe against two people accepting a CEO/ACCOUNTANT invite into the same brand-new workspace at the exact same instant — Postgres's default `READ COMMITTED` isolation won't stop a concurrent transaction from also seeing `count === 0`. Same category of already-accepted gap as the `BankAccount.amount`/`Clients.totalRevenue` drift noted below — not solved with locking unless it turns out to matter in practice.

**`scripts/seed-accounting.js` removed**
- It predated workspace-scoping (raw SQL inserts into `Clients`/`Transaction`/`BankAccount` with no `workspaceId`, and no `bankAccountId`/`type` on `Transaction`) and was already broken against the current schema (see the "Known follow-ups" note below, from the original migration). Its old job — giving a workspace some bank accounts to start with — is now handled for real, per-workspace, by the auto-provisioning above, so it was deleted rather than fixed for a data model it predates.

## Follow-up: Reports section (Daily Report + Monthly Breakdown)

Product brief (`Accounting_Revenue_Management_UIUX_Flow.pdf`) asked for a Reports section (Daily/Monthly/Yearly) replacing a manual WhatsApp reporting habit. Two new read-only endpoints on the existing `accounting-dashboard` module — no new module, no schema change, no migration:

- **`GET /accounting-dashboard/daily-report?date=YYYY-MM-DD`** — `AccountingDashboardService.getDailyReport()`. Live-computed for one date: `revenueUsd`, `salesCount`, `balances` (reuses `getBalances()` as-is), `clientPayments`. Deliberately **not** a persisted/submitted snapshot — considered a frozen `DailyReport` entity matching the brief's "Submit Daily Report" language, decided against to keep this simple. Trade-off: numbers can move if a transaction is edited after the fact, and the balance fields are always *current*, not historically accurate for a past date (no balance-history/ledger exists — same category of accepted gap as `Clients.totalRevenue` drift).
- **`GET /accounting-dashboard/monthly-breakdown?year=YYYY`** — `AccountingDashboardService.getMonthlyBreakdownForYear()`. `/overview?period=yearly` buckets by *year* (5 yearly totals), which can't produce the brief's Jan–Dec-of-one-year chart — this fixes the bounds to that year instead. Implemented by extracting the bucketing logic already in `getRevenueOverview()` into two reusable private helpers (`queryBucketedRevenue`, `aggregateBucketRows`) so both methods share the exact same `generate_series` SQL rather than duplicating it.
- Monthly Reports needed no backend change at all — `/overview?period=monthly` already returns everything (including month-over-month `changePercent`); "Average Sale" is `totalUsd / totalSales.count`, derivable client-side. Same for "Best Revenue Month" on the yearly side — `max()` over `monthly-breakdown`'s `points`, no extra field.
- **Explicitly not done at the time**: renaming `paymentPlatform` to a bank-account-based grouping was considered (the brief's own account list has "Whop" and "Whop – Mutetaxes" as separate accounts, and every new platform today costs a migration + edits across ~6 files) but scoped **out** of this change at the user's direction — ~~`paymentPlatform` is untouched~~ **it was fully removed later — see "Follow-up: remove `paymentPlatform` from transactions" below.** A pre-existing bug was also found and left alone by explicit instruction: `getRevenueSummary`/`getRevenueByCurrency`/the trend chart all sum `saleAmount` with no `CREDIT`/`DEBIT` netting (a refund currently adds to "revenue" instead of subtracting) — real, but out of scope here (later made moot entirely — see the CREDIT/DEBIT removal follow-up below).
- **Bug found and fixed after initial ship**: `getMonthlyBreakdownForYear()`'s `firstStart`/`lastStart` were built with `new Date(year, 0, 1)` / `new Date(year, 11, 1)` — local-time construction. On a host with a positive UTC offset (confirmed live: UTC+5), local midnight Jan 1 serializes to `2025-12-31T19:00:00.000Z`, shifting every `generate_series` bucket back a day and drifting the month labels (observed live: March duplicated, June's total attributed to May, December missing entirely). Fixed by building both boundaries with `Date.UTC(...)` instead, pinning the wall-clock digits sent to Postgres regardless of host timezone. Re-verified live: 12 unique labels, exact Jan–Dec order, each value on its correct month. The identical pattern likely exists in the pre-existing `getBucketConfig()`/`getRevenueOverview()` (unmodified, used by `/overview`) — flagged to the user, left untouched pending a decision.

## Follow-up: remove CREDIT/DEBIT from transactions

Workflow changed: there is no debit/credit distinction anymore, and no inter-account transfers. A transaction is simply a sale that always credits its bank account — confirmed with the user that the auto-balance-sync behavior itself stays, only the "which direction" choice goes away.

- Removed `Transaction.type` and the `TransactionType` enum from `prisma/schema.prisma` entirely (migration `20260813162830_remove_transaction_type`: `DROP COLUMN "type"` + `DROP TYPE "TransactionType"` — data loss on 2 leftover dev-test rows, confirmed disposable before applying).
- `transaction.service.ts`: `create()` always `increment`s the bank account by `saleAmount` (no more type-based sign). `update()`'s `balanceFieldsChanged` check and reversal/reapply logic dropped the `type` branch — old effect is always `-saleAmount`, new effect is always `+newAmount`. `remove()`'s reversal is always `-saleAmount`.
- `type` removed from `create-transaction.dto.ts`, `update-transaction.dto.ts`, `transaction-response.dto.ts`, and `TRANSACTION_SELECT`/`TRANSACTION_TYPE_VALUES` in `transaction.constants.ts`.
- **Side effect, not a fix**: the previously-flagged "revenue sums don't net CREDIT against DEBIT" gap (`getRevenueSummary`/`getRevenueByCurrency`/the trend chart) is now moot rather than resolved — with no more `DEBIT`, every stored `saleAmount` is inherently a positive contribution, so those sums are correct without having touched them.
- `paymentPlatform`, the currency-match validation, and the bank-account-delete restriction (`409`/`ON DELETE RESTRICT`) are all unaffected — untouched.
- Verified live: create with no `type` in the payload → balance increases by exactly `saleAmount`; update `saleAmount` → balance reflects only the new amount; delete → balance decreases back to the pre-create value. Test data cleaned up after.

## Follow-up: Overview screen — balance-driven breakdowns, top-4 accounts, revenue audit

> **Partly superseded** — the two balance-driven breakdowns introduced here (`getAccountBalances`, `getBalancesByCurrency`) were later switched *back* to being transaction-driven and renamed to `getRevenueByBankAccount`/`getRevenueByCurrency`. See "Follow-up: Overview's two balance panels switched to all-time revenue" at the end of this doc. The `BANK_ACCOUNTS_PER_GROUP_LIMIT` change, the `console.log` cleanup, and the revenue KPI audit below all still stand.

Two of the Overview screen's revenue breakdowns are now balance-driven instead of transaction-driven, per a walkthrough of the actual dashboard screenshot:

- **`getRevenueByPaymentPlatform` → `getAccountBalances`**: no longer groups `Transaction` by `paymentPlatform`. Now lists `BankAccount`s in the workspace, each with its own balance converted to USD, sorted descending. `DashboardOverview.revenueByPaymentPlatform` → `accountBalances`; `PlatformRevenueItem` → `AccountBalanceItem` (`{ id, bankName, accountType, currencyType, amount, amountUsd }`). ~~Initially listed both `LOCAL`/`INTERNATIONAL` accounts together, uncapped~~ — **scoped down to `INTERNATIONAL`-only shortly after — see "Follow-up: `accountBalances` scoped to international accounts only" below.**
- **`getRevenueByCurrency` → `getBalancesByCurrency`**: same output shape (`total`, `totalUsd`, `percent`), now summing `BankAccount.amount` grouped by `currencyType` instead of `Transaction.saleAmount` grouped by `currency`. `DashboardOverview.revenueByCurrency` → `balancesByCurrency`; `CurrencyRevenueItem` → `CurrencyBalanceItem`.
- **`BANK_ACCOUNTS_PER_GROUP_LIMIT`**: `5` → `4` — the Local/International Accounts panels now cap at 4 each.
- **Cleanup while in this code**: removed two leftover debug `console.log` calls in `getBalances()` that were firing on every single `/overview` and `/daily-report` call.
- **Revenue KPI audit** (`getRevenueSummary`, `getBucketConfig`/`getRevenueOverview`) — asked to "fix issues" with no specific symptom given, so this was a live audit rather than a pre-specified change. First pass looked broken: a transaction dated 1 minute before local midnight showed up in "today's" revenue alongside one dated 1 minute after. Root cause turned out to be the **test setup, not the app**: the test inserted rows via raw `pg`, which serializes a bare JS `Date` to a `timestamp` (no timezone) column using the process's local-time getters — a different convention than Prisma's own serialization. Re-tested with both the write (`POST /transactions`) and read (`GET /overview`) going through the real API — i.e., through Prisma both ways — and the boundary was exact (only the "today" transaction counted). **Conclusion: no bug in `getRevenueSummary`/`getRevenueOverview`; left unchanged.** This is a real, worth-remembering distinction from the `getMonthlyBreakdownForYear` fix earlier in this doc — that one was genuinely broken because it used raw `$queryRaw` with an explicit `::timestamp` cast, a fundamentally different code path from Prisma's normal ORM query builder, which handles `DateTime` parameters consistently regardless of the host's local timezone.

Overview screen follow-up, verified separately:
- `tsc`, `eslint`, `nest build` clean.
- Live: a fresh workspace's 17 auto-provisioned accounts plus 2 more added directly (`EUR`, `AED`, for multi-currency coverage) — 19 total across `LOCAL`/`INTERNATIONAL` and 4 currencies (PKR, USD, EUR, AED) — with known balances → `accountBalances` listed every one sorted by `amountUsd` descending; `balancesByCurrency` sums matched hand-computed totals exactly, `percent` summed to ~100 (rounding); Local/International panels capped at 4 each. Revenue KPI boundary-tested and confirmed correct (see Follow-up above) via the real API round-trip. Test data cleaned up after.

## Follow-up: Reports section brought in line with the new flow

Checked both Reports endpoints (`daily-report`, `monthly-breakdown`) against everything that changed above (CREDIT/DEBIT removal, Overview's balance-driven breakdowns). Asked the user whether to also mirror Overview's new `accountBalances`/`balancesByCurrency` breakdowns inside Daily Report — declined; kept to small consistency fixes only:

- **`monthly-breakdown`**: audited, no `type`/`TransactionType` references anywhere, already fully consistent — no change needed.
- **`daily-report`**: `clientPayments` items gained a nested `bankAccount: { id, bankName, logoUrl }`, matching the same nested shape `GET /transactions` already returns (added earlier this session) — previously `daily-report` only had the flat `paymentPlatform` field with no bank/logo info at all. `DailyReportClientPayment` type, the `transaction.findMany` select, and `DailyReportResponseDto` all updated together.
- Verified live against the persisted demo workspace (see below) — `GET /daily-report?date=<today>` now returns real logo URLs per client payment.

## Follow-up: remove `paymentPlatform` from transactions

Confirmed with the user: bank accounts are now the primary concept everywhere (auto-provisioned, balance-driven Overview screen, no more CREDIT/DEBIT) — `paymentPlatform` had become redundant. For international accounts the bank account already *is* the platform (a "Whop" account, a "Slash" account), and the field stopped feeding any dashboard aggregation once the Overview follow-up replaced revenue-by-platform with balance-by-account. Removed entirely, mirroring the exact pattern already used for the `TransactionType`/CREDIT-DEBIT removal.

- Removed `Transaction.paymentPlatform` and the `PaymentPlatform` enum from `prisma/schema.prisma` (migration `20260813181149_remove_payment_platform`: `DROP COLUMN "paymentPlatform"` + `DROP TYPE "PaymentPlatform"` — data loss on 11 non-null values, all dev/demo data, confirmed disposable before applying; this included the persisted demo workspace's transactions, but only that one column's values — the workspace, accounts, clients, and transaction rows themselves were untouched).
- Removed from every place it appeared: `transaction.constants.ts` (`PAYMENT_PLATFORM_VALUES`, `TRANSACTION_SELECT`), all three transaction DTOs (create/update/response), the list-transactions filter (`list-transactions-query.dto.ts` + `transaction.controller.ts`'s `@ApiQuery`), `transaction.service.ts` (create/update/findAll), `clients.constants.ts` (`CLIENT_TRANSACTION_SELECT`) + `client-response.dto.ts` (nested transaction item), and `accounting-dashboard.service.ts`'s `DailyReportClientPayment`/`getDailyReport()` + `daily-report-response.dto.ts`.
- Verified live against the persisted demo workspace: created a transaction with no `paymentPlatform` in the payload → confirmed the field is absent from the create response, `GET /transactions/:id`, the client-detail nested transaction list, and `daily-report`'s `clientPayments`. `GET /transactions?paymentPlatform=WHOP` still returns `200` (the query param is just silently ignored now, not a validation error, since zod strips unrecognized keys by default). Cleaned up only the one test transaction — the demo workspace's original seeded data was left untouched.
- Re-checked older entries in this doc for staleness this creates, per the standing convention above — updated the "Reports section" follow-up's "Explicitly not done" bullet, which had said `paymentPlatform` was untouched.

## Follow-up: `accountBalances` scoped to international accounts only

> **Superseded** — `accountBalances` no longer exists. This whole panel was switched from balances to all-time revenue and renamed to `revenueByBankAccount`, and the international-only scope described below was **deliberately reversed** (it now includes `LOCAL` accounts too). See "Follow-up: Overview's two balance panels switched to all-time revenue" at the end of this doc. Kept as-is below for history.

Frontend flagged the Overview screen's "Revenue by Payment Platform" panel as showing incorrect numbers. Walked through the actual rendered screenshot with the user again: that panel is supposed to show **international account balances only**, descending — not local accounts mixed in. The other two panels it was compared against are unchanged: "Revenue by Currency" (`balancesByCurrency`, both types, unaffected) and the local/international bank-account lists (`bankAccounts.local`/`bankAccounts.international`, already correct — top 4 each by balance descending, per the earlier Overview follow-up).

- **`getAccountBalances()`**: added `accountType: 'INTERNATIONAL'` to the `bankAccount.findMany` where-clause. Previously returned every account of both types; now international-only. `LOCAL` accounts are only surfaced via `bankAccounts.local`, not duplicated into this list.
- No shape change — `AccountBalanceItem`/`AccountBalanceItemDto` and the `accountBalances` field name are untouched, only which rows populate it. Kept the field name as-is rather than renaming (e.g. to `internationalAccountBalances`) since the frontend is already integrating against this contract and the task was to fix the data, not the API shape.
- Updated the Swagger description on `GET /overview` and the DTO's field/example values (`bankName`/`accountType`/`currencyType` examples switched from a local `HBL`/`PKR` example to an international `Whop`/`USD` one, matching what this list actually contains now).
- Docs: `docs/accounting-api.md`'s `accountBalances`/`bankAccounts` bullets corrected to describe the international-only scope. Re-checked this doc per the standing convention — the "Overview screen" follow-up above described `accountBalances` as "every BankAccount... both types together"; added a strikethrough + pointer to this section rather than silently rewriting history.
- Verified live against the persisted demo workspace: `tsc`/`eslint`/`nest build` clean, then `GET /overview` (JWT signed locally with `JWT_ACCESS_SECRET` for the demo accountant, no login flow needed) → every item in `accountBalances` came back `accountType: 'INTERNATIONAL'` (8 accounts: Slash, Whop, Airwallex, Wio, Payoneer, Mamo, Kraken, Slash – 9Figures), sorted by `amountUsd` descending, no local account ids present. `bankAccounts.international`'s top 4 (Slash/Whop/Airwallex/Wio) matched the head of that same list, as expected. No test data created or needing cleanup — read-only verification against existing demo data.
- **Also seeded dummy data while verifying**, at the user's request, so the Overview screen has something real to look at: the demo workspace's 5 `Clients` all had `totalRevenue: 0` despite having real transactions (a pre-existing, separately-known drift — `totalRevenue` isn't synced from `Transaction`s and isn't exposed on `UpdateClientDto`, so it was set directly via SQL) — updated to varied values (Victoria Partners 32400, Acme Corp 25000, ABD LTD 18700, Phase Shop 12300, Anton Enne 8100) so `topClients` shows a real descending list instead of five ties at zero. Bank account balances and existing transactions were already varied and realistic (matching the screenshot's numbers) and needed no change. Nothing was deleted.

## Verification performed

Static checks, run after every step:
- `npx tsc --noEmit -p tsconfig.build.json` — clean.
- `npx eslint` on every touched file — clean. Pre-existing lint errors do exist in files this change touched but on lines it didn't (`roles.guard.ts`, `workspace.controller.ts`, `organizations.controller.ts`, `workspace.service.ts`, `user.controller.ts`) — left alone, not introduced here.
- `npx nest build api` — clean.
- `prisma validate` + `prisma migrate diff` — no drift between `schema.prisma` and the generated migration.

Live end-to-end testing against the local Postgres + running dev server (`curl`, real JWT, real workspace), after syncing the local DB via `prisma db push`:
- Bank account create (USD + PKR), client create — OK.
- `CREDIT` 250 → balance `1000 → 1250`. `DEBIT` 100 → `1250 → 1150`. Update amount `250 → 400` → `1150 → 1300` (old effect reversed, new applied). Delete the `DEBIT` → `1300 → 1400` (effect reversed). All exact.
- USD transaction against a PKR bank account → `400`, correct message.
- Delete a bank account with transactions → `409`.
- Missing `x-workspace-id` → `403`. Workspace isolation: another workspace's rows invisible in list, `404` on direct fetch by id.
- `CEO` blocked on create/update/delete/logo-presign (`403`), allowed on reads (`200`). `accountingRole: null` → `403` on everything.
- `GET /workspaces/:id` and `/members` return `accountingRole`; `PUT .../accounting-role` sets `CEO`, `ACCOUNTANT`, and `null`, each confirmed by re-reading and by the corresponding change in accounting-endpoint access.

accountingRole-at-invite and bank-account auto-provisioning follow-up, verified separately:
- `tsc`, `eslint`, `nest build` clean for both changes.
- accountingRole-at-invite: sent an invite with `accountingRole: 'ACCOUNTANT'` → confirmed on the `workspace_invites` row → claimed via a self-generated/self-hashed token → confirmed `workspace_members.accounting_role` matched. Test data cleaned up after.
- Bank-account auto-provisioning, against the real dev server + DB: (1) `CEO` claims a brand-new workspace → exactly 12 accounts created (5 `LOCAL`/7 `INTERNATIONAL`, all `amount: 0`, all with a `logoUrl`); (2) a plain-member (`accountingRole: null`) claim into a different fresh workspace → 0 accounts created; (3) a second `ACCOUNTANT` claim into the *same*, already-provisioned workspace → still 12, no duplicates; (4) the authenticated `acceptInvite` path (not just `claimInvite`) into a fresh workspace → 12 accounts created. All test data cleaned up after.

**One real bug found only by the live testing** — `getRevenueOverview()`'s raw SQL referenced `t."workspaceId"`, but the actual Postgres column is `workspace_id` (the schema `@map`s it). `$queryRaw` bypasses Prisma's field-name mapping, so this was valid TypeScript and valid SQL that failed at runtime with a `500`. `tsc`, `eslint`, and `nest build` all passed on it. Fixed. Worth remembering: **any `$queryRaw` touching a `@map`ped column must use the DB column name, and only a real query proves it.**

## Known follow-ups (not done as part of this change)

- ~~`scripts/seed-accounting.js` is now broken~~ — **removed.** See the "accountingRole at invite time, and auto-provisioned default bank accounts" follow-up above: a workspace now gets real bank accounts automatically on first CEO/ACCOUNTANT acceptance, so there was no reason to fix the script for a data model it predates.
- ~~Pre-existing auth hole, now leaking one more field~~ — **fixed.** `GET /workspaces/:workspaceId/members/:memberId` was guarded by `JwtAuthGuard` only — no `WorkspaceGuard`, no `RolesGuard` — so any authenticated user could read any member's full detail (including, after this refactor, `accountingRole`) in any workspace by id. Confirmed the frontend never calls this route without the workspace context it'd now require, so added `WorkspaceGuard` to the route and switched the handler to read `workspaceId` from `req.workspaceContext` (guard-verified) instead of the raw `:workspaceId` URL param, so the two can't disagree. Verified live: no header → `403`; header naming a workspace the target member isn't actually in → `404`; correct workspace → `200` with full detail as before.
- No frontend changes were made — this is a backend-only change. The frontend needs to start sending `x-workspace-id` on every accounting request, and `bankAccountId` on every transaction create/update (see `docs/accounting-api.md` section 7 for the suggested flow, including using `GET /bank-accounts` to populate a bank account picker).
- `Clients.totalRevenue` vs. `totalSaleAmount` drift, and the equivalent new drift risk on `BankAccount.amount` vs. the sum of its transactions, are both unresolved — `amount` stays directly editable via `PATCH /bank-accounts` by design (confirmed with the user), not synced against transaction history beyond the automatic credit each transaction itself applies (no more debit/credit distinction as of the CREDIT/DEBIT removal follow-up above — every transaction is a credit now).

## Follow-up: Overview's two balance panels switched to all-time revenue

Frontend asked for the Overview screen's top-right pair of panels to show **revenue** instead of **balances** — "Balance by Bank Account" → **Revenue by Bank Account**, "Balance by Currency" → **Revenue by Currency**, each showing total sales across all history. The Local/International Accounts panels underneath are unchanged and still balance-driven: per the user, "the Local Accounts panel should show the balances in the bank accounts not the revenue."

This partly reverts the direction of the original migration, which had converted these same two panels *from* revenue *to* balances (`getRevenueByPaymentPlatform` → `getAccountBalances`, `getRevenueByCurrency` → `getBalancesByCurrency`, above). They are now revenue-driven again, but keyed on `bankAccountId` rather than the long-gone `paymentPlatform`.

- **`getAccountBalances` → `getRevenueByBankAccount`**: groups `Transaction` by `[bankAccountId, currency]` with no `saleDate` filter (all-time), converts each currency group at its own rate, and joins against the full `BankAccount` list so accounts with no sales still render at `0`. `accountBalances` → `revenueByBankAccount`; `AccountBalanceItem` → `BankAccountRevenueItem` (`{ id, bankName, accountType, currencyType, totalRevenue, totalRevenueUsd, salesCount }`).
- **Scope widened to both account types.** The old panel was `INTERNATIONAL`-only (see the follow-up above). Revenue-by-account covers `LOCAL` too, on the user's instruction — the duplication concern that motivated the international-only scope doesn't apply now that the lower panels show balances and these show revenue, so the two cuts no longer overlap.
- **`getBalancesByCurrency` → `getRevenueByCurrency`**: same output shape (`total`, `totalUsd`, `percent`), summing `Transaction.saleAmount` grouped by `Transaction.currency` instead of `BankAccount.amount` by `currencyType`. `balancesByCurrency` → `revenueByCurrency`; `CurrencyBalanceItem` → `CurrencyRevenueItem`.
- **Fields renamed rather than silently repurposed** — chosen by the user over keeping the old names. Breaking change: the frontend must rename both response fields, and `amount`/`amountUsd` → `totalRevenue`/`totalRevenueUsd` on the account items.
- **`totalRevenue` is nullable.** `Transaction.currency` is its own column and the schema does not constrain it to the account's `currencyType`; `TransactionService.assertCurrencyMatches` does, at the service layer. So today there's exactly one currency per account and the native total is well-defined — but if that rule is ever relaxed, the field returns `null` instead of summing unlike currencies into a meaningless number. `totalRevenueUsd` is always populated.

**Docs housekeeping for this change:**
- `docs/accounting-api.md`'s three affected Overview bullets (`accountBalances`/`balancesByCurrency`/`bankAccounts`) were rewritten to match. This is a **deviation from the standing convention** at the top of this doc, which says only this changelog gets updated and `accounting-api.md` is left as a deliberately-stale snapshot — the edit was made before re-reading that rule, and kept afterwards on the user's call, since a more accurate snapshot beats a stale one. Noted here rather than quietly left, so the convention and the actual state of the repo don't disagree silently.
- Two older sections in this doc were marked superseded (blockquote + pointer, the same treatment the "international accounts only" section itself used on its predecessor): "Overview screen — balance-driven breakdowns" (partly — its non-breakdown items still stand) and "`accountBalances` scoped to international accounts only" (fully — the field is gone and its international-only scope was deliberately reversed).
- **Pre-existing inaccuracy spotted and fixed** (not introduced by this change): `docs/accounting-api.md`'s "Common Rules" said the `Currency` enum is `USD`, `HKD`, `PKR`. It actually has **seven** values — `USD`, `AED`, `HKD`, `PKR`, `EUR`, `GBP`, `CRYPTO` — confirmed against `enum Currency` in `prisma/schema.prisma` and `CURRENCY_VALUES` in `transaction.constants.ts`. Corrected, with a pointer to the source of truth and a note that each value needs a matching `EXCHANGE_RATES_TO_USD` entry (`CRYPTO` is a `1:1` placeholder, not a real rate). Grepped the rest of `docs/` for the same stale three-value list — no other occurrences.

**Revenue and balance are related but genuinely different numbers**, which is worth stating since the two now sit on the same screen. Every transaction increments `BankAccount.amount` by `saleAmount` (`transaction.service.ts`, with reversals on update/delete), so balance accumulates from revenue — but they diverge on: (1) an account's starting balance, which no transaction produced; (2) direct `PATCH /bank-accounts` edits to `amount`, which stay supported by design; (3) edited transactions, where the balance keeps only the net while revenue reflects the current row. Revenue here is "sum of transactions that currently exist," not an immutable audit log.

### Verification
- `tsc`, `eslint`, `nest build` clean. No stale references to the old names anywhere in `apps/`/`libs/` (grepped).
- **Verified live against the `Swiftnine` workspace** via the real API (logged in as `accountant@swiftnine.com`, `POST /auth/login` → bearer token → `GET /overview`). The workspace starts with 13 bank accounts and **zero** transactions — which is why the reported screenshots show `$0` / `0.0%` everywhere; that is real, not a bug.
- Created 4 transactions through `POST /transactions` (not direct SQL) with hand-checkable values, confirmed every figure, then deleted them through `DELETE /transactions/:id`. DB confirmed back at baseline afterwards: 0 transactions, all 13 accounts at `0.00`.
  - Whop (USD): 600 + 400 → `totalRevenue: 1000`, `salesCount: 2` — multi-transaction grouping per account.
  - HBL (**LOCAL**, PKR): 27800 → `totalRevenueUsd: 100` (÷278) — proves the widened all-accounts scope and the PKR conversion.
  - Mashreq (HKD): 780 → `totalRevenueUsd: 100` (÷7.8).
  - Totals cross-checked against independently-computed fields: `sum(totalRevenueUsd) == revenueSummary.thisYear.totalUsd == 1200`, `sum(salesCount) == totalSales.count == 4`, `revenueByCurrency` percents summed to 99.99 (rounding).
  - 10 zero-sale accounts still listed at `0`, as intended.
- **The revenue/balance divergence was demonstrated, not just argued.** With `PATCH /bank-accounts` setting Kraken's balance to 5000 while it had zero sales, one response held `totalBalanceUsd: 6100` against a revenue total of `1100`. Also confirmed `PATCH /transactions/:id` (600→500) correctly reverses and re-applies the balance delta, so balance follows edits while revenue reflects the current row.
- `revenueByCurrency` returns **`[]`** on a workspace with no transactions, where the old balance-driven `balancesByCurrency` always returned one row per currency present. Frontend must handle the empty array rather than assuming a row per currency.

## Follow-up: [2026-08-18] Transactions no longer move bank account balances

Product decision: balances stop being derived from transaction activity. `BankAccount.amount` is now **purely accountant-maintained** — the only way it changes is the existing manual `PATCH /bank-accounts/:id` endpoint. Creating, editing, or deleting a `Transaction` no longer has any side effect on the linked account's balance.

- **`transaction.service.ts`**: removed the `prisma.bankAccount.update({ data: { amount: { increment: ... } } })` calls from `create()`, `update()`, and `remove()`. Each now issues exactly one Prisma write (the `Transaction` row itself) instead of a `prisma.$transaction([...])` pair/triple, since there's nothing left to keep atomic with.
- **`bankAccountId` is unchanged and still required.** A transaction still references a bank account — `findBankAccountOrThrow` and `assertCurrencyMatches` still run on create and on any update that touches `bankAccountId`/`saleAmount`/`currency` — it's purely a categorization field now (used by "revenue by bank account" breakdowns), not a balance driver. No schema/migration change.
- **`update()`'s two branches were unified** into one (validate-if-balance-fields-changed, then a single `transaction.update(...)` either way) rather than kept as two paths that now do the same final write — smaller surface, same behavior.
- **`remove()` still looks up the transaction by `{ id, workspaceId }` before deleting**, even though the return value is now unused — `transaction.delete({ where: { id } })` alone can't filter by workspace, so dropping that lookup would let a caller delete another workspace's row by guessing its id.
- No `.spec.ts` existed for this service before this change, so there was no test suite to update.

### Verification
- `tsc`, `eslint`, `nest build` clean.
- Grepped `apps/` for callers of `TransactionService.create/update/remove` beyond `transaction.controller.ts` — none found, so no other code path depended on the removed side effect.
- **Verified against the real dev Postgres DB** via the actual `TransactionService`/`PrismaService` classes (not mocks, not raw SQL) against an isolated throwaway workspace: created a transaction on a 1000 USD account → balance stayed `1000`. Moved the same transaction to a 50000 PKR account with a new amount → old account stayed `1000`, new account stayed `50000` (previously this would have reversed one and applied the other). Deleted it → balance still `50000`. Test fixtures cleaned up afterward, DB back at baseline.
- Confirmed `PATCH /bank-accounts/:id` is untouched and remains the sole path to `amount`.

## Follow-up: [2026-08-18] Date-ranged Reports breakdowns (`/reports/breakdown`)

Closes the gap `docs/accounting-reports-spec.md` §4.1 flagged: every breakdown behind `/overview` (revenue by bank account, by currency, top clients) was all-time only, blocking Monthly/Yearly Reports and Analytics as specified in the UI/UX brief.

- **`getRevenueByBankAccount`/`getRevenueByCurrency`** (`accounting-dashboard.service.ts`) each gained an optional second parameter, `range?: DateRange` (the type already used by `getDailyReport`), spread into their `groupBy`'s `where` only when present. `getOverview()`'s call sites pass no second argument, so `range` is `undefined` there and behavior is unchanged — confirmed live (see below), not just by inspection.
- **`getTopClients` (Overview) was deliberately NOT given a `range` param.** It ranks by `Clients.totalRevenue`, a hand-entered field with no date column — there's nothing to range against, and it's the same field §4.2 already flags as unsynced drift. Instead, a new sibling method, `getTopClientsByRevenue(workspaceId, range?)`, computes the ranking from summed `Transaction.saleAmount` grouped by `[clientId, currency]`, mirroring `getRevenueByBankAccount`'s exact pattern (native total only when single-currency, USD-converted, sorted desc, capped at `TOP_CLIENTS_LIMIT`). `getTopClients`/`/overview`'s `topClients` field are untouched. Whether Overview should eventually switch to the transaction-summed source is a separate, unresolved follow-up — not decided here.
- **New `GET /accounting-dashboard/reports/breakdown?dateFrom=&dateTo=`** (`ReportsBreakdownQueryDto`, strict `YYYY-MM-DD` regex on both, `dateFrom <= dateTo` enforced, and capped at `REPORTS_BREAKDOWN_MAX_RANGE_DAYS` = 400 days so it can't scan a workspace's whole history in one call). One generic endpoint covers daily (`dateFrom == dateTo`), monthly, and yearly Reports screens rather than three near-duplicate routes.
- **UTC day boundaries** via a new `utcDayRange(dateFrom, dateTo)` private helper — matches `getDailyReport`'s and `getMonthlyBreakdownForYear`'s UTC convention, not `getRevenueSummary`'s legacy local-time one.
- **DTO fix while touching this area**: `BankAccountRevenueItemDto` and `CurrencyRevenueItemDto` in `dashboard-overview-response.dto.ts` were bare (non-exported) classes — added `export` to both so the new `ReportsBreakdownResponseDto` could reuse them instead of duplicating. Added one new `TopClientRevenueItemDto` (new shape backing the new endpoint; the existing `TopClientItemDto` is untouched, still backing `/overview`).
- **Asymmetric empty-range behavior, by design, not a bug**: `getRevenueByBankAccount` zero-fills every account (fixed, small set — same as `/overview` today); `getRevenueByCurrency`/`getTopClientsByRevenue` return `[]` when there's no matching activity in range (a "top N clients" list padded with zero-revenue clients isn't meaningful the way a fixed account list is). Frontend must handle both shapes, same class of gotcha as the existing all-time `revenueByCurrency: []` case.

### Verification
- `tsc`, `eslint`, `nest build` clean.
- Verified against the real dev Postgres DB via the actual service classes against an isolated throwaway workspace: a 300 USD sale and a 2780 PKR sale (= 10 USD at the fixed rate) both dated today. `getReportsBreakdown(workspaceId, today, today)` returned `revenueByBankAccount` USD native total `300`, PKR account `totalRevenueUsd: 10`; `revenueByCurrency` USD total `300`; `topClients` summed to `310` USD for the one client. `getOverview()` (no range passed) independently confirmed the same `300` USD total on the same account — proving the optional-range change didn't alter Overview's all-time numbers.

## Follow-up: [2026-08-18] Excel export (`/reports/export`)

Adds a one-click `.xlsx` export of a single date's full accounting picture — replacing the last piece of the manual WhatsApp-report habit the UI/UX brief's §1 calls out.

- **New dependency: `exceljs` ^4.4.0.** No Excel/CSV export existed anywhere in this codebase before this change (confirmed by dependency and code search). Chosen for its multi-worksheet API and per-cell number formatting; ships its own TypeScript types, no `@types/exceljs` needed.
  - **Compatibility note**: exceljs bundles its own non-generic ambient `Buffer` type declaration, which conflicts with `@types/node`'s generic `Buffer<TArrayBuffer>` (this Node types version). `workbook.xlsx.writeBuffer()`'s result must be cast through `ArrayBuffer` and re-wrapped with `Buffer.from(...)` to get a real Node `Buffer` back out — otherwise `tsc` fails with a structural mismatch on `Promise<Buffer>`. Documented in-code in `report-export.service.ts`.
- **New `ReportExportService`** (`report-export.service.ts`) — zero Prisma/DB dependency, takes plain data in, returns a `Buffer`, mirroring the existing `PdfGenerationService`/`PptGenerationService` render-only shape. Builds four sheets:
  - **Transactions** — Ref ID, Date, Client, Bank Account, Currency, Amount, Description.
  - **Sales Summary** — Date, Total Revenue (USD), Sales Count, Average Sale (USD).
  - **Balances by Account** — every account, uncapped (unlike the UI-facing `getBankAccountsByType`, which caps at 4 per type for the Overview panel). Column headers carry a "(current)" label directly rather than a separate note row, since setting `sheet.columns` always writes its own header into row 1 — same caveat `getDailyReport`'s `balances` field already carries: current balances, not as of the exported date. No snapshot/history table exists to make this truthful for a past date (open, unresolved product decision — see §5 of `docs/accounting-reports-spec.md`).
  - **Revenue Breakdown** — two independent tables stacked in one sheet (by currency, by bank account), built row-by-row rather than via `sheet.columns` (which only supports one header row per sheet), reusing the same range-scoped `getRevenueByCurrency`/`getRevenueByBankAccount` calls the breakdown endpoint above uses — no re-querying.
- **New `AccountingDashboardService.getDailyExportData(workspaceId, date)`** gathers all four sheets' data via `Promise.all`, reusing `sumRevenueUsd`, `utcDayRange`, `getRevenueByCurrency`, `getRevenueByBankAccount`. Two new private helpers: `getAllBankAccountBalances` (reuses `BANK_ACCOUNT_SELECT` from the bank-accounts module) and `getTransactionsForRange` (reuses `TRANSACTION_SELECT` from the transactions module) — both new because the existing `getBankAccountsByType`/`getDailyReport.clientPayments` are capped or missing fields (`refId`/`description`) an accounting export needs.
- **`avgSaleUsd` is guarded for `salesCount === 0`** (a zero-transaction day) so a `NaN` never reaches a spreadsheet cell.
- **New `GET /accounting-dashboard/reports/export?date=`** (optional, defaults to today in UTC if omitted — same host-timezone-independence rationale as the earlier `getMonthlyBreakdownForYear` UTC fix). Returns a Nest `StreamableFile` (chosen over raw `@Res()`, which this codebase only otherwise uses for unrelated SSE endpoints) with `Content-Disposition: attachment; filename="accounting-report-<date>.xlsx"`.

### Verification
- `tsc`, `eslint`, `nest build` clean.
- Verified against the real dev Postgres DB via the actual service classes: exported a day with 2 transactions (300 USD + 2780 PKR) — `salesCount: 2`, `revenueUsd: 310`, `avgSaleUsd: 155`, all matching independently. Parsed the resulting `.xlsx` buffer back with exceljs's own reader: confirmed all 4 sheet names present, `Transactions` sheet has header + 2 rows, `Balances by Account` has header + 2 accounts.
- **Zero-transaction-day edge case checked explicitly**: exported a date with no transactions — `salesCount: 0`, `avgSaleUsd: 0` (confirmed not `NaN`), workbook still generated without error.

## Follow-up: [2026-08-18] Export sheets zero-fill currencies and label their report date

Two small fixes to the Excel export from the previous follow-up, based on review:

- **`getDailyExportData`'s `revenueByCurrency` is now zero-filled** for every currency that has a bank account in the workspace, via a new private `fillMissingCurrencies(revenueByCurrency, balancesByAccount)` on `AccountingDashboardService`. Previously a currency with zero sales that day (e.g. PKR, if only USD sales happened) was silently absent from the "Revenue by Currency" table — correct for `/overview`/`/reports/breakdown`, which already document that as intentional, but confusing in a printed spreadsheet where an HBL/PKR account still visibly exists elsewhere on the same file. This is **export-only** — the shared `getRevenueByCurrency` and the `/reports/breakdown` JSON response are untouched.
- **Every export sheet now opens with a bold "Report date: `<date>`" row**, merged across the sheet's column count, via a new `ReportExportService.addTitleRow()` helper. Deliberately the concrete date, not a relative "Today" label, so the file still makes sense once saved, renamed, or opened weeks later. Required switching `addTransactionsSheet`/`addSalesSummarySheet`/`addBalancesSheet` off the `sheet.columns` shorthand (which always writes its own header into row 1, leaving no room for a title above it) to the same manual row-by-row construction `addRevenueBreakdownSheet` already used.

### Verification
- `tsc`, `eslint`, `nest build` clean.
- Verified live against the demo workspace: exported a date where only 1 of 3 accounts had a sale — the previously-missing currency now shows `0 | 0 | 0` in "Revenue by Currency" instead of being absent, and all four sheets open with the correct "Report date: 2026-08-15" title (confirmed by reading the generated `.xlsx` back with exceljs).

## Follow-up: [2026-08-18] Clients and bank accounts now embed every linked transaction

Both `GET /clients` and `GET /bank-accounts` return every linked transaction per row now, not just an aggregate.

- **Clients**: `GET /clients/:clientId` already embedded full `transactions` (via `CLIENTS_SELECT`) — only the **list** endpoint (`CLIENTS_LIST_SELECT`) stripped them down to `{ saleAmount, currency }` for computing `totalSaleAmount`. `CLIENTS_LIST_SELECT` now mirrors `CLIENTS_SELECT` exactly, and `clients.service.ts`'s `toClientListItemData` keeps the mapped transactions instead of discarding them (`const { transactions, ...rest } = row` → gone). A shared `mapTransactions()` helper replaced the duplicated `saleAmount: Number(...)` mapping that both `toClientData` and `toClientListItemData` had.
- **Each embedded transaction now also carries its `bankAccount` (`{ id, bankName, logoUrl }`)** — added to `CLIENT_TRANSACTION_SELECT`. This is the closest available stand-in for "payment method" now that there's no `PaymentPlatform` enum (removed in an earlier follow-up) — which account a payment came in through is the nearest equivalent.
- **Bank accounts had no transaction embedding at all before this** — `BANK_ACCOUNT_SELECT` (used by every bank-account endpoint: create/update/findOne/findAll) gained a `transactions` relation (new `BANK_ACCOUNT_TRANSACTION_SELECT`: `id, refId, saleAmount, currency, saleDate, description, createdAt, updatedAt`, plus `client: { id, clientName }`) and a `_count.transactions`, ordered `saleDate: 'desc'`. No separate list/single split was introduced (bank-accounts never had one) — one select, used everywhere, mirroring where the clients module ended up after this same change.
- **Not changed**: `Transaction`'s existing `orderBy: { createdAt: 'desc' }` on the clients side was left as-is — an earlier draft of this change accidentally switched it to `saleDate: 'desc'`, caught and reverted before shipping since that wasn't asked for.
- **Known tradeoff, not addressed here**: transactions are embedded in full, unpaginated, on every list row — for a client or account with a very large transaction history, a list response could get large. Matches the existing precedent of `GET /clients/:clientId` (already unpaginated) and was requested explicitly ("send all the transactions"); flagged here in case it becomes a real problem once workspaces have more data.

### Verification
- `tsc`, `eslint`, `nest build` clean.
- Verified live against the demo workspace over real HTTP: `GET /clients?limit=1` returned a client with 5 embedded transactions (each with its `bankAccount`), matching `_count.transactions`. `GET /bank-accounts?limit=1` returned an account with 4 embedded transactions (each with its `client`), matching `_count.transactions`.
- Confirmed `GET /clients/:id` and `GET /bank-accounts/:id` (single-item) still return the same shape as before, transaction counts matching the list view.
- Confirmed `POST /bank-accounts` (a brand-new account with no transactions yet) returns `transactions: []` and `_count.transactions: 0` without error, then cleaned up via `DELETE /bank-accounts/:id`.

## Follow-up: [2026-08-18] Overview's `revenueByBankAccount` now respects `period` (today/weekly/monthly/yearly)

`GET /accounting-dashboard/overview?period=` previously used `period` for exactly one thing: the bucket granularity of `revenueOverview.points`. Every other section — including `revenueByBankAccount` — was silently all-time regardless of `period` (documented as a known "trap" in `docs/accounting-reports-spec.md`). `revenueByBankAccount` now scopes to a current window based on `period`:

| `period` | Window |
|---|---|
| `daily` | Today (UTC calendar day) |
| `weekly` | Trailing 7 days including today (rolling, **not** a calendar week — matches `getBucketConfig`'s own existing definition of "weekly" elsewhere in this file) |
| `monthly` | Month-to-date (1st of the current month through today) |
| `yearly` | Year-to-date (Jan 1 through today) |

- New private `getCurrentPeriodRange(period, now)` on `AccountingDashboardService`, distinct from `getBucketConfig` (which computes an N-*bucket* trailing window for the chart, not a single current-period filter). All boundaries UTC, matching this file's newer methods.
- `getOverview()` now calls `this.getRevenueByBankAccount(workspaceId, this.getCurrentPeriodRange(period, new Date()))` instead of the no-range (all-time) call.
- **Scoped to `revenueByBankAccount` only, on purpose.** `revenueByCurrency` and `topClients` were not touched and remain all-time on `/overview` regardless of `period` — not asked for, and changing them would be a second, separate breaking change bundled into this one.
- Doc corrections made while here: the stale comment above `getRevenueByBankAccount` (referenced "all-time" and outdated migration context), the `period` `@ApiQuery` description and the `overview` endpoint's `@ApiOperation` description (previously described fields — "balances by currency", "international account balances ranked descending" — that don't match the current response shape), the `revenueByBankAccount` field description in `dashboard-overview-response.dto.ts`, and the "Trap" callout in `docs/accounting-reports-spec.md` (updated rather than deleted, since half of it — `revenueByCurrency`/`topClients` staying all-time — is still true).

### Verification
- `tsc`, `eslint`, `nest build` clean.
- Verified live against the demo workspace (15 seeded transactions across today, this week, this month, and last month) for all four `period` values — every number hand-computed from the known seed data and cross-checked against the response:
  - `daily`: Whop 1,200 USD/1 sale, Slash 850 USD/1, HBL 42,000 PKR (151.08 USD)/1 — today's 3 transactions only.
  - `weekly`: Whop 3,600/2, Slash 2,450/2, HBL 42,000 (151.08)/1 — adds the two sales from 3 and 5 days ago.
  - `monthly`: Whop 6,250/4, Slash 5,550/3, HBL 120,000 (431.65)/2 — matches the independently-computed `/reports/breakdown?dateFrom=<month-start>&dateTo=<today>` result exactly.
  - `yearly`: Whop 9,750/6, Slash 9,500/5, HBL 237,000 (852.52)/4 — matches the pre-change all-time total exactly, since every seeded transaction falls within the current year.
  - `revenueByCurrency` confirmed byte-for-byte identical between `period=daily` and `period=yearly` — proving it stayed all-time as intended, not accidentally scoped along with `revenueByBankAccount`.

## Follow-up: [2026-08-18] Excel export now accepts a date range, not just a single date

`GET /accounting-dashboard/reports/export` previously took only `date` (single day, optional, defaulting to today). It now also accepts `dateFrom`/`dateTo` for a range — `date` still works exactly as before for anyone already calling it.

- **`ExportReportQuerySchema`** (`export-report-query.dto.ts`) gained `dateFrom`/`dateTo`, both optional, with four `.refine()`s: `date` and `dateFrom`/`dateTo` are mutually exclusive; `dateFrom`/`dateTo` must be provided together, not just one side; `dateFrom <= dateTo`; and the span is capped, reusing the same limit `/reports/breakdown` uses.
- **Renamed `REPORTS_BREAKDOWN_MAX_RANGE_DAYS` → `ACCOUNTING_REPORTS_MAX_RANGE_DAYS`** (`accounting-dashboard.constants.ts`) since it's no longer breakdown-specific, and extracted `DATE_FORMAT_REGEX` / `daysBetweenDates()` there too — both the breakdown DTO and the new export DTO needed the identical YYYY-MM-DD format check and day-count math, and duplicating that (rather than importing it once) is exactly the kind of thing that quietly drifts between the two later.
- **`AccountingDashboardService.getDailyExportData(workspaceId, date)` → `getExportData(workspaceId, dateFrom, dateTo)`.** For the old single-date call, `dateFrom === dateTo` and behavior is identical. `DailyExportData` → `AccountingExportData`: `date`/`salesSummary` replaced by `dailyBreakdown: ExportDailyBreakdownRow[]` (one row per calendar day in range, zero-filled, computed via a new `buildDailyBreakdown()`) plus `totals: ExportTotals` for the whole span.
  - **`buildDailyBreakdown` is computed in memory from the already-fetched `transactions` array — no per-day queries.** A 400-day range would otherwise mean 400 sequential round-trips; instead the single existing `getTransactionsForRange` result is grouped by day in JS.
  - `totals` still comes from the original `sumRevenueUsd`/`transaction.count` calls over the whole range, not by summing the (already-rounded) per-day rows — avoids compounding rounding drift between the daily rows and the total.
- **`ReportExportService.buildDailyReportWorkbook` → `buildReportWorkbook`.** The "Sales Summary" sheet now renders one row per day, plus a bold "Total" row — but only when the range spans more than one day, since for a single date the Total row would just repeat the one data row above it. Every sheet's title row now reads "Report period: `<dateFrom>` to `<dateTo>`" for a range, or unchanged "Report date: `<date>`" for a single day (`dateFrom === dateTo`).
- **Controller route unchanged**, `GET /accounting-dashboard/reports/export`; handler renamed `exportDailyReport` → `exportReport`. Filename becomes `accounting-report-<dateFrom>_to_<dateTo>.xlsx` for a range, unchanged `accounting-report-<date>.xlsx` for a single day.

### Verification
- `tsc`, `eslint`, `nest build` clean.
- Verified live against the demo workspace: `?date=2026-08-18` (unchanged path) still produces an identical single-row Sales Summary sheet titled "Report date: 2026-08-18".
- `?dateFrom=2026-08-01&dateTo=2026-08-18` produces an 18-row Sales Summary (one per day, zero-filled on quiet days) plus a Total row reading **12,231.65 / 9 sales / 1,359.07 avg** — cross-checked against the independently-computed `/overview?period=monthly` result from the previous follow-up (6,250 + 5,550 + 431.65 = 12,231.65, 4 + 3 + 2 = 9 sales) — exact match. All four sheets titled "Report period: 2026-08-01 to 2026-08-18".
- Validation confirmed live, all returning `422`: `date` + `dateFrom` together; `dateFrom` without `dateTo`; `dateFrom` after `dateTo`; a >400-day span.

## Follow-up: [2026-08-18] Bug fix — `/overview?period=monthly` chart produced duplicate, missing and misaligned month buckets

**Reported symptom:** the monthly filter on the Overview API "not working properly." Reproduced immediately on the dev host (UTC+5) — `revenueOverview.points` came back as:

```
2025-09, 2025-10, 2025-10, 2025-12, 2025-12, 2026-01, 2026-03, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07
```

Three labels duplicated (`2025-10`, `2025-12`, `2026-03`), three months missing (`2025-11`, `2026-02`, and **the current month `2026-08` entirely**), and the two non-zero values wrong: `2026-06: 7669.42` / `2026-07: 12433.09` against true monthly totals of `2026-07: 7870.86` / `2026-08: 12231.65`.

### Root cause — two compounding bugs in `getBucketConfig`

1. **Local-time boundary construction.** `new Date(now.getFullYear(), now.getMonth(), 1)` builds *local* midnight. On UTC+5 that serialises to `2026-07-31T19:00:00Z` — the **previous month's last day**, not a month start. This is the identical bug the changelog records as "deliberately fixed" in `getMonthlyBreakdownForYear` via `Date.UTC`; `getBucketConfig` was simply never given the same treatment.
2. **Postgres month-arithmetic clamping, amplified by (1).** `generate_series(..., '1 month')` anchored on a day-31 timestamp clamps to the shorter month's last day and then keeps clamping from the clamped value. Confirmed by querying Postgres directly with the buggy anchor: the steps walked `08-31 → 09-30 → 10-30 → 11-30 → 12-30 → 01-30 → 02-28 → 03-28 → 04-28 → 05-28 → 06-28 → 07-28`. Buckets therefore stopped lining up with months at all — each window straddled two real months (which is why the sums were wrong, not just the labels), and once combined with local-time label formatting, two adjacent drifted starts could format to the same month string while another month never appeared.

Both were verified as the cause arithmetically, not inferred: the observed `2026-06: 7669.42` is exactly the sum of the five transactions falling in `[2026-06-28T19:00Z, 2026-07-28T19:00Z)`, and `2026-07: 12433.09` exactly the eight in `[2026-07-28T19:00Z, 2026-08-28T19:00Z)`.

### Fix

- **`getBucketConfig` now builds every boundary with `Date.UTC`** (and `setUTCDate` for the day/week steppers) instead of local-time constructors — for all four periods, not just `monthly`. Anchoring on **day 1** is what defeats bug (2): day 1 exists in every month, so Postgres never clamps. Verified directly against Postgres — a day-1 UTC anchor steps cleanly `2025-09-01 … 2026-08-01`.
- **`formatMonth` and `formatBucketLabel` now read the bucket start with UTC getters** (`getUTCFullYear`/`getUTCMonth`) to match how the boundaries are constructed. `formatDay` already used `toISOString()` and needed no change.
  - This also fixes a **latent bug in `getMonthlyBreakdownForYear`**, which shares `formatMonth`. Its boundaries were already correctly UTC, but the local-time formatter happened to produce right answers only on a *positive*-offset host; on a negative-offset host (e.g. UTC−5) `2026-01-01T00:00Z` would have formatted as `2025-12`, shifting every label back a month. Not the reported bug, but the same defect one layer over.
- `getCurrentPeriodRange` (added in the `period`-scoping follow-up above) was already UTC and needed no change.

### Verification
- `tsc`, `eslint`, `nest build` clean.
- **`period=monthly` after the fix**: `2025-09 … 2026-08` — 12 sequential labels, no duplicates, no gaps, current month present as the final bucket. `2026-07: 7870.86`, `2026-08: 12231.65`.
- **Cross-validated two independent ways.** `2026-08: 12231.65` matches `revenueSummary.thisMonth.totalUsd` (computed by a completely separate code path) exactly. And `/monthly-breakdown?year=2026` — a different method, different SQL bounds — independently returns `2026-07: 7870.86` / `2026-08: 12231.65`, agreeing with the chart to the cent where previously the two disagreed.
- **No regression on the other three periods**, each checked for duplicate labels (none) and correct values: `daily` 7 buckets (`2026-08-13: 1600`, `2026-08-15: 2400`, `2026-08-18: 2201.08` — all matching seeded data); `weekly` 8 buckets at clean 7-day steps; `yearly` 5 buckets, `2026: 20102.52` = the sum of both non-zero months (12,231.65 + 7,870.86). `/monthly-breakdown` re-checked for the shared-`formatMonth` change: `2026-01 … 2026-12`, no duplicates.
- **Calendar edge cases checked** (not just the current date): a 12-bucket monthly window computed in January correctly rolls back into the prior year (`2025-02 … 2026-01`), since `Date.UTC` normalises a negative month index; February and December windows likewise correct.


## Follow-up: [2026-08-18] `revenueByCurrency` on Overview now also respects `period`

Extends the `period`-scoping follow-up above: `revenueByBankAccount` was made period-scoped there, but `revenueByCurrency` was deliberately left all-time at the time ("not asked for"). Now asked for — `revenueByCurrency` scopes to the same current window as `revenueByBankAccount`.

- **`getOverview()`** now computes `getCurrentPeriodRange(period, new Date())` once and passes it to *both* `getRevenueByBankAccount` and `getRevenueByCurrency`, instead of computing it inline only for the bank-account call and calling `getRevenueByCurrency(workspaceId)` with no range. One shared range, two scoped calls.
- **`topClients` is still untouched** — still all-time, still ranked by `Clients.totalRevenue`. Not asked for this round either; scoping it would need the same `getTopClientsByRevenue` treatment `/reports/breakdown` already has, not a trivial range param (see the reasoning in the `/reports/breakdown` follow-up above — `Clients.totalRevenue` has no date column to range against).
- **Asymmetric zero-fill carries over unchanged and was re-verified**: `revenueByBankAccount` zero-fills every account in the workspace; `revenueByCurrency` only lists currencies with actual activity in the window (absent, not zeroed, when quiet) — this was already true for the all-time case and remains true now that both are period-scoped, confirmed live with a throwaway EUR account that had zero transactions.
- Doc corrections made while here: the stale comment above `getRevenueByCurrency` (said "All-time revenue," matching the pattern already fixed on `getRevenueByBankAccount`'s comment), the `revenueByCurrency` field description in `dashboard-overview-response.dto.ts`, the `overview` endpoint's `@ApiOperation` and `period` `@ApiQuery` descriptions in the controller, and the "Trap" callout in `docs/accounting-reports-spec.md` (now only `topClients` is exempt from `period`, not both `revenueByCurrency` and `topClients`).

### Verification
- `tsc`, `eslint`, `nest build` clean.
- **Full Overview response tested end-to-end for all four `period` values** against the demo workspace (not just the one field) — every section checked, not just the one that changed:
  - `revenueByCurrency` scoped correctly and cross-validated against independent totals: `daily` USD 2,050 + PKR 151.08 = 2,201.08 = `revenueSummary.today.totalUsd`; `monthly` USD 11,800 + PKR 431.65 = 12,231.65 = `revenueSummary.thisMonth.totalUsd`; `yearly` USD 19,250 + PKR 852.52 = 20,102.52 = `revenueSummary.thisYear.totalUsd`. Three independent code paths agreeing exactly, for three different periods.
  - `revenueByBankAccount` unchanged from the prior follow-up's verified values for all four periods (re-confirmed, no regression).
  - **Confirmed correctly unaffected by this change**: `topClients` identical across all four periods; `balances.totalBalanceUsd` identical across all four (current-balance data, has no relationship to `period` at all); `bankAccounts.local`/`bankAccounts.international` counts identical across all four.
  - `revenueOverview.points.length` still varies correctly by period (7/8/12/5) and the monthly chart still shows 12 sequential labels with no duplicates — re-confirmed no regression from the earlier bucket-drift fix.
- **Zero-fill asymmetry re-verified live**: created a throwaway `EUR`/`LOCAL` bank account with no transactions. `revenueByBankAccount` listed it at `0` (zero-filled, as designed). `revenueByCurrency` correctly did **not** list `EUR` at all (no activity → absent, not zeroed) — same intentional asymmetry as before, now proven to hold under period-scoping too. Test account deleted after.

## Follow-up: [2026-08-18] Reports list filters (`GET /transactions`) and matching filtered Excel export

New Reports UI: a paginated transaction list with filters (Date Range, Client, Payment Platform, Currency, Account) and an Export Report button that exports whatever the filters currently show — defaulting to today when no date is chosen.

**Assumptions made explicit before writing any code** (not asked to confirm, but stated so a wrong guess is easy to catch and correct):
- "Payment Platform" in the UI maps to the existing `accountType` enum (`LOCAL`/`INTERNATIONAL`) — there is no `PaymentPlatform` field anymore (removed in an earlier follow-up), and this matches both the screenshot's "Pakistan Balance"/"International Balance" cards and an existing code comment that already calls international accounts "what used to be a platform." "Account" maps to a specific `bankAccountId`.
- The list itself is `GET /transactions`, extended with the two filters it was missing — not a new endpoint. Matches the standing design decision that Reports reuses `/transactions` for per-transaction detail rather than duplicating it (see `docs/accounting-reports-spec.md`).
- "Export only that data" means every sheet reflects the active filters — Transactions, Sales Summary, and Revenue Breakdown fully; Balances by Account is filtered by `bankAccountId`/`accountType`/`currency` (real properties of an account) but not by `clientId` (an account isn't tied to one client).

**`GET /transactions`** (`list-transactions-query.dto.ts`, `transaction.service.ts`, `transaction.controller.ts`): added `bankAccountId` (plain equality) and `accountType` (comma-separated, matching the existing `currency` filter's pattern) query params. `accountType` lives on the related `BankAccount`, not `Transaction`, so it's a relational filter (`where.bankAccount = { accountType: { in: [...] } }`), not a plain column match.

**`GET /accounting-dashboard/reports/export`** (`export-report-query.dto.ts`, `accounting-dashboard.service.ts`, `accounting-dashboard.controller.ts`, `report-export.service.ts`) gained the same four filters — `clientId`, `bankAccountId`, `accountType`, `currency` — layered on top of whichever date resolution already applied (`date`, `dateFrom`/`dateTo`, or the today default when neither is given):

- New `ExportFilters` type and two private where-builders on `AccountingDashboardService`: `transactionFilterWhere()` (clientId/bankAccountId/currency direct, accountType via the `bankAccount` relation) and `bankAccountFilterWhere()` (bankAccountId as the account's own id, accountType, currencyType — no clientId, matching the assumption above). Threaded through every query `getExportData` uses: `sumRevenueUsd`, the transaction count, `getAllBankAccountBalances`, `getRevenueByCurrency`, `getRevenueByBankAccount`, `getTransactionsForRange` — each gained an optional `filters` parameter, defaulting to `undefined` for every other caller (`/overview`, `/reports/breakdown`), so those are provably unaffected.
- **New `activeFilters` field on `AccountingExportData`**, resolved by a new `describeActiveFilters()`: `accountType`/`currency` are already human-readable enum values, but `clientId`/`bankAccountId` are just UUIDs, so those two get a small dedicated name lookup rather than relying on a match turning up in the (possibly empty) filtered results. `ReportExportService`'s title row now appends `" — Filtered by: Client: Victoria Partners, Currency: PKR"` (etc.) whenever any filter is active, so an exported file is self-describing about what it excludes, not just what period it covers.
- No contradiction-handling needed beyond what already existed — a filter combination matching zero transactions produces a valid, empty-but-correctly-shaped workbook (header rows only, `0`/`0`/`0` totals), not an error.

### Verification
- `tsc`, `eslint`, `nest build` clean.
- **`GET /transactions` filters, live against the demo workspace**: `accountType=LOCAL` → 4 transactions, all HBL; `accountType=INTERNATIONAL` → 11, all Whop/Slash. `bankAccountId=<Whop's id>` → 6, all Whop. Combined `clientId` + `currency` + pagination (`page=2&limit=2`) → correct `meta` object and only that client's rows. Invalid `accountType` value → `422`.
- **Export filters, live, each downloaded and parsed back**:
  - No filters → today's 3 transactions, plain "Report date: 2026-08-18" title, no filter suffix.
  - `clientId` only → 1 transaction (that client's), title resolves the UUID to "Client: Victoria Partners" (not a raw id); Balances by Account correctly still shows **all 3** accounts (not client-scoped, per the stated assumption); Revenue Breakdown correctly scopes the *values* to that client while still zero-filling every workspace account/currency.
  - `accountType=INTERNATIONAL` + a month range → 7 of the month's 8 transactions (the 1 HBL/LOCAL one correctly excluded); Balances by Account correctly narrowed to **2** accounts (Whop, Slash — no HBL); title reads "Report period: 2026-08-01 to 2026-08-18 — Filtered by: Payment Platform: INTERNATIONAL".
  - `currency=PKR` → exactly the 1 matching transaction, title "Filtered by: Currency: PKR".
  - **Contradictory filters** (`clientId` for a client with zero PKR sales + `currency=PKR`) → `200`, not an error: empty Transactions sheet (header only), Sales Summary shows one `0`/`0`/`0` row, title correctly lists both active filters.
- **Regression check**: `/overview?period=monthly` and `/reports/breakdown` re-verified byte-for-byte identical to their pre-change values (`Whop 6,250`, `Slash 5,550`, `HBL 431.65`, `revenueByCurrency` unchanged) — confirming the new optional `filters` parameter threaded through five shared methods didn't alter behavior for callers that don't pass it.



## Follow-up: [2026-08-19] Excel export simplified to a single flat table (matching the Reports list)

Replaced the export's 4-sheet workbook (Transactions, Sales Summary, Balances by Account, Revenue Breakdown) with **one sheet, one row per matching transaction** — `Date | Revenue | Currency | Client | Bank` — mirroring the Reports table UI exactly, with or without filters applied. Requested directly off a screenshot of the Reports table: the export should just be that table, not a separate report document.

**`accounting-dashboard.service.ts`**: `AccountingExportData` collapsed to `{ dateFrom, dateTo, transactions }`. `TransactionExportRow` gained `saleAmountUsd` (computed once here via `toUsd()`, so the renderer stays a pure formatter with no currency-conversion logic of its own). `getExportData()` now only calls `getTransactionsForRange()` — dropped the parallel `sumRevenueUsd`/count/`getAllBankAccountBalances`/`getRevenueByCurrency`/`getRevenueByBankAccount`/`describeActiveFilters` calls entirely, since none of their output has a sheet to land on anymore.

**Removed as dead code, not just unused**: `getAllBankAccountBalances()`, `describeActiveFilters()`, `buildDailyBreakdown()`, `fillMissingCurrencies()`, and the `BankAccountBalanceItem`/`ExportDailyBreakdownRow`/`ExportTotals`/`ExportActiveFilter` types — all existed only to feed the three sheets that no longer exist. Also dropped the now-always-`undefined` `filters` parameter from `getRevenueByBankAccount()`, `getRevenueByCurrency()`, and `sumRevenueUsd()` (nothing calls them with real filters anymore — only the removed export sheets did), and deleted `bankAccountFilterWhere()` (its only caller was the just-removed `getAllBankAccountBalances()`). `/overview` and `/reports/breakdown`, the two other callers of those three methods, never passed filters in the first place, so this is provably behavior-neutral for them.

**`report-export.service.ts`**: rewritten from 4 sheet-builder methods plus a shared filter-aware title row down to one `addTransactionsSheet()` — no title row, no "Report date"/"Filtered by" banner, just a header row and the data, since the sheet **is** the filtered table now rather than a report labeled with its filters.

**`accounting-dashboard.controller.ts`**: updated the `/reports/export` Swagger description to describe the new one-sheet shape instead of "Four sheets: ...".

### Verification
- `tsc --noEmit`, `eslint` on all three touched files — clean.
- Live against the demo workspace (server on port 3020, demo accountant login): `GET /reports/export?dateFrom=2026-07-01&dateTo=2026-08-19` (no filters) and the same range with `currency=USD` added, both downloaded and parsed back with `exceljs`:
  - Single worksheet named "Report" in both files.
  - Header row exactly `Date, Revenue, Currency, Client, Bank`.
  - No-filter file: 15 data rows including a PKR/Phase Shop/HBL row.
  - `currency=USD` file: 11 data rows, PKR row correctly absent — confirms filters still apply to the export with the simplified shape.

## Follow-up: [2026-08-19] Multi-value currency/accountType filters, and filtered balance totals on `/reports/breakdown`

Two gaps found while re-testing the simplified export: (1) `currency`/`accountType` on `/reports/export` only accepted one value each, unlike `GET /transactions`, which already supports a comma-separated list (`currency=USD,PKR`) — asked directly and confirmed it should match; (2) the Reports page's "Pakistan Balance"/"International Balance" cards weren't filterable at all — asked for directly, off the Reports UI screenshot showing those cards sitting right above the same filter bar as the table.

**`ReportFilters` (renamed from `ExportFilters`, now shared by `/reports/export` and `/reports/breakdown`)**: `currency`/`accountType` changed from single values to arrays — matching `GET /transactions`'s existing `enumCsvOrArray` pattern exactly (`export-report-query.dto.ts`, new `reports-breakdown-query.dto.ts` filters). `clientId`/`bankAccountId` stay single-valued, also matching `/transactions`. `transactionFilterWhere()` now uses `{ in: [...] }` for both instead of equality.

**`/accounting-dashboard/reports/breakdown`** gained the same four filters, plus a new `balances` field on the response (`BalanceSummaryDto`, reused from `/overview`'s DTO). `getBalances()` (previously workspace-wide only) gained an optional `filters` param and a revived `bankAccountFilterWhere()` (bankAccountId/accountType/currency — no clientId, since a `BankAccount` isn't tied to one client). `getRevenueByBankAccount()`, `getRevenueByCurrency()`, and `getTopClientsByRevenue()` all gained the `filters` param back (removed in yesterday's export-simplification cleanup as dead code — now live again for this endpoint). `/overview`'s calls to these three methods still pass no filters, so its all-time/period-scoped numbers are unaffected.

**Assumption made explicit before coding**: balances are current-only (no historical snapshot exists — same caveat `getDailyReport`/the export already carry), so `dateFrom`/`dateTo` never scope them, and `clientId` has no effect on them either, since an account isn't scoped to a client. Only `bankAccountId`/`accountType`/`currency` narrow which accounts get summed into the balance cards. Revenue/top-clients numbers on the same response *do* honor all four filters, including `clientId` and the date range.

### Verification
- `tsc --noEmit`, `eslint` — clean.
- Live, demo workspace: `GET /reports/export?...&currency=USD,PKR` → `200`, single "Report" sheet, both currencies present (previously this 422'd on a comma list before today's change).
- `GET /reports/breakdown?dateFrom=2026-07-01&dateTo=2026-08-19` (no filters) → `balances` shows LOCAL/PKR 1,250,000 (1 account) and INTERNATIONAL/USD 25,600 (2 accounts).
- Same call + `accountType=LOCAL` → `balances` narrows to just the LOCAL/PKR entry; adding `clientId` on top of that left `balances` byte-for-byte identical (confirming clientId is correctly ignored there) while `topClients` dropped to 0 results (correctly filtered on the transaction side, since that client's sales are all on an INTERNATIONAL account).

## Follow-up: [2026-08-19] Live exchange rates on `/overview`'s balance cards (Pakistan / International / Total)

Requested off a screenshot of three balance cards — Pakistan Balance (native PKR), International Balance (all non-PKR currencies summed into one USD figure), Total Balance (everything summed into USD, with the PKR rate used shown as a caption) — asking to fetch real rates from `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json` (free, no key, USD-base — so `usd.<code>` is already "units of `<code>` per 1 USD", the same convention `EXCHANGE_RATES_TO_USD` already used) rather than the hardcoded placeholder map.

**Found already on disk before this change**: an in-progress edit to `toUsd()` had made it `async` and fetching that same URL **on every single conversion call** — with no cache, no error handling, and still being called synchronously everywhere else in the file (`bucket.totalUsd += toUsd(...)` — adding a `Promise` to a number). That version would have made one outbound HTTP request per currency conversion (dozens per request) and broken every consumer's math. Replaced rather than built on top of.

**`accounting-dashboard.constants.ts`**: added `CURRENCY_API_URL` and `EXCHANGE_RATE_CACHE_TTL_MS` (1 hour — the upstream data only updates daily; this just bounds outbound request volume). `EXCHANGE_RATES_TO_USD`'s comment updated to describe its new role as the fallback, not the only source.

**`accounting-dashboard.service.ts`**: `toUsd()` changed from a free function reading the static constant into a private instance method reading `this.exchangeRates` (initialized to the static map). New `private async refreshExchangeRates()`: fetches the API, merges any valid rate over the current map (skips `CRYPTO`, which the API doesn't carry — it always keeps the static 1:1 placeholder), and caches for `EXCHANGE_RATE_CACHE_TTL_MS`. Never throws — any failure (network, non-200, malformed body) logs a warning via `Logger` and leaves whatever rates were already cached (live-but-stale, or the static fallback) untouched, so a flaky third-party API can never break the dashboard. Only `getOverview()` awaits a refresh before running — matching the ask, which was scoped to that screen; every other caller (`/reports/breakdown`, the export, `/daily-report`, etc.) uses whatever's currently cached, which in practice means they benefit too once Overview has been hit at least once.

**New `totalUsd` field on each `BalanceByAccountType` bucket** (`getBalances()`, `BalanceByAccountTypeDto`): sums every currency within that account type into one USD figure — this is what backs the "International Balance" card directly (INTERNATIONAL accounts can span USD/AED/GBP/etc., and the UI wants one number, not the existing per-currency `totals` array). "Pakistan Balance" needed no backend change — LOCAL's `totals` was already the raw native PKR figure. "Total Balance" also needed no new field — `totalBalanceUsd` already existed; `exchangeRatesToUsd.PKR` supplies the "converted at X/USD" caption value, now live instead of the fixed `278`.

### Verification
- `tsc --noEmit`, `eslint` — clean.
- Live: `GET /overview` against the demo workspace (now holding LOCAL/PKR, and INTERNATIONAL/USD + the AED (Emirates NBD) and GBP (Barclays) accounts added in the previous filter-testing round) returned `exchangeRatesToUsd` with real fractional live values (`PKR: 277.73437676`, `AED: 3.6725`, `GBP: 0.73828849` — not the static `278`/`3.67`/`0.79` placeholders), confirming the live fetch actually ran. `CRYPTO` stayed at the static `1` as designed (no live source for it).
- Balance math cross-checked by hand: LOCAL `totalUsd` (`4500.70`) + INTERNATIONAL `totalUsd` (`50050.58`) = `totalBalanceUsd` (`54551.28`) exactly; INTERNATIONAL's `totalUsd` matches USD 25,600 + AED 50,000/3.6725 + GBP 8,000/0.73828849 summed.
- Cross-checked the "Pakistan Balance" figure against the database directly (via Prisma, not raw SQL — a plain sum has none of the timezone-casting risk a date filter would): `bankAccount.groupBy` on `{ accountType: 'LOCAL' }` in the demo workspace returned `PKR 1,250,000` (1 account, HBL) — byte-for-byte the same number `/overview` returned, confirming the card reflects the real stored balance, not a stale or miscomputed value.
- Confirmed revenue figures (`revenueSummary`, `revenueByBankAccount`, `revenueByCurrency`) already convert via these same live rates — no separate change was needed, since every revenue path already funnels through the shared `toUsd()`. Verified by recomputing each `totalUsd` from its native amount and the `exchangeRatesToUsd` returned in the same response: every figure matched exactly. Also added a live HKD bank account + transaction as a fresh test case — `revenueByCurrency`, `revenueByBankAccount`, and `revenueSummary.today` all picked it up correctly, converted at the live HKD rate, with no code changes required.


## Follow-up: [2026-08-19] Transaction currency decoupled from bank account currency, and a reporting filter bug that would have followed

Requested directly: a transaction's `currency` should no longer have to match its bank account's own `currencyType` — e.g. Whop (declared `USD`) should be able to take HKD, AED, or any other currency's sales interchangeably, not just USD.

**`transaction.service.ts`**: removed `assertCurrencyMatches()` entirely (and its error, `TRANSACTION_CURRENCY_MISMATCH`, now deleted from `transaction.constants.ts` as dead code). `create()` still calls `findBankAccountOrThrow()` — that check stays, since a transaction must still reference a real bank account in the workspace — but no longer checks currency against it. `update()` simplified along the way: the old `balanceFieldsChanged` block re-validated and rewrote `bankAccountId`/`saleAmount`/`currency` together as a trio (because changing any one of them used to require re-checking the currency match); now each of the three is independent, so each is only touched when actually present in the payload — smaller and more direct than before, not just behavior-preserving. `findBankAccountOrThrow()`'s `currencyType` return field, no longer used anywhere, was dropped too. Updated the three Swagger descriptions (`create`/`update` DTOs and the create endpoint) that documented the old constraint.

**Reporting-section bug this would have caused, fixed as part of the same change**: `accounting-dashboard.service.ts`'s `getRevenueByBankAccount()` filters *which accounts appear* in the breakdown using `bankAccountFilterWhere()`, which included a `currencyType: { in: filters.currency } }` clause — filtering the account list by the account's own declared currency. Once a transaction's currency can differ from its account's, this became a real bug, not just a latent one: filtering `/reports/breakdown?currency=AED` would have silently **dropped Whop** (declared `USD`) from the results entirely, even after it earned real AED revenue, because Whop itself never matched `currencyType: 'AED'`. Split the method into `bankAccountIdentityFilterWhere()` (`bankAccountId`/`accountType` only — real, fixed account properties, safe to filter the account list by) and `bankAccountFilterWhere()` (adds `currencyType`, used **only** by `getBalances()`, where "currency" correctly means the account's own held-currency balance — a distinct, still-single-currency-per-account concept, untouched by this change). `getRevenueByBankAccount()`'s account list now uses the identity-only filter, so a `currency` filter narrows which *transactions* count (already correct, via `transactionFilterWhere()`), not which accounts are eligible to appear.

Also updated the `nativeTotal` comment and the `BankAccountRevenueItemDto.totalRevenue`/`currencyType` Swagger descriptions — null-when-ambiguous was previously framed as a defensive edge case (guarded by the now-removed constraint); it's a real, expected outcome now (multiple currencies on one account, or a single currency that isn't the account's own). The underlying `.get(account.currencyType) ?? null` lookup already handled both cases correctly — no logic change needed there, just outdated comments.

### Verification
- `tsc --noEmit`, `eslint` — clean.
- Live: `POST /transactions` with `bankAccountId` = Whop (`currencyType: USD`) and `currency: AED` → `201`. Same for HBL (`currencyType: PKR`) with `currency: USD` → `201`. Both previously would have been `400 TRANSACTION_CURRENCY_MISMATCH`.
- `GET /reports/breakdown?currency=AED` afterward: `revenueByBankAccount` correctly includes **Whop** (`totalRevenue: null`, `totalRevenueUsd: 245.23`, `salesCount: 1` — its real AED sale), alongside Emirates NBD (the actual AED-denominated account) and every other account zero-filled. `balances.byAccountType` stayed correctly scoped to true AED-denominated accounts only (Emirates NBD) — confirming the identity/currency filter split works as intended for both endpoints simultaneously.

## Follow-up: [2026-08-19] Fixed: export's Revenue column was silently converting to USD

Asked to confirm the export never converts amounts — it should show each transaction's own native amount, in its own currency, whether one currency or several are filtered in. Checking found the opposite was true: `report-export.service.ts`'s Revenue column used `transaction.saleAmountUsd`, a USD-converted figure computed in `getTransactionsForRange()` — a live HKD test transaction of `6000 HKD` was exporting as `769.23` (USD), not `6000`.

**Fixed**: `getTransactionsForRange()` no longer computes `saleAmountUsd` at all — dropped from `TransactionExportRow` entirely as dead code once the export stopped needing it. `addTransactionsSheet()` now writes `transaction.saleAmount` (native) into the Revenue column; Currency (column 3) names the unit it's actually in.

### Verification
- `tsc --noEmit`, `eslint` — clean.
- Live: `?currency=HKD` export now shows `Revenue: 6000, Currency: HKD` (previously `769.23`).
- Live: `?currency=HKD,AED,GBP,USD,PKR` export — every row shows its own native amount in its own currency (PKR rows at `61000`/`56000`/`78000`/`42000`, not divided by 278; AED at `3500`/`4200`/`900`; GBP at `900`/`1250`; HKD at `6000`) — no conversion anywhere, confirmed across a mix of currencies in one file, not just a single-currency filter.

## Follow-up: [2026-08-19] Reinstated one currency rule: LOCAL accounts only accept PKR

The full currency/bank-account decoupling earlier today went one step too far — a LOCAL (Pakistan) bank account should still only ever take PKR transactions; only INTERNATIONAL accounts (Whop, Slash, ...) are meant to be currency-agnostic.

**`transaction.service.ts`**: new `assertLocalAccountCurrency(accountType, currency)` — throws `TRANSACTION_LOCAL_ACCOUNT_CURRENCY` (new constant in `transaction.constants.ts`) when `accountType === 'LOCAL' && currency !== 'PKR'`. `findBankAccountOrThrow()` now also selects/returns `accountType` (needed for this check).

- `create()`: validated once, right after the existence check.
- `update()`: `bankAccountId` and `currency` are independent fields (from the earlier decoupling change), so whichever one is actually changing gets checked against the other's effective value — if `bankAccountId` changes, checked against `dto.currency ?? transaction.currency` on the *new* account; if only `currency` changes, checked against the *current* account (a fresh lookup, since `TRANSACTION_SELECT`'s embedded `bankAccount` doesn't carry `accountType`). If neither changes, nothing to re-validate.

Updated the stale Swagger description on `PATCH /transactions/:id` while touching this code — it still said "reverses the transaction's prior effect on its old bank account," a leftover from before balances were decoupled from transactions entirely (a much earlier follow-up). Also updated the `create`/`update` DTO field descriptions and the `create` endpoint's `@ApiResponse` for `currency`/`bankAccountId` to state the LOCAL/PKR rule.

### Verification
- `tsc --noEmit`, `eslint` — clean.
- Live: `POST /transactions` — HBL (LOCAL) + `PKR` → `201`; HBL (LOCAL) + `USD` → `400 "A LOCAL bank account only accepts PKR transactions"`; Whop (INTERNATIONAL) + `HKD` → `201` (unaffected, as intended).
- Live: `PATCH /transactions/:id` — moving an existing HKD-via-Whop transaction onto HBL (LOCAL) → `400`; changing an existing HBL/PKR transaction's `currency` to `USD` with `bankAccountId` unchanged → `400`; changing that same transaction's `saleAmount` alone (no `bankAccountId`/`currency` in the payload) → `200`, no unnecessary re-validation triggered.

## Follow-up: [2026-08-19] Bank logo added to `/overview`'s bank account fields

`logoUrl` was already available elsewhere (e.g. `GET /bank-accounts`, and embedded in `GET /clients`/`GET /transactions`), but missing from `/overview`. Added to both places `/overview` lists bank accounts:

- **`revenueByBankAccount`** (`getRevenueByBankAccount()`): completed an in-progress edit found on disk — `logoUrl: true` had been added to the Prisma `select` but the mapped return object and the `BankAccountRevenueItem` type weren't updated to match, which failed to compile (`tsc` caught it: "Property 'logoUrl' is missing"). Also fixed the type to `string | null` (a bank account's `logoUrl` is nullable — the in-progress edit had it as `string`, non-nullable, which would have been wrong for every account without a logo).
- **`bankAccounts.local`/`bankAccounts.international`** (`getBankAccountsByType()`): added the same field for consistency, since this is the other place `/overview` lists bank accounts (current-balance panel) — no reason for one bank-account list on the same endpoint to carry a logo and the other not to.

DTOs updated to match: `BankAccountRevenueItemDto` and `BankAccountItemDto` (`dashboard-overview-response.dto.ts`) both gained `logoUrl` (`ApiPropertyOptional`, nullable).

### Verification
- `tsc --noEmit`, `eslint` — clean (the pre-existing compile error from the in-progress edit is gone).
- Live: `GET /overview` — `logoUrl` present (as `null`, since no demo account has one uploaded) on every entry in `revenueByBankAccount`, `bankAccounts.local`, and `bankAccounts.international`.

## Follow-up: [2026-08-21] Only a platform admin can grant accounting access

**Problem.** Any workspace OWNER could grant or revoke accounting access, and the live SwiftNine LLC workspace has two owners (Zain and Ali) — so the workspace creator had the same power as the company admin. `role === 'OWNER'` therefore cannot be the discriminator; it needed a per-user flag.

There were also **two** paths that set `accountingRole`, so restricting the obvious endpoint alone would not have closed it:

1. `PUT /organizations/members/:id/accounting-role` — owner-gated
2. The invite flow — an owner could attach `accountingRole` to an invite (single *or* batch), which was copied onto the `WorkspaceMember` on accept. The batch route made this worse: one request could have granted accounting access to up to 50 people.

**`User.isPlatformAdmin`** (`prisma/schema.prisma`, migration `20260821180000_add_user_is_platform_admin`): company-wide flag, default `false`. Deliberately has **no API surface** — it is set by SQL only, so there is no privilege-escalation path through the app. Added to `AUTH_USER_SELECT`, and since `JwtStrategy` re-reads the user from the database on every request rather than trusting the token payload, granting or revoking it takes effect immediately with no token to invalidate.

**New `PlatformAdminGuard`** (`auth/guards/platform-admin.guard.ts`): reads `req.user.isPlatformAdmin`. Needs no workspace context and no membership lookup, so it runs straight after `JwtAuthGuard`. This is now the third and most global of the three role guards — `roles.guard` (workspace role), `accounting-role.guard` (accounting access), and this one (company-wide).

**Single write path.** `changeMemberAccountingRole()` is now the only place `accountingRole` is ever written:
- Route: `@UseGuards(JwtAuthGuard, PlatformAdminGuard)` replaces `RolesGuard` + `@Roles('OWNER')`. `RolesGuard` was dropped rather than stacked — no workspace context is needed, and keeping an OWNER check alongside would have let ordinary owners through.
- Service: `assertActorIsOwner()` replaced with a new `assertActorIsPlatformAdmin()`, which reads the flag fresh from the database. Checking at both layers means a future caller that forgets the guard still cannot reach around it.
- `accountingRole` removed **entirely** from `InviteMemberDto` and `BatchInviteMembersDto` — unconditionally, for everyone including platform admins, rather than adding a conditional sender check. `sendInvite`/`sendBatchInvites`/`sendInviteToEmail` no longer take or write the field, and `claimInvite`/`acceptInvite` no longer copy it onto the new member. A new member always starts with zero accounting access.
- `getInviteDetails` dropped its `accountingRole` response field, which would now always be `null`. **Frontend note:** this field is gone from `GET /workspaces/invite/:token`, and the invite form should no longer send an accounting field (it is silently ignored).

**Default bank accounts moved to workspace creation.** They were previously created on invite-accept, but only when that invite carried an `accountingRole` — with the field gone that trigger would never have fired, and new workspaces would silently have had no bank accounts. `provisionDefaultBankAccountsIfNeeded(tx, workspaceId, accountingRole)` became `provisionDefaultBankAccounts(tx, workspaceId)` (the `accountingRole` early-return dropped, the idempotent existing-count check kept) and is now called from `create()`. This also decouples the two concerns properly: the accounts exist from day one and simply stay invisible until a platform admin grants someone accounting access, since every accounting endpoint sits behind `AccountingRoleGuard`.

**`WorkspaceInvite.accountingRole` is now dead** — no longer read or written. Left as a nullable column rather than dropped, to avoid a data-dropping migration; documented as deprecated in the schema and safe to remove once live rows are all null.

**`scripts/lockdown-accounting-access.ts`** — one-off cleanup for legacy grants and any pending invite still carrying the field. Dry-run by default (prints counts, writes nothing); `--apply` performs the writes. Deliberately **not** part of the migration, since it revokes real people's access and should be run knowingly after reviewing the counts. Idempotent. Also warns when no platform admin exists yet.

Access levels themselves were already correct and are unchanged: `CEO` = read-only, `ACCOUNTANT` = read + write, `null` = none, enforced consistently across all four accounting controllers.

### Verification
- `tsc --noEmit`, `nest build api` — clean.
- **Lint:** no new errors. `workspace.service.ts` back to its pre-change baseline of 17 (pre-existing `no-unsafe-*` debt in code this change didn't touch); `organizations.controller.ts` and `workspace.controller.ts` each went **down** by one. Only the two formatting errors this change introduced were fixed, rather than running `--fix` across files and churning unrelated code.
- **Unit tests:** full suite identical to baseline — 345 passed, same 26 pre-existing failures, verified by diffing the failure sets before and after (the `AuthService` failures were already red, so the `AUTH_USER_SELECT` change did not cause them). Updated `workspace.service.spec.ts` for the two intentional behaviour changes: added a `bankAccount` mock plus an assertion that `create()` provisions the accounts, and added `isPlatformAdmin` to the two `AUTH_USER_SELECT` shape assertions. The one pre-existing `listMembers` failure was left alone as unrelated.
- **Live end-to-end, 14/14 checks passed** against a purpose-built scenario: a fresh workspace created by a non-admin owner, with a platform admin added as a *second* OWNER — so both actors held `role: 'OWNER'` and only the flag separated them.
  - Default bank accounts present immediately on workspace creation, with no accounting grant anywhere.
  - Owner can still invite (single and batch). `accountingRole: 'ACCOUNTANT'` sent in both payloads was **not persisted** on either invite row.
  - New member joins with `accountingRole: null`.
  - Non-admin OWNER granting → `403`, and nothing written to the database.
  - Platform admin: grant `CEO` → `200` and persisted; upgrade to `ACCOUNTANT` → persisted; revoke to `null` → `200` and cleared.
  - Every grant recorded in `ActivityLog` as `member_accounting_role_changed`.
  - Test users/workspaces removed afterwards.
- **Cleanup script** dry-run verified: correctly reported 4 legacy member grants, 0 pending invites, wrote nothing, and warned that no platform admin exists in the local database.

### Deployment notes
1. Apply the migration. It includes `UPDATE users SET is_platform_admin = true WHERE email = 'ali@swiftnine.com'` — **check the row count.** `0 rows` means that user does not exist yet on that environment (on live he currently shows as never having logged in), in which case re-run the `UPDATE` once he has signed in for the first time. Until then nobody can grant accounting access.
2. Run `scripts/lockdown-accounting-access.ts` (dry run first) to review and then clear legacy grants.

## Follow-up: [2026-08-24] Employees + manual commission per sale

Added a new `employees` entity so a transaction can optionally credit a sales employee and record what commission they're owed on it — entered by hand, never computed as a percentage of the sale.

### Schema changes

- New `Employee` model: `id`, `workspaceId`, `name`, timestamps — workspace-scoped, same shape as `Clients` today (no email/status field; kept to just a name for now).
- `Transaction` gained three nullable columns: `employeeId` (FK to `Employee`, `onDelete: Restrict` — same protection `bankAccountId` already has, so an employee with sales history can't be silently deleted out from under it), `commissionAmount` (`Decimal(12,2)`), `commissionCurrency` (`Currency`, but only ever validated as `USD`/`PKR` — commission is always paid in one of those two regardless of what currency the sale itself settled in).
- Fully additive: nothing existing was touched. Migration: `prisma/migrations/20260824140000_add_employee_commission/migration.sql`.
- **Not generated via `prisma migrate dev`** — the local dev database's `_prisma_migrations` history table was already out of sync with its actual schema (every prior migration showed as "not applied" despite the schema matching), so `migrate dev` insisted on a full reset. Generated instead via `prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema.prisma --script` against the live dev DB and applied by hand with `psql` — same approach the `accounting_per_workspace` migration used or a schema-to-schema diff, minus that one's `TRUNCATE` (nothing here is destructive). The pre-existing migration-history drift is unrelated to this change and was left alone.

### Backend

- New `employees` module (`apps/api/src/employees/`), a straight clone of the `clients` module's shape: `EmployeesController`/`EmployeesService`/DTOs/constants, same guard stack (`AccountingRoleGuard`, CEO+ACCOUNTANT read, ACCOUNTANT-only write), same list/search/get/update/delete behavior including the delete-blocked-while-linked-transactions-exist rule (409, mirroring `CLIENT_HAS_TRANSACTIONS`).
- `CreateTransactionDto`/`UpdateTransactionDto` gained `employeeId`, `commissionAmount`, `commissionCurrency` (all optional). Two rules enforced via Zod `.refine()` on create, and re-checked in `TransactionService.update` against the *effective* (existing-or-incoming) state since a PATCH can touch just one of the three fields:
  1. `commissionAmount` and `commissionCurrency` must be provided together — one without the other is rejected (`TRANSACTION_COMMISSION_FIELDS_MISMATCH`).
  2. A commission requires an employee to be assigned — `TRANSACTION_COMMISSION_REQUIRES_EMPLOYEE`.
- `TRANSACTION_SELECT` now embeds `employee: { id, name }` alongside the existing `client`/`bankAccount` embeds.
- `COMMISSION_CURRENCY_VALUES = ['USD', 'PKR']` added to `transaction.constants.ts`, deliberately narrower than the full `CURRENCY_VALUES` transactions use.

### Frontend

- `accounting.service.ts`: `AccountingEmployee`/`EmployeeSearchResult`/`EmployeeTransaction` types, `employeeService` (mirrors `clientService`), `COMMISSION_CURRENCIES` constant; `AccountingTransaction` and the create/update transaction payloads gained `employeeId`/`employee`/`commissionAmount`/`commissionCurrency`.
- `useAccounting.ts`: `useEmployeeMutations`, `useAccountingEmployees`, `useEmployeeSearch` — same shape as the client hooks. No new invalidation logic needed; the existing `[ACCOUNTING_ROOT_KEY]` prefix invalidation already covers the new query keys.
- New components: `EmployeePicker` (clone of `ClientPicker`), `EmployeeFormModal` (one modal handles both create and rename — unlike Clients, an Employee has only a `name` field so there's no create-only-field asymmetry to justify splitting it), `EmployeeTransactionsModal` (clone of `ClientTransactionsModal`, showing commission per sale instead of sale amount), `EmployeesView` (clone of `ClientsView`).
- New route `/accounts/employees` (reuses the existing `AccountingRouteGuard` layout) and a new "Employees" entry in the accounting sidebar nav, between Clients and Accounts & Balances.
- `AddSaleModal` and `TransactionsView`'s `EditTransactionModal` both gained an employee picker plus commission amount/currency inputs (the currency/amount fields only render once an employee is picked — clearing the employee clears them too, client-side, matching the backend's "commission needs an employee" rule). `TransactionsView`'s table gained Employee and Commission columns.

### Verification

- `tsc --noEmit` and `nest build` clean on the backend; `tsc --noEmit` and `eslint` clean on the frontend (only pre-existing, unrelated warnings remain on both sides).
- Migration SQL applied directly to the local dev database via `psql`; `\d "Employee"` / `\d "Transaction"` confirmed the new table, columns, indexes and FK constraint, with existing data (workspaces, members, transactions) untouched.
- No automated tests existed for `clients`/`transactions` before this change, so none were added here either — consistent with, not a regression from, the existing state of this codebase.

## Follow-up: [2026-08-21] `GET /clients/search` now returns every client, alphabetically

The client picker previously required a `q` and returned only clients whose name contained all of its words. It now returns the **whole client list, sorted A-Z**, and the frontend narrows it as the user types — no request per keystroke, and the user can open the dropdown and browse rather than having to guess at a name.

**`clients.service.ts`**: `search(workspaceId, q)` → `listAllForPicker(workspaceId)`. Renamed because a method called `search` that ignores its query is misleading; the route is unchanged (see below).

Sorting is done in JS with `localeCompare(..., { sensitivity: 'base' })`, not `orderBy: { clientName: 'asc' }`. The Prisma ordering defers to the database collation, which on a C/POSIX-collated column groups every capitalised name ahead of every lowercase one — so `Zenith Holdings` would sort before `acme industries`. Prisma can't express an expression-based `orderBy` (`LOWER(...)`), and doing it in JS avoids the raw-SQL alternative's coupling to physical table/column names (which would break silently if `Clients` ever gained an `@@map`). The list is a small bounded set, so sorting in memory costs nothing.

Deliberately **uncapped** — a picker that silently truncated would be worse than a slightly larger payload. Worth revisiting only if a workspace ever accumulates thousands of clients.

**Route kept as `/clients/search`** rather than renamed, so existing frontend calls keep working. `search-clients-query.dto.ts` was deleted (nothing referenced it any more), which means a `q` sent by an un-updated caller is now silently ignored rather than rejected — verified below.

**`scripts/seed-demo-clients.ts`** — seeds 30 clients into the demo workspace for testing. Names are chosen to be awkward for sorting rather than merely varied: all-lowercase and ALL-CAPS entries (to prove case-insensitivity), a leading-digit and a leading-symbol name, an accented name, and pairs differing only after several characters. Idempotent — skips names already present, so it can be re-run.

### Verification
- `tsc --noEmit`, `eslint` — clean.
- Live, demo workspace (33 clients after seeding): `GET /clients/search` returned all 33 in correct A-Z order. The cases that would have failed under database collation all sorted correctly:
  - `acme industries` (lowercase) sits between `Åberg Consulting` and `Anton Enne` — not grouped after the capitalised names.
  - `harbourside traders` (lowercase) lands in the H position, not at the end.
  - `Brightside Marketing` before `BRIGHTSIDE MEDIA` — case does not override the letter comparison (`Mar` < `Med`).
  - `Åberg Consulting` sorts beside `Aberdeen Logistics`, so the accent is folded rather than pushed to the end.
  - `3Point Analytics` leads and `Cedar & Sons` sits in C, so digits/symbols land predictably.
- **Backwards compatibility:** an old caller sending `?q=acme` gets `200` with all 33 clients (the param is ignored, not rejected), and omitting the previously-required `q` returns `200` rather than `422`.
- Still workspace-scoped: requesting with a different `x-workspace-id` returns `403 "You are not a member of this workspace"`.

**Frontend note:** this endpoint no longer filters. Move the substring matching client-side, and drop `q` from the request — it does nothing.

## Follow-up: [2026-08-25] `/overview`'s Client Revenue Summary now derived from real transactions

Reported off a screenshot: the "Client Revenue Summary" panel showed nonsense — a client with 6 real transactions showed `USD 0`, a client with zero transactions showed `USD 25,000`, and several brand-new test clients with no activity at all crowded into the top-5 slots. This was the gap flagged (but not yet fixed) in earlier session notes: `/overview`'s `topClients` read `Clients.totalRevenue`, a hand-maintained column nothing keeps in sync with actual sales, while `/reports/breakdown`'s `topClients` had already been computed correctly from transactions since the reporting work earlier this month.

**`accounting-dashboard.service.ts`**: `getOverview()` now calls `getTopClientsByRevenue(workspaceId)` (no range/filters → all-time) instead of the old `getTopClients(workspaceId)`. The old method and its `TopClientItem` type are deleted — nothing else referenced them. `getTopClientsByRevenue()`'s comment updated: it's no longer "the Reports-only ranking, distinct from Overview's" — it's now the only top-clients calculation, used by both endpoints.

**DTO**: `DashboardOverviewResponseDto.topClients` switched from the deleted `TopClientItemDto` to the existing `TopClientRevenueItemDto` (already used by `/reports/breakdown`). Descriptions on that shared DTO updated to describe both scopes it now serves (all-time for `/overview`, a date range for `/reports/breakdown`) rather than only the latter.

**Behavioral differences frontend should expect:**
- `totalRevenue` (native currency) is now often `null` — it's only populated when every one of a client's sales shares one currency; otherwise use `totalRevenueUsd`. This was already true for `/reports/breakdown` and is not new, just newly visible on `/overview`.
- A new `salesCount` field is now present.
- Clients with zero transactions are **absent**, not zero-filled — a padded top-5 of empty clients isn't meaningful the way a fixed bank-account list is.
- Sorted by `totalRevenueUsd` descending, computed from real `Transaction` rows — not whatever number was typed into `Clients.totalRevenue` at creation.

**Not touched, flagged instead:** the screenshot's duplicate "Acme Corp" is real duplicate data in the `847e1f05-...` ("Test") workspace, not a display bug — two separate `Clients` rows share that name (one from 2026-08-11 with 6 real transactions and `totalRevenue: 0`; one from 2026-08-25 with 0 transactions and `totalRevenue: 25000`, likely created manually while testing). This fix makes the panel correctly show only the one with real activity, but the duplicate record itself is left alone — deleting a client is a real, potentially destructive action, and one of the two has genuine transaction history attached.

### Verification
- `tsc --noEmit`, `eslint`, `nest build api` — clean.
- Live, demo workspace (`GET /overview`): `topClients` now returns Victoria Partners ($13,784.98, 13 sales), Anton Enne ($10,643.64, 6 sales), Phase Shop ($2,080.74, 5 sales) — real, transaction-derived figures, `totalRevenue: null` for all three since each has multi-currency sales, sorted descending by `totalRevenueUsd`.
- Simulated the identical query against the `847e1f05-...` ("Test") workspace directly (no login available for that account): confirms `/overview` will return exactly one entry there — `Acme Corp`, `$175,410`, `salesCount: 6` — the duplicate-named zero-transaction client and every zero-activity seeded test client correctly drop out entirely.

## Follow-up: [2026-08-25] `GET /clients` now shows a real, converted USD total — and the live-rate logic moved to a shared service

Reported off a screenshot of the Clients list: "Total Revenue" showed `USD 0` for a client with real sales (`PKR 175,000 · USD 410` in the "Sales Recorded" column) — the same root cause as the `/overview` topClients fix two entries above, just on a different endpoint. Also asked for the fix to actually sum multiple currencies into one converted USD figure, not just reflect a single currency.

**New shared `ExchangeRateService`** (`apps/api/src/exchange-rate/`): the live-fetch/cache/fallback logic that used to live entirely inside `AccountingDashboardService` is extracted here, since `ClientsService` needed the exact same conversion and duplicating a second independent fetch/cache would mean two services silently disagreeing on the current rate. `AccountingDashboardService` now injects it — `toUsd()` is a one-line pass-through so its ~10 existing call sites didn't need touching, and `getBalances()`'s `exchangeRatesToUsd` field now reads `exchangeRateService.getRates()`. `EXCHANGE_RATES_TO_USD` / `CURRENCY_API_URL` / `EXCHANGE_RATE_CACHE_TTL_MS` moved from `accounting-dashboard.constants.ts` to `exchange-rate.constants.ts` accordingly. New `ExchangeRateModule`, imported by both `AccountingDashboardModule` and `ClientsModule`.

**`clients.service.ts`**: new `totalRevenueUsd` field on both `ClientData` and `ClientListItemData` — every entry in the already-correct `totalSaleAmount` (native, per-currency, summed straight from `Transaction` rows) converted to USD and added together. `totalRevenue`/`currencyType` are **left exactly as they were** — a hand-typed figure set at client creation (`CreateClientDto.totalRevenue`), not touched by this change, since it's a real, independently-writable field with its own input contract, not merely a broken stand-in the way `/overview`'s old `topClients` was. `totalRevenueUsd` is the new, correct field for a "Total Revenue" display; `totalRevenue` still means whatever was typed in at creation and won't move as sales come in. `exchangeRateService.refresh()` is called once per public method that returns client data (`create`, `findAll`, `findClientOrThrow` — covering `findOne`/`update`/`remove`), each a cheap TTL-gated no-op once a rate has been fetched recently.

**`CurrencySaleTotal.currency` tightened from `string` to `Currency`** (the real Prisma enum type `Transaction.currency` already has) — needed so `toUsd(item.total, item.currency)` type-checks without a cast, and catches any future currency value that isn't one of the six supported ones at compile time instead of silently mis-converting it.

**DTOs**: `ClientResponseDto` and `ClientListItemResponseDto` both gained `totalRevenueUsd`, documented as the field that changes with real sales, distinct from the static `totalRevenue`.

### Verification
- `tsc --noEmit`, `eslint`, `nest build api` — clean.
- Full test suite unaffected: identical to the established baseline (345 passed, same 26 pre-existing failures — no spec files exist yet for `clients` or `accounting-dashboard`, matching earlier session notes).
- Live, demo workspace: `GET /clients` — Anton Enne (`AED 4200`, `USD 9500`) now returns `totalRevenueUsd: 10643.64` (4,200 AED ÷ live rate + 9,500 USD), matching `/overview`'s independently-verified figure for the same client from the previous follow-up.
- Simulated the identical logic directly against the `847e1f05-...` ("Test") workspace (no login available for `umair@swiftnine.com`): the exact client from the screenshot — `Acme Corp`, `PKR 175,000 + USD 410` — now computes `totalRevenueUsd: 1040.90`, replacing the `USD 0` shown before. Every other client with real sales (Zenith Holdings, Aberdeen Logistics, Cedar & Sons, Delta Freight Co, Ember Studios — seeded in the prior follow-up) got correct converted totals too.

**Frontend note:** bind the "Total Revenue" column to the new `totalRevenueUsd` field, not `totalRevenue` — the latter is unchanged (a static, hand-typed figure) and was never the source of the bug being fixed here.

## Follow-up: [2026-08-25] Commission decoupled from transactions — now a manual, PKR-only figure on Employee

Reverses the previous day's commission-on-transaction link (`20260824140000_add_employee_commission`): a transaction no longer optionally carries `employeeId`/`commissionAmount`/`commissionCurrency`. Instead, `Employee` gets two independent, manually-entered PKR figures — `paidCommission` and `pendingCommission` — with their sum, `totalCommission`, computed at read time. No relation to `Transaction` at all.

**Schema** (migration `20260825120000_remove_transaction_commission_link`): dropped `Transaction.employeeId` (+ its FK and index), `commissionAmount`, `commissionCurrency`. Added `Employee.paidCommission`/`pendingCommission` (`Decimal(12,2)`, default `0`). `Employee.transactions` relation and `Transaction.employee` relation both removed — the two models no longer reference each other.

**Data note**: 3 transactions (`DEMO-EMP-001/002/003`, in the `847e1f05-...` "Test" workspace) had `employeeId`/`commissionAmount` set — verified before writing the migration that these were test rows created while building the feature the day before, not real data. `prisma db push --accept-data-loss` used locally, consistent with this environment's established pattern (no working migration history — see earlier follow-ups).

**`employees.service.ts`** rewritten — no more transaction embedding, currency-grouped totals, or the `EMPLOYEE_HAS_TRANSACTIONS` delete-guard (nothing to guard against once there's no relation). `EmployeeData` is now `{ id, name, paidCommission, pendingCommission, totalCommission, createdAt, updatedAt }`; `totalCommission` is computed in `toEmployeeData()`, never stored, so it can't drift from its own inputs. `update()` now supports partial updates (`name`/`paidCommission`/`pendingCommission` independently), matching the pattern already used by `TransactionService.update()`.

**`transaction.service.ts`**: removed `findEmployeeOrThrow()`, the commission-fields-mismatch/requires-employee validation block in `update()`, and the employee/commission writes in `create()`. `TransactionData` no longer carries `commissionAmount`.

**DTOs**: `CreateEmployeeDto`/`UpdateEmployeeDto` gained `paidCommission`/`pendingCommission` (both optional, nonnegative, default `0` on create). `EmployeeResponseDto` dropped the currency-grouped `totalCommission` array, the embedded `transactions` list, and `_count` — replaced with three plain numbers. `CreateTransactionDto`/`UpdateTransactionDto`/`TransactionResponseDto` all dropped `employeeId`/`commissionAmount`/`commissionCurrency` and the now-meaningless `COMMISSION_CURRENCY_VALUES` constant.

### Verification
- `tsc --noEmit`, `eslint`, `nest build api` — clean.
- Full test suite unaffected: identical to the established baseline (345 passed, same 26 pre-existing failures).
- Live: `POST /employees` with `paidCommission: 15000, pendingCommission: 5000` → `201`, `totalCommission: 20000` in the response.
- Live: `POST /transactions` sending `employeeId`/`commissionAmount`/`commissionCurrency` in the payload anyway → `201`, but none of those three fields appear anywhere in the response — there's no schema column left to hold them, so they're silently dropped rather than erroring.
- Live: `PATCH /employees/:id` with only `pendingCommission` → updates just that field (`paidCommission` unchanged at `15000`, `pendingCommission` `5000 → 8000`) and correctly recomputes `totalCommission: 23000`.
- Test employee and transaction removed after verification.

## Follow-up: [2026-08-25] New `MANAGER` invite role — first step of the multi-OWNER cleanup

First step of a larger workspace-role redesign discussed but not yet built: today any workspace OWNER can invite someone else as OWNER too (`role: z.enum(['OWNER', 'MEMBER'])`), which is exactly how the live SwiftNine LLC workspace ended up with two OWNERs (Zain and Ali). The end goal is exactly one OWNER per workspace, set once at creation, never granted by invite — with a new MANAGER role for day-to-day delegation. This step is scoped to just the invite options; no permission/access logic changes yet, and existing multi-OWNER workspaces are untouched (that data cleanup is a separate, later step).

**Schema**: added `MANAGER` to the `Role` enum (migration `20260825140000_add_manager_role`, additive, `ALTER TYPE "Role" ADD VALUE 'MANAGER'`). Deliberately **not** a rename of the existing `ADMIN` value — `ADMIN` already has real, active meaning elsewhere (channel/chat moderation, project access, attachment-deletion parity with OWNER — `role === 'ADMIN'` checks in `channels.service.ts`, `chat.service.ts`, `project.service.ts`, `attachments.service.ts`). Reusing it for the new invite role would have silently handed all of that to anyone invited as a manager, which contradicts "no access/permission changes right now." `MANAGER` is a brand-new value nothing currently checks for, so granting it is a no-op for permissions today — exactly the intended scope.

**`invite-member.dto.ts` / `batch-invite-members.dto.ts`**: `role` narrowed from `z.enum(['OWNER', 'MEMBER'])` to `z.enum(['MANAGER', 'MEMBER'])`. `OWNER` is no longer an invite-able role at all, in either the single or batch route.

**Exhaustive `Role` mappings elsewhere that needed a `MANAGER` entry to keep compiling**, found via `tsc`, not by searching:
- `doc-permissions.constants.ts`'s `WORKSPACE_ROLE_TO_DOC_ROLE: Record<Role, DocRole>` — mapped `MANAGER` to `'EDITOR'`, same as `MEMBER`/`ADMIN`, consistent with "grants nothing extra yet."
- `member-response.dto.ts` and `member-detail-response.dto.ts` — their `role` field's literal union type gained `'MANAGER'`.

**Left alone, flagged not fixed**: `channel-response.dto.ts` and `message-response.dto.ts` have the same `'OWNER' | 'ADMIN' | 'MEMBER'` literal for `ChannelMember.role` (the *same* `Role` enum), now technically missing `MANAGER` too — didn't surface as a compile error because `channels.service.ts` builds those literals through its own normalization logic rather than passing a raw `Role` through, so nothing is actually broken. A documentation-completeness gap in an unrelated module, outside this step's scope.

**Not done, by design — the rest of the discussed redesign**: MANAGER still grants no permissions (no `assertActorIsOwner`-equivalent for managers yet, so only a real OWNER can send invites, remove members, or change roles); existing multi-OWNER workspaces are unchanged; `ChannelMember`/chat/project role checks are untouched. These are explicit follow-ups, not gaps introduced here.

### Verification
- `tsc --noEmit`, `nest build api` — clean.
- `eslint` — zero new errors on any touched file; the two touched response DTOs each dropped from 15 combined pre-existing errors down to 13 by fixing only the two lines this change added, leaving unrelated pre-existing formatting debt untouched.
- Full test suite unaffected: identical to the established baseline (345 passed, same 26 pre-existing failures).
- Live, demo workspace: `POST /workspaces/:id/invite` with `role: "MANAGER"` → `200`, persisted as `WorkspaceInvite.role = 'MANAGER'`. Same with `role: "MEMBER"` (and the default, omitted) → `200`, persisted as `MEMBER`. `role: "OWNER"` → `422` with `"expected one of \"MANAGER\"|\"MEMBER\""`, and correctly never persisted (no invite row created). Test invites removed after verification.

## Follow-up: [2026-08-26] Commission re-linked to transactions (create-only, PKR) + new `todayVsYesterday` overview metric

Two independent, user-requested changes, planned together and confirmed before building (see "Confirm before I execute" decisions below):

1. Re-adds a link between `Transaction` and `Employee` — narrower than the design removed the previous day (`20260825120000_remove_transaction_commission_link`): PKR-only (no `commissionCurrency`), fully optional, and **one-way** — creating a commission-bearing transaction increments `Employee.pendingCommission` once; later edits or deletes of that transaction never touch it again.
2. Adds `revenueSummary.todayVsYesterday` to the accounting overview, alongside the existing (unchanged) `today` field.

### Commission re-link

**Schema** (migration `20260826120000_add_transaction_commission_link`): `Transaction` gains `employeeId` (nullable) + `commissionAmount` (`Decimal(12,2)`, default `0`), with `employee Employee? @relation(..., onDelete: SetNull)` — **SetNull, not Restrict**, so `EmployeesService.remove()` stays unconditional exactly as documented in the previous follow-up; deleting an employee just clears the link on their past transactions instead of being blocked. `Employee` gets the required back-reference `transactions Transaction[]`, not exposed on any Employee API response (`EMPLOYEES_SELECT` untouched — no employee→transactions list was requested or added).

**Both-or-neither pairing, confirmed with the user rather than assumed**: `employeeId` and `commissionAmount` must be provided together or not at all — never one without the other. Enforced with a `.refine()` on both `CreateTransactionDto` and `UpdateTransactionDto` (`(employeeId === undefined) === (commissionAmount === undefined)`), so this is a per-request DTO-level check, not a merge against the transaction's existing state. `UpdateTransactionDto.employeeId` is nullable (unlike create) so a transaction can have its employee/commission cleared by sending both `employeeId: null` and `commissionAmount: 0`.

**One-way, create-only pendingCommission increment — a deliberate scope decision, not an oversight**: `TransactionService.create()` wraps the transaction insert and `employee.update({ pendingCommission: { increment } })` in one `prisma.$transaction([...])`, only when `employeeId` is set and `commissionAmount > 0`. `update()` and `remove()` never adjust `pendingCommission`, even when `employeeId`/`commissionAmount` change or the transaction is deleted — correcting a wrong commission after the fact goes through the existing manual `PATCH /employees/:id`, the same path every other commission edit already uses. This was flagged as an explicit architectural choice before building: auto-adjusting on update/delete too would reintroduce the same kind of implicit balance-linkage this codebase deliberately removed for `BankAccount.amount`. The user chose one-way over full reversibility.

**`TRANSACTION_SELECT`**: added `employeeId`, `commissionAmount`, `employee: { select: { id, name } }` — so commission now shows on both the transaction list and detail view for free, via the same `toTransactionData()` path both already go through.

**New error messages** (`transaction.constants.ts`): `EMPLOYEE_NOT_FOUND` (employee must exist in the workspace, checked the same way `findClientOrThrow`/`findBankAccountOrThrow` already do), `TRANSACTION_EMPLOYEE_COMMISSION_PAIR` (the both-or-neither validation message).

### Overview — `todayVsYesterday`

No "this week" comparison metric was found anywhere in the codebase, git history, or the frontend integration doc — the only two comparisons that existed were `today` (already yesterday-vs-day-before, per the `[2026-08-25]` relabel) and `thisMonth`. Confirmed with the user rather than guessed: added a **new** `todayVsYesterday` field to `RevenueSummary` rather than mutating `today`'s meaning again, since `today` was deliberately changed away from a literal today-vs-yesterday comparison to avoid a partial current day always reading as a misleading collapse against a complete previous one. `todayVsYesterday` reintroduces exactly that live, partial-day comparison on purpose (today so far vs. all of yesterday) — it reuses the `startOfToday`/`startOfYesterday` boundaries `getRevenueSummary()` already computes, adding one more `sumRevenueUsd()` call for today-so-far and comparing it against the already-fetched `yesterdayTotal`. Documented on both the internal `RevenueSummary` type and `dashboard-overview-response.dto.ts` as carrying the same "misleading negative in the early morning" caveat `today` was fixed to avoid — frontend should label it as a partial/so-far figure.

### DTOs

`CreateTransactionDto`/`UpdateTransactionDto` gained `employeeId`/`commissionAmount` (paired, as above). `TransactionResponseDto` gained `employeeId`, `employee` (new `TransactionEmployeeBriefDto`, `{ id, name }`), `commissionAmount`. `dashboard-overview-response.dto.ts`'s `RevenueSummaryDto` gained `todayVsYesterday`.

### Verification
- `tsc --noEmit`, `eslint` (zero new errors — only prettier formatting on newly-added lines, `--fix`-ed), `nest build api` — all clean.
- Full test suite unaffected: identical to the established baseline (345 passed, 26 pre-existing failures, 9 failed suites, 371 total).
- `prisma db push` + `prisma migrate resolve --applied` for the new migration (this DB's established pattern — see earlier follow-ups on migration-history drift).
- Live, demo workspace (`811785b9-...`): `POST /transactions` with `employeeId` but no `commissionAmount` → `422 employeeId and commissionAmount must be provided together, or not at all`. `POST /transactions` with both → `201`, employee's `pendingCommission` correctly incremented (`2000 → 2750` for a `750` commission). `GET /transactions/:id` shows `employee`/`commissionAmount` on the detail response. `PATCH /transactions/:id` changing `commissionAmount` (`750 → 100`, both fields resent) → transaction updated, employee's `pendingCommission` **unchanged** at `2750`, confirming the one-way behavior. Deleting an employee still linked to a transaction → `200`, transaction's `employeeId`/`employee` become `null`, `commissionAmount` untouched, confirming `SetNull`. `GET /accounting-dashboard/overview` → `revenueSummary.todayVsYesterday` present alongside the unchanged `today`, correctly reflecting a same-day test transaction. All test employees/transactions removed after verification.

## Follow-up: [2026-08-26] Employee responses now embed their sales

Immediate follow-up to the commission re-link above: transactions already showed their employee, but employees showed no way to see which sales their commission came from — just the two totals. User asked for it embedded directly on the employee response, same as one call rather than a separate lookup.

**`employees.constants.ts`**: new `EMPLOYEE_TRANSACTION_SELECT` — same embed-on-every-response pattern `clients.constants.ts` already uses for `CLIENT_TRANSACTION_SELECT` (id, clientName, saleAmount, currency, saleDate, refId, description, createdAt, updatedAt, bank account brief), plus `commissionAmount`, which is the actual reason this list exists on an employee — the PKR figure earned on that specific sale. `EMPLOYEES_SELECT` gained `_count: { select: { transactions: true } }` and `transactions: { select: EMPLOYEE_TRANSACTION_SELECT, orderBy: { createdAt: 'desc' } }`, matching `CLIENTS_SELECT`/`CLIENTS_LIST_SELECT` exactly — embedded on **every** employee response (create, list, get-one, update), not just detail.

**`employees.service.ts`**: `toEmployeeData()` now also maps each embedded transaction's `saleAmount`/`commissionAmount` from `Decimal` to `number` (`mapEmployeeTransactions()`, mirroring `clients.service.ts`'s `mapTransactions()`). `remove()`'s comment updated — it's unconditional because `Transaction.employeeId` is `onDelete: SetNull`, not because there's no relation (there now is one).

**`employee-response.dto.ts`**: added `_count` (`{ transactions: number }`) and `transactions: EmployeeTransactionBriefDto[]` (id, clientName, saleAmount, currency, saleDate, refId, description, commissionAmount, bankAccount, createdAt, updatedAt).

**Deliberately not built**: no new endpoint — this is a bigger response, not a second call. A workspace with a very high-volume employee (many sales) will return a proportionally larger `GET /employees` payload, same tradeoff `CLIENTS_LIST_SELECT` already accepted for clients; revisit the same way if it ever becomes an issue for either.

### Verification
- `tsc --noEmit`, `eslint` (zero new errors — only prettier formatting on newly-added lines, `--fix`-ed), `nest build api` — all clean.
- Full test suite unaffected: identical to the established baseline (345 passed, 26 pre-existing failures, 9 failed suites, 371 total).
- Live, demo workspace: created an employee (empty `transactions: []`, `_count.transactions: 0`), then a transaction with that employee + `commissionAmount: 123.45`. `GET /employees/:id` → `_count.transactions: 1`, `transactions[0]` carries the sale's `clientName`, `saleAmount`, `commissionAmount: 123.45`, and `bankAccount`; `pendingCommission` correctly `123.45`. `GET /employees?q=...` (list) → same embed present, confirming it's not detail-only. Test employee and transaction removed after verification.

## Follow-up: [2026-08-26] `GET /employees/search` now supports a full-list picker, matching `/clients/search`

Asked while wiring up the transaction-creation employee dropdown: `q` was required (min 1 char) on `/employees/search`, so a picker couldn't open and show every employee the way `/clients/search` already does — it would 422 with nothing typed yet.

**`search-employees-query.dto.ts`**: `q` changed from required to `.optional()` (no `.min(1)`).

**`employees.service.ts`**: `search(workspaceId, q?)` — when `q` is falsy (omitted or empty string), returns every employee in the workspace via a plain `findMany`, sorted in JS with `localeCompare`. Same reasoning as `ClientsService.listAllForPicker`: this DB's collation puts every capitalised name before every lowercase one, so a Prisma `orderBy: { name: 'asc' }` would produce a wrong-looking order — confirmed by seeding `"zzz..."` and `"Aaa..."` test names and checking the returned order directly, not just trusting the code. When `q` is provided, the existing multi-token AND-matched `contains` filter (Prisma `orderBy: { name: 'asc' }`) is unchanged — only the full-list branch is new.

**Deliberately not a full mirror of `/clients/search`**: clients dropped `q` from the route entirely (always full list, filtering always client-side). Employees keeps `q` as a real, working filter — the full-list behavior only kicks in when `q` is absent, so the existing name-search use case (if any caller relies on it) keeps working exactly as before.

**Controller/Swagger**: `@ApiQuery({ name: 'q', required: false, ... })`, operation summary/description updated to describe both modes.

### Verification
- `tsc --noEmit`, `eslint`, `nest build api` — clean.
- Full test suite unaffected: identical to the established baseline (345 passed, 26 pre-existing failures, 9 failed suites, 371 total).
- Live, demo workspace: seeded `"zzz Search Test Zeta"` and `"Aaa Search Test Alpha"`. `GET /employees/search` (no `q`) and `GET /employees/search?q=` (empty) both → `200`, full alphabetical list, `Aaa...` before `zzz...` — confirming the collation fix actually took effect, not just that no error was thrown. `GET /employees/search?q=Alpha` → `200`, only the matching employee, confirming the filtered path is untouched. Test employees removed after verification. Verified against the demo accountant's own already-running dev server rather than starting a new one, since it was already up when this session began.

## Follow-up: [2026-08-26] `totalPendingCommission` / `totalPendingPayment` on the employees/vendors list

Asked for a sum of all pending commission/payments on the employees and vendors sections. Added as a new top-level field on each list response, alongside the existing `data`/`meta`, computed with a `prisma.aggregate({ _sum })` run in parallel with the existing `count`/`findMany` — not derived by summing `data` client-side, since that would only cover the current page.

**Scoped to the active filter, not the whole workspace** — same `where` as the list query, so it reflects the same set `meta.total` counts (all matching rows, not just the current page). Searching narrows the sum along with the results; an unfiltered call still returns the true workspace-wide total. Confirmed this distinction matters and works correctly by testing the filtered case explicitly, not just the unfiltered one.

**Did not touch the shared `paginated()` helper** (`libs/common/src/utils/api-response.ts`) — it's used by every paginated list in the app (transactions, clients, tasks, ...), so changing its shape would ripple everywhere for a field only these two resources need. Instead, `EmployeesController.findAll()`/`VendorsController.findAll()` spread an extra key onto `paginated(...)`'s return value, with the method's return type widened to `PaginatedApiResponse<T> & { totalPendingX: number }` locally — no other paginated endpoint is affected.

**`employees.service.ts`**/**`vendors.service.ts`**: `EmployeeListResult`/`VendorListResult` gained `totalPendingCommission`/`totalPendingPayment`. `vendors.service.ts` gained its own `round2()` (mirroring the one already in `employees.service.ts`/`clients.service.ts` — Prisma's `_sum` returns a `Decimal`, converted to a rounded `number` the same way every other money field in these services already is).

**DTOs**: `PaginatedEmployeesResponseDto`/`PaginatedVendorsResponseDto` gained the new field for Swagger.

### Verification
- `tsc --noEmit`, `eslint` (zero new errors — only prettier line-wrapping on the newly-added return type, `--fix`-ed), `nest build api` — all clean.
- Full test suite unaffected: identical to the established baseline (345 passed, 26 pre-existing failures, 9 failed suites, 371 total).
- Live, demo workspace: seeded two employees (`pendingCommission: 1000.50` / `2500.25`) and two vendors (`pendingPayment: 5000` / `1234.75`). `GET /employees` → `totalPendingCommission: 3500.75`; `GET /vendors` → `totalPendingPayment: 6234.75` — correct even with `?limit=1`, confirming the sum isn't accidentally scoped to the current page. `GET /employees?q=Sum Test A` → `totalPendingCommission: 1000.5`, confirming the sum narrows with an active search filter rather than always being the workspace-wide total. Test employees/vendors removed after verification.
