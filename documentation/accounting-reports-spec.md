# Accounting Reports — Backend Specification

**Audience:** the backend developer building out the Reports section.
**Source brief:** `Accounting_Revenue_Management_UIUX_Flow.pdf` §13–§17.
**Status of this doc:** specification + gap analysis. Everything marked ❌ or ⚠️ is *not built* — this doc is the plan for building it, not a record of what exists.

> **Read first:** `docs/accounting-workspace-migration-changes.md` is the source of truth for what the accounting feature currently does and why. This doc covers Reports specifically and does not repeat that history.

---

## 1. The core distinction: Overview vs. Reports

This is the single most important thing to internalize before writing any code, because it decides where a new endpoint belongs.

| | **Overview** | **Reports** |
|---|---|---|
| Question answered | "Where do we stand *right now*?" | "What happened *during period X*?" |
| Date input | **None** — always current | **Required** — a date, month, or year |
| Granularity | Aggregate totals only | Down to individual payments |
| Purpose | Monitor at a glance | Review, submit, export |
| Primary user | CEO (landing screen) | Accountant produces → CEO reviews |
| Actions | None — read-only display | Submit · Edit · Export (per brief) |
| Brief sections | §4–§9 | §13–§16 |

**The rule:** if the endpoint takes a date/period parameter and answers a question about a *closed* period, it's Reports. If it describes the present with no date input, it's Overview.

### 1.1 Why the overlap is intentional, not redundant

§15 and §16 explicitly ask for Revenue by Platform / Currency / Client — the same breakdowns Overview already shows. **This is deliberate duplication.** Overview shows them all-time; Reports shows them scoped to the selected period. Same aggregation, different time window.

Do **not** try to "reuse" Overview's endpoint for Reports screens by adding flags to it. Overview is one call backing one screen. Reports needs the same math over a caller-supplied range. The correct shared abstraction is at the *service-method* level (a date-ranged private helper both call), not the endpoint level.

### 1.2 What makes Reports genuinely different

Three things Overview will never have:

1. **Per-transaction detail** — §13's Client Payments list. Overview is aggregate-only by design.
2. **A workflow** — submit, edit, export. Overview has no actions at all. This is the brief's entire §1 purpose: replacing the WhatsApp habit with Hussnain reviews → submits → Ali Bhai reads.
3. **Named-period comparison** — §15's "July 2026 vs June 2026," §16's "Best Revenue Month."

---

## 2. What is implemented today

Three endpoints on `accounting-dashboard`, all `GET`, all workspace-scoped via the `x-workspace-id` header, all guarded by `JwtAuthGuard, WorkspaceGuard, AccountingRoleGuard` with `@RequireAccountingRole('CEO', 'ACCOUNTANT')`.

### 2.1 `GET /accounting-dashboard/overview?period=`

`period`: `daily` | `weekly` | `monthly` | `yearly`, default `daily`.

Returns seven sections: `balances`, `revenueSummary`, `revenueOverview`, `revenueByBankAccount`, `revenueByCurrency`, `bankAccounts`, `topClients`.

> **Updated (see changelog):** `period` now does two things, not one. It still controls `revenueOverview.points`' bucket granularity, and it *also* scopes both `revenueByBankAccount` and `revenueByCurrency` to a current window (today/trailing-7-days/month-to-date/year-to-date). `topClients` is the only one **not** scoped by it — still all-time regardless of `period` — so the original trap now holds for that one field only.

### 2.2 `GET /accounting-dashboard/daily-report?date=YYYY-MM-DD`

`date` required, validated by regex `^\d{4}-\d{2}-\d{2}$`.

```jsonc
{
  "date": "2026-07-28",
  "revenueUsd": 4200,
  "salesCount": 11,
  "balances": { /* same shape as overview.balances */ },
  "clientPayments": [
    {
      "id": "…", "clientName": "Acme Corp",
      "saleAmount": 199.99, "currency": "USD",
      "bankAccount": { "id": "…", "bankName": "HBL", "logoUrl": "…" }
    }
  ]
}
```

Live-computed on every call. There is no persisted per-day record and no submit step.

### 2.3 `GET /accounting-dashboard/monthly-breakdown?year=YYYY`

`year` required, integer 2000–2100. Returns exactly 12 points:

```jsonc
{ "year": 2026, "points": [{ "label": "2026-01", "totalUsd": 4200 }, …] }
```

> **Not the same as `/overview?period=yearly`**, which returns **5 yearly** totals (2022, 2023, …). This returns **12 monthly** totals within one year. Different chart shapes; that's why both exist.

---

## 3. Feature-by-feature: brief vs. implementation

### §13 Daily Report Preview — ⚠️ mostly covered

| Brief row | Status | Notes |
|---|---|---|
| Income (EUR, GBP, USD, HKD, Crypto, Whop, Airwallex) | ❌ | Only a single `revenueUsd` total. No per-currency or per-account split for that day. |
| Total Income | ✅ | `revenueUsd` |
| Sales (11 Sales) | ✅ | `salesCount` |
| Pakistan Balance | ⚠️ | In `balances`, but **current**, not as-of-that-date |
| International Balance | ⚠️ | Same caveat |
| Client Payments (Client · Amount · Platform) | ✅ | `clientPayments`, with bank name + logo |
| **CTA: Submit Daily Report** | ❌ | No backend. See §5 open decision. |

### §14 Daily Reports (multi-date table) — ❌ missing entirely

The brief wants a table of dates with Revenue / Sales / PKR Balance / USD Balance per row, and View · Edit · Export actions.

No endpoint returns a *range* of days. `daily-report` takes exactly one `date`, so a frontend would have to fire N calls.

> **Blocking issue:** the PKR Balance and USD Balance columns are **not truthfully implementable** today. `getBalances()` returns current balances, so every row in the table would show identical values regardless of its date. Making those columns real requires persisted balance history (see §5).

### §15 Monthly Reports — ⚠️ partial

| Brief item | Status | Notes |
|---|---|---|
| Total Revenue | ✅ | `/overview?period=monthly` → `revenueSummary.thisMonth` |
| Total Sales | ✅ | `revenueSummary.totalSales` |
| Average Sale | ✅ | Derivable client-side: `totalUsd / count` |
| Total Client Payments | ⚠️ | Count exists; per-month client breakdown does not |
| Chart: Daily Revenue | ✅ | `revenueOverview` with `period=daily` |
| Chart: Revenue by Platform | ❌ | `revenueByBankAccount` is **all-time only** |
| Chart: Revenue by Currency | ❌ | `revenueByCurrency` is **all-time only** |
| Chart: Revenue by Client | ❌ | `topClients` is all-time **and** uses an unsynced field (§4.2) |
| July 2026 vs June 2026 comparison | ⚠️ | `changePercent` gives current-vs-previous only, not two arbitrary named months |

### §16 Yearly Reports — ⚠️ partial

| Brief item | Status | Notes |
|---|---|---|
| Total Revenue / Total Sales | ✅ | `revenueSummary.thisYear` — but only the *current* year |
| Average Monthly Revenue | ✅ | Derivable from `monthly-breakdown` points |
| Best Revenue Month | ✅ | `max()` over `monthly-breakdown.points`, client-side |
| Monthly chart Jan–Dec | ✅ | `monthly-breakdown?year=` |
| Revenue by Client / Platform / Currency | ❌ | Same all-time-only limitation |
| Monthly Sales (count per month) | ❌ | `monthly-breakdown` returns `totalUsd` only, no count |

### §17 Analytics — ❌ missing entirely

No endpoints. The brief wants Revenue / Client / Platform / Currency / Sales analytics under filters Today · This Week · This Month · This Year · Custom Range. Every one needs date-ranged breakdowns that don't exist.

---

## 4. Root causes — fix these, not the symptoms

### 4.1 Every breakdown is all-time only ← *the main blocker*

`getRevenueByBankAccount`, `getRevenueByCurrency`, and `getTopClients` accept only `workspaceId`. None takes a date range.

§15, §16, and §17 all need exactly these three, scoped to a period. **This is one change that unblocks all three sections.** Building each screen's aggregation separately would triplicate the work.

Recommended shape — add an optional range to each private method:

```ts
private async getRevenueByCurrency(
  workspaceId: string,
  range?: DateRange,   // reuse the existing DateRange type
): Promise<CurrencyRevenueItem[]> {
  const grouped = await this.prisma.transaction.groupBy({
    by: ['currency'],
    where: { workspaceId, ...(range && { saleDate: range }) },
    _sum: { saleAmount: true },
  });
  // … unchanged
}
```

Overview keeps calling them with no range (all-time, current behavior preserved — not a breaking change). Reports endpoints pass the selected period. `DateRange` already exists in the service.

### 4.2 `topClients` ranks by an unsynced column

`getTopClients()` orders by the stored `Clients.totalRevenue` field. **Nothing syncs that from `Transaction`** — it's hand-entered at client creation and isn't even editable via `PATCH /clients`. Long-standing known drift.

So the brief's "Revenue by Client" is currently a manually-typed number, not computed revenue. **Decide this before building any §15/§16 client chart on top of it.** Options:

- **(a)** Rank by summed `Transaction.saleAmount` (correct, but changes existing `/overview` behavior)
- **(b)** Add a computed `totalSaleAmount` alongside, leave `totalRevenue` alone (non-breaking, two similar numbers)
- **(c)** Sync `totalRevenue` on transaction write (fixes the root cause, most work, needs backfill)

### 4.3 Timezone handling is inconsistent — verify before extending

Three different conventions currently coexist:

| Method | Convention |
|---|---|
| `getRevenueSummary` | **Local time** (`new Date(y, m, d)`) |
| `getBucketConfig` (overview chart) | **Local time** |
| `getDailyReport` | **UTC** (`new Date(\`${date}T00:00:00.000Z\`)`) |
| `getMonthlyBreakdownForYear` | **UTC** (`Date.UTC(...)`) — deliberately fixed, see changelog |

`getMonthlyBreakdownForYear` was explicitly fixed to UTC after a real bug (month labels drifting by a day on a UTC+5 host). The local-time paths were audited and found *correct in practice* when both read and write go through Prisma — see the changelog's "Revenue KPI audit."

**Any new date-ranged endpoint must pick one convention and state it.** Prefer UTC to match `daily-report`. Verify with a real API round-trip, never with raw SQL inserts — that distinction is what made the earlier audit produce a false positive.

---

## 5. Open product decision — persisted snapshots

**Not resolved. Flagged for the team.**

Two brief items imply frozen per-day records:
- §13's primary CTA **"Submit Daily Report"**
- §14's per-date **PKR / USD Balance columns**

The current design deliberately computes everything live, with no `DailyReport` table.

**If we stay live-computed:**
- ✅ Simpler; no schema change, no migration, no backfill
- ❌ A past report changes if someone edits an old transaction
- ❌ §14's balance columns can only ever show *current* balances — they'd be identical on every row
- ❌ No "submit" concept, so the brief's core workflow doesn't exist

**If we add snapshots:**
- New `DailyReport` table (workspace, date, revenueUsd, salesCount, frozen balances, submittedBy, submittedAt) + a `POST .../daily-report/submit` endpoint
- ✅ Matches the brief literally; §14's columns become truthful; reports become an auditable record
- ❌ Schema change + migration; needs a rule for re-submitting a corrected day

**Recommendation:** the brief's §1 purpose is *replacing a reporting workflow*, and a report you can't submit isn't a report. If §13/§14 are being built as specified, snapshots are probably necessary. But this is a product call, not a technical one.

---

## 6. Suggested build order

Ordered by leverage — each step unblocks the next.

1. **Date-range params on the three breakdowns** (§4.1). One change, unblocks §15/§16/§17. Non-breaking if the param is optional. **Start here.**
2. **Resolve `topClients`** (§4.2). Cheap, but blocks every client chart. Needs a decision, not just code.
3. **`GET /daily-reports?from=&to=`** for §14's table — one row per date (`date`, `revenueUsd`, `salesCount`). Ship *without* the balance columns pending §5. Cap the range (e.g. 90 days) so it can't be used to scan all history.
4. **Add `salesCount` to `monthly-breakdown` points** for §16's Monthly Sales. Small.
5. **Named-period comparison** for §15 (`?month=2026-07&compareTo=2026-06`) rather than relying on implicit current-vs-previous.
6. **§17 Analytics** — largely falls out of step 1. Reassess scope once it lands.
7. **Snapshots** (§5) — only after the product decision.

---

## 7. Conventions any new Reports endpoint must follow

Non-negotiable, derived from the existing code and past bugs:

- **Workspace scoping** — every query filters by `workspaceId` from `req.workspaceContext`, never a URL param or body field.
- **Guards** — `@UseGuards(JwtAuthGuard, WorkspaceGuard, AccountingRoleGuard)` + `@RequireAccountingRole('CEO', 'ACCOUNTANT')`. Reports are read-only, so both roles get access. A submit endpoint (§5) would be `ACCOUNTANT`-only.
- **Money** — `Decimal` never crosses the API boundary. Always `Number(...)` in a mapper, then `round2()`.
- **Currency conversion** — `EXCHANGE_RATES_TO_USD` in `accounting-dashboard.constants.ts`. Fixed placeholder rates, no live FX provider. Convert in TypeScript, never inside SQL, so the table isn't duplicated into a query string.
- **Raw SQL** — only where Prisma genuinely can't express it (`generate_series` bucketing). If you must: **`@map`ped columns need their DB name** (`workspace_id`, not `workspaceId`). `$queryRaw` bypasses Prisma's field mapping — this shipped as a runtime 500 that `tsc`, `eslint`, and `nest build` all passed. Only a real query proves it.
- **Validation** — zod via `createZodDto`, matching the existing query DTOs.
- **Verification** — round-trip through the real API (create → read → clean up), not raw SQL inserts. Raw `pg` writes serialize dates with a different convention than Prisma and will produce false positives on any timezone-boundary test.
- **Documentation** — per the standing convention, every change gets a dated `## Follow-up:` section appended to `docs/accounting-workspace-migration-changes.md`.

---

## 8. Quick reference — the answer to "how different are they?"

**In data:** ~60% shared. Reports reuses Overview's balances, revenue sums, and sales counts, differing mainly by time window.

**Structurally:** very different. Reports as specified is a *workflow* — submit, edit, export, with per-transaction detail and frozen records. Overview is a stateless read with no actions.

**Today:** Reports ≈ Overview + a client-payments list, minus the breakdowns.
**As specified:** Reports becomes a distinct surface — per-month revenue by client, per-year by currency, an exportable submitted record.

The gap between those two sentences is the work this document describes.
