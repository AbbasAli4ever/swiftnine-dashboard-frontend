# Accounting Module — Frontend Integration Guide (pull of 2026-08-25)

Covers backend commits `b3f59ae` → `9411089`, plus the export work added on top
of that pull. Nine changes in all — seven of them **breaking** for existing
frontend code.

Every response body below was captured from the live API (`localhost:3020`,
prefix `/api/v1`) — not written from the DTOs.

**Before anything else:** run `npx prisma generate`. The generated Prisma client
is not committed, so a fresh pull fails to compile until you regenerate.

---

## Summary — what breaks

| # | Area | Change | Breaking? |
|---|---|---|---|
| 1 | Employees | Commission moved off Transaction onto Employee | **Yes** |
| 2 | Clients picker | `GET /clients/search` no longer filters | **Yes** |
| 3 | Clients list | New `totalRevenueUsd` — bind revenue column to it | **Yes** (wrong value, not a crash) |
| 4 | Overview | `topClients` now transaction-derived | **Yes** |
| 5 | Exports | New PDF endpoint alongside the existing Excel one | No — additive |
| 6 | Exports | Column order changed in **both** Excel and PDF | **Yes** (if columns referenced by position) |
| 7 | Overview | Daily metric now reports **yesterday**, not today | **Yes** (label change — key unchanged) |
| 8 | Clients | `POST /clients` accepts **only** `clientName` — no custom `totalRevenue`/`currencyType` | **Yes** (remove 2 form fields) |
| 9 | Vendors | **New** `/vendors` CRUD — name + pending payment (PKR) | No — new feature |

Items 1–4 came with the backend dev's pull; 5–9 were added afterwards.

---

## 1. Employees — commission fields (the main change)

Commission is **no longer attached to a transaction**. It is now two
independent, manually-entered **PKR** figures on the employee itself, with no
relation to `Transaction` at all.

### Removed from every transaction payload

`employeeId`, `employee`, `commissionAmount`, `commissionCurrency` are gone from
`POST`/`PATCH` request bodies **and** from every transaction response.

> ⚠️ **Silent-failure trap:** `POST /transactions` still returns **201** if you
> send `employeeId` / `commissionAmount` / `commissionCurrency`. They are
> silently discarded — no column exists to hold them. You get no error. Strip
> them from your request builders or you will think commission is saving when
> it is not.

Confirmed live — transaction response keys are now exactly:

```
bankAccount, bankAccountId, client, clientId, clientName, createdAt,
currency, description, id, refId, saleAmount, saleDate, updatedAt
```

### New employee shape

Identical on **create, list, get-one, and update** — one shared mapper, so no
path can return the pair without the sum.

```json
{
  "id": "62100643-1b63-4183-a824-b72da8d54650",
  "name": "Sara Khan",
  "paidCommission": 15000,
  "pendingCommission": 5000,
  "totalCommission": 20000,
  "createdAt": "2026-08-25T10:37:49.250Z",
  "updatedAt": "2026-08-25T10:37:49.250Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `paidCommission` | `number` | PKR. Manual entry. Never negative. |
| `pendingCommission` | `number` | PKR. Manual entry. Never negative. |
| `totalCommission` | `number` | **Read-only.** `paid + pending`, computed server-side. |

**All PKR — there is no currency field.** Don't render a currency selector.
Verified live: the module has no currency column and no FX conversion — a value
sent as `277880.85` comes back as `277880.85`. Commissions are never converted
the way client revenue is (section 3).

**`totalCommission` is never writable.** Sending it is ignored; it is recomputed
on every read, so it cannot drift. Render it as a derived/disabled field.

### Gone from `EmployeeResponseDto`

`_count`, the embedded `transactions[]` array, and the old currency-grouped
`totalCommission` **array**. If you rendered an employee's transaction list or
`_count.transactions`, that data no longer exists on this endpoint.

> Note the type change: `totalCommission` used to be an **array** of
> `{currency, total}`. It is now a plain **number**. Same key, different type —
> this will not fail loudly, it will just render wrong.

### Add form — `POST /employees`

```jsonc
{
  "name": "Sara Khan",          // required, 1–255 chars
  "paidCommission": 15000,      // optional, defaults to 0
  "pendingCommission": 5000     // optional, defaults to 0
}
```

Both commission fields are optional. Omitting them yields `0`, not `null`.

Strings are coerced (`"15000"` works), so an uncast numeric input is safe.

> **Do not send `totalCommission`.** It is not an input — the server computes
> it. Anything you send for it is ignored.

The form collects **three inputs at most**: name, paid, pending. Total is
display-only.

Validation errors return **422**:

```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [{ "field": "paidCommission", "message": "Paid commission cannot be negative" }]
}
```

Map `errors[].field` onto your form inputs.

### Edit form — `PATCH /employees/:id`

**All three fields are optional and independent.** Send only what changed.

```jsonc
{ "pendingCommission": 8000 }   // paidCommission is left untouched
```

`totalCommission` recalculates on every write. Verified against the live API,
starting from `paid 15,000 / pending 5,000`:

| Sent | Result |
|---|---|
| `{"paidCommission": 25000}` | pending preserved (5,000) → total **30,000** |
| `{"pendingCommission": 8000}` | paid preserved (25,000) → total **33,000** |
| `{"name": "…"}` | both amounts preserved, total unchanged |
| all three at once | `1234.56 + 765.44` → total **2,000.00** |
| both set to `0` | total **0** |

Editing one amount never disturbs the other — so an edit form may safely send a
single changed field.

An **empty body `{}` is rejected with 422** ("At least one field is required").
If your form diffs against the original and sends only changed fields, guard
against submitting nothing.

> **Render `totalCommission` as a read-only / disabled field**, not an input.
> It is recomputed server-side on every read and cannot be written. Updating it
> live as the user types (`paid + pending`) is a nice touch, but the server's
> value is authoritative.

### List — `GET /employees`

Every item carries **all four display fields** — `name`, `paidCommission`,
`pendingCommission`, `totalCommission`:

```
NAME                        PAID      PENDING        TOTAL
------------------------------------------------------------
Ali Raza                9,000.00     3,500.00    12,500.00
Bilal Ahmed                 0.00    12,000.00    12,000.00
Zoya Malik              4,200.25       799.75     5,000.00
```

Verified live: no row was missing a field, every `totalCommission` equalled
`paid + pending`, and no unexpected keys were present. All amounts are **PKR** —
label the columns accordingly.

Pagination/sorting unchanged: `q`, `page`, `limit`, `sortBy`, `sortOrder`.
`sortBy` accepts `name`, `createdAt`, `updatedAt` — **not** the commission
fields. Sorting by commission must be client-side, or ask backend to add it.

### Delete — `DELETE /employees/:id`

Now **unconditional**. The old "cannot delete an employee that still has
transactions" guard is gone along with the relation. Returns `200`; a subsequent
`GET` returns `404`.

> Since deletion can no longer be blocked, a confirmation dialog is now the only
> thing standing between a misclick and a lost record.

### Employees — pre-existing rows

Employees created before this change return `0`, not `null` (the column default
backfilled). No null-guard needed.

### Decimals

`0.15 + 0.30` returns exactly `0.45` — the server rounds to 2 dp, so no float
drift. Values are `Decimal(12,2)`: max 9,999,999,999.99, two decimal places.

---

## 2. `GET /clients/search` no longer searches

Same route, completely different behaviour: it now returns **every client in the
workspace**, uncapped, sorted A–Z case-insensitively.

```json
{ "success": true,
  "data": [ { "id": "1fd7833b-…", "clientName": "Abbas" },
            { "id": "56b6c2af-…", "clientName": "Shoaib" } ],
  "message": null }
```

**Move substring filtering client-side** and drop `q` from the request.

> `?q=` is now **ignored, not rejected**. Verified: `?q=zzzz` returns the full
> list, `200`. So an un-updated frontend will appear to work while showing
> unfiltered results for every query — a silent bug, not a visible error.

Upside: fetch once on mount, filter locally, no request per keystroke.
Uncapped by design — revisit if a workspace ever holds thousands of clients.

---

## 3. Clients list — bind revenue to `totalRevenueUsd`

`GET /clients` gained **`totalRevenueUsd`**: every currency in `totalSaleAmount`
converted at live FX and summed into one figure.

Live example — note the discrepancy this fixes:

```json
{
  "clientName": "Abbas",
  "totalRevenue": 0,              // ← stale hand-typed field
  "currencyType": "USD",
  "totalSaleAmount": [ { "currency": "USD", "total": 11300 },
                       { "currency": "HKD", "total": 300 } ],
  "totalRevenueUsd": 11338.28     // ← the real number
}
```

| Field | Meaning |
|---|---|
| `totalRevenue` | **Static.** Hand-typed at client creation. Never updates as sales come in. Currently `0` for real clients. |
| `totalRevenueUsd` | **Real.** Derived from actual `Transaction` rows, converted to USD. |

**Bind the "Total Revenue" column to `totalRevenueUsd`.** This is the fix for
the client showing `USD 0` despite having sales.

`totalRevenue` was deliberately left alone — it is still independently writable
via `CreateClientDto.totalRevenue`. Present it as something else (e.g. "Opening
/ legacy revenue") or hide it; do not label it "Total Revenue".

Always USD, regardless of `currencyType`. Label the column accordingly.

---

## 4. `/overview` — `topClients` now transaction-derived

Was ranked by the hand-maintained `Clients.totalRevenue`; now computed from real
transactions, same as `/reports/breakdown`.

```json
[ { "id": "1fd7833b-…", "clientName": "Abbas",
    "totalRevenue": null, "totalRevenueUsd": 11338.28,
    "salesCount": 7, "currencyType": null } ]
```

Three things to handle:

1. **`totalRevenue` is now frequently `null`** — populated only when *all* of a
   client's sales share one currency. **Render `totalRevenueUsd`.** A component
   formatting `totalRevenue` directly will print `null`/`NaN`.
2. **`salesCount` is new** — transaction count; worth surfacing.
3. **Zero-transaction clients are absent, not zero-filled** — the list can be
   shorter than 5, or empty. Don't assume 5 rows; render an empty state.

Sorted by `totalRevenueUsd` descending.

---

## 5. PDF export — new endpoint

`GET /api/v1/accounting-dashboard/reports/export/pdf`

Identical query params, date resolution, filters and auth to the existing
`.xlsx` export — only the output format differs. Add a "Download PDF" action
beside the existing Excel one.

```
GET /accounting-dashboard/reports/export/pdf?dateFrom=2026-08-01&dateTo=2026-08-31
→ 200  Content-Type: application/pdf
       Content-Disposition: attachment; filename="accounting-report-2026-08-01_to_2026-08-31.pdf"
```

Params (all optional, same as the xlsx route): `date` **or** `dateFrom`+`dateTo`,
plus `clientId`, `bankAccountId`, `accountType`, `currency`. Defaults to today
(UTC) when no date is given. Handle it exactly like the existing xlsx download —
blob response, not JSON.

The document contains the Swiftnine logo in the header, the report title and
date range, the transaction count, the same five-column table, and per-currency
totals. Multi-page reports repeat the table header and carry `Page N of M`
footers.

**Downloading it.** The response is a binary blob, not JSON — a shared API
client that calls `res.json()` on every response will corrupt it. If your
existing Excel download already works, copy that path and change only the URL
and the filename extension:

```ts
const res = await fetch(
  `/api/v1/accounting-dashboard/reports/export/pdf?${params}`,
  { headers: { Authorization: `Bearer ${token}`, 'x-workspace-id': workspaceId } },
);
if (!res.ok) throw new Error(`Export failed: ${res.status}`);

const blob = await res.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
// The server already sets a filename via Content-Disposition; this is the
// fallback for browsers that ignore it on a blob: URL.
a.download = `accounting-report-${from}_to_${to}.pdf`;
a.click();
URL.revokeObjectURL(url);
```

Both export routes require the same auth as everything else here — a bearer
token **and** the `x-workspace-id` header. A plain `<a href>` to the endpoint
will 401, since the browser sends neither.

## 6. Export column order changed — both formats

The `.xlsx` column order **changed**, and the new `.pdf` matches it:

| Before | After |
|---|---|
| Date, Revenue, Currency, Client, Bank | **Date, Client, Bank, Currency, Revenue** |

Revenue now sits last, beside the Currency naming its unit.

| Excel column | Before | After |
|---|---|---|
| A | Date | Date |
| B | Revenue | **Client** |
| C | Currency | **Bank** |
| D | Client | **Currency** |
| E | Bank | **Revenue** |

Only column A is unchanged. If any frontend code, saved template, or user
documentation refers to these by position, update it.

Revenue remains the **native** amount, never converted to USD — unchanged.

Per-currency totals appear at the end of the PDF (one line per currency
present). There is deliberately no grand total: the rows carry native amounts
across different currencies, so a single sum would be meaningless.

---

## 7. Overview — the daily metric now reports yesterday

The key metric that showed **today's** revenue now shows **yesterday's**, and
its `changePercent` compares yesterday against **the day before yesterday**.

```jsonc
"revenueSummary": {
  "today": {                  // ← key unchanged, meaning changed
    "totalUsd": 1000,         // yesterday's revenue
    "changePercent": 100      // vs the day before yesterday
  },
  "thisMonth": { ... },       // unchanged
  "thisYear":  { ... },       // unchanged
  "totalSales":{ ... }        // unchanged
}
```

> ⚠️ **The JSON key is still `today`.** It was deliberately not renamed to
> `yesterday`: renaming would make the field *vanish* from every un-updated
> client rather than merely change value, which fails far more destructively.
> The key name is now inaccurate — treat it as "the daily metric".

**What the frontend must do: relabel the tile.** Change the caption from
*"Today's Revenue"* to *"Yesterday's Revenue"*, and the comparison caption to
something like *"vs. the day before"*. Nothing else changes — same path, same
shape, same types. If you do not relabel it, the dashboard will show yesterday's
number under a "Today" heading, which is worse than the original bug.

**Why it changed.** A partial current day was always being compared against a
complete previous day, so every morning the dashboard showed a large negative
change that meant nothing. Both windows are now complete, closed days.

**Day boundaries are server-local (PKT, UTC+5)**, not UTC — a pre-existing
convention in this metric, unchanged here. "Yesterday" means the previous PKT
calendar day, so a transaction at `2026-08-24T20:00:00Z` counts as Aug 25.

The other three metrics (`thisMonth`, `thisYear`, `totalSales`) are untouched
and still include the current, partial period.

---

## 8. Creating a client — name only

`POST /clients` now accepts **one field: `clientName`**.

**A custom total revenue and currency are no longer accepted when adding a
client.** There is no way to set an opening revenue figure or pick a currency
for it — the server assigns both automatically and ignores anything sent for
them.

```jsonc
// The entire accepted payload
{ "clientName": "Acme Corp" }
```

Every new client is auto-assigned:

| Field | Auto-assigned value | Settable? |
|---|---|---|
| `totalRevenue` | `0` | ❌ No |
| `currencyType` | `null` | ❌ No |

**Remove the "Total Revenue" and "Currency" inputs from the add-client form.**
Name is the only thing to collect.

**Why there is no currency to choose.** The figure that actually matters,
`totalRevenueUsd`, is always denominated in USD — it is computed by converting
every one of the client's transactions to USD and summing them. Since the value
is guaranteed to be USD, a per-client currency field would be redundant, which
is why `currencyType` is left `null` rather than being stamped with `"USD"`.

**Why a user-entered figure was dropped.** Nothing kept it in sync with real
sales. It was displayed as a client's revenue while never moving as
transactions came in — the direct cause of the "`USD 0` despite real sales" bug
in section 3. Revenue is now derived from transactions only, never typed in.

> ⚠️ **Silent discard.** Sending the old payload still returns **201** — the two
> extra fields are ignored, not rejected. Verified: posting
> `{"clientName":"…","totalRevenue":25000,"currencyType":"USD"}` created a
> client with `totalRevenue: 0, currencyType: null`. An un-updated form will
> look like it works while the figure the user typed silently vanishes. This is
> the same trap as the commission fields in section 1.

Missing `clientName` returns **422**:

```json
{ "statusCode": 422, "message": "Validation failed",
  "errors": [{ "field": "clientName", "message": "Invalid input: expected string, received undefined" }] }
```

### What did *not* change

Only the **input** was removed. Both fields still exist in the database and are
still returned on every client response — existing clients keep whatever was
hand-typed before this change, so nothing is lost:

| Layer | `totalRevenue` / `currencyType` |
|---|---|
| `POST /clients` input | **Removed** — rejected silently if sent |
| Database columns | Still present, unchanged |
| `GET /clients` response | Still returned, now marked `deprecated` |
| Clients created after this change | Always `0` and `null` |
| Clients created before | Keep their original values |

`PATCH /clients/:id` is unaffected — it only ever accepted `clientName`.

**Reading them:** treat both as legacy. For anything labelled "Total Revenue",
bind to **`totalRevenueUsd`** (section 3) — the real, transaction-derived
figure. `totalRevenue` will be `0` for every newly created client, so a UI
still bound to it will show `USD 0` for all new clients forever.

---

## 9. Vendors — new feature

A new `/vendors` resource, deliberately shaped like `/employees` (section 1) so
the add/edit/list screens can reuse those components. A vendor is **a name and
one amount owed** — nothing else.

`Vendor` has **no relation to `Transaction`**: `pendingPayment` is a manual
figure, not derived from any purchase or sale.

### Endpoints

| Method | Path | Role | Purpose |
|---|---|---|---|
| `POST` | `/vendors` | ACCOUNTANT | Create |
| `GET` | `/vendors` | CEO · ACCOUNTANT | Paginated list + search |
| `GET` | `/vendors/search?q=` | CEO · ACCOUNTANT | Typeahead (id + name only) |
| `GET` | `/vendors/:vendorId` | CEO · ACCOUNTANT | Single vendor |
| `PATCH` | `/vendors/:vendorId` | ACCOUNTANT | Update |
| `DELETE` | `/vendors/:vendorId` | ACCOUNTANT | Delete |

Same auth as everything else: bearer token **and** the `x-workspace-id` header.

### Shape

Identical on create, list, get-one and update — one shared mapper:

```json
{
  "id": "5722e8a8-56b3-46ef-a972-6c22ed623c60",
  "name": "Karachi Print House",
  "pendingPayment": 45000,
  "createdAt": "2026-08-25T11:34:08.426Z",
  "updatedAt": "2026-08-25T11:34:08.426Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | Required, 1–255 chars |
| `pendingPayment` | `number` | **PKR.** Manual entry, never negative, defaults to `0` |

**All PKR — there is no currency field.** Don't render a currency selector.

> Unlike `Employee`, there is **no** paid/total counterpart — a vendor carries
> one figure only, so there is nothing computed to display alongside it.

### Add form — `POST /vendors`

```jsonc
{
  "name": "Karachi Print House",   // required
  "pendingPayment": 45000          // optional, defaults to 0
}
```

Strings are coerced (`"45000"` works), so an uncast numeric input is safe.
Decimals are kept to 2 dp (`Decimal(12,2)`, max 9,999,999,999.99).

### Edit form — `PATCH /vendors/:vendorId`

Both fields optional and independent — **send only what changed**:

```jsonc
{ "pendingPayment": 72500.75 }   // name left untouched
```

An empty body `{}` is rejected with **422** ("At least one field is required").
Guard against submitting nothing if your form diffs against the original.

### List — `GET /vendors`

Standard pagination: `q`, `page`, `limit`, `sortBy`, `sortOrder`.
`sortBy` accepts `name`, `createdAt`, `updatedAt` — **not** `pendingPayment`;
sort by amount client-side, or ask backend to add it.

```
Vendor                       Pending Payment (PKR)
Karachi Print House                     72,500.75
```

### Validation errors

**422** with per-field detail — map `errors[].field` onto your inputs:

```json
{ "statusCode": 422, "message": "Validation failed",
  "errors": [{ "field": "pendingPayment", "message": "Pending payment cannot be negative" }] }
```

### Delete

Unconditional — a vendor has no linked records to guard against. Returns `200`;
a subsequent `GET` returns `404`. **A confirm dialog is the only safeguard.**

---

## Frontend checklist

**Employees**
- [ ] Add `paidCommission` / `pendingCommission` inputs to the add form (numeric, min 0, optional)
- [ ] Add both to the edit form; send **only changed** fields; block empty submits
- [ ] Show `totalCommission` as read-only/derived — never send it (not an input)
- [ ] Add all four columns to the list — name, paid, pending, total — labelled **PKR**
- [ ] No currency selector anywhere — commissions are always PKR, never converted
- [ ] Remove any employee→transactions list, `_count.transactions`, and commission-currency selector
- [ ] `totalCommission` changed **array → number** — update the type and any `.map()` over it
- [ ] Remove the "has transactions" delete guard; keep a confirm dialog
- [ ] Map `errors[].field` from 422 responses onto inputs

**Transactions**
- [ ] Strip `employeeId` / `commissionAmount` / `commissionCurrency` from request builders (silently dropped, still 201)
- [ ] Remove those fields from transaction types and any table columns

**Clients**
- [ ] Remove "Total Revenue" and "Currency" inputs from the add-client form — custom values are not accepted
- [ ] Stop sending `totalRevenue` / `currencyType` on `POST /clients` (silently discarded)
- [ ] Don't show a currency picker for client revenue anywhere — it is always USD
- [ ] Drop `q` from `/clients/search`; filter locally
- [ ] Bind "Total Revenue" to `totalRevenueUsd`; relabel or hide `totalRevenue`

**Overview**
- [ ] `topClients` → use `totalRevenueUsd`; handle `totalRevenue: null`
- [ ] Handle fewer than 5 (or zero) entries; optionally show `salesCount`

**Overview — daily metric**
- [ ] Relabel the tile "Today's Revenue" → **"Yesterday's Revenue"**
- [ ] Relabel its comparison caption to "vs. the day before"
- [ ] Do **not** rename the JSON key you read — it is still `revenueSummary.today`

**Vendors (new)**
- [ ] Build the add form: `name` + `pendingPayment` (numeric, min 0, optional), labelled **PKR**
- [ ] Build the edit form: both optional, send **only changed** fields, block empty submits
- [ ] Build the list with a "Pending Payment (PKR)" column
- [ ] No currency selector — always PKR
- [ ] Confirm dialog on delete (no server-side guard)
- [ ] No currency selector — `pendingPayment` is always PKR, never converted
- [ ] Reuse the Employees screens — same shape, one figure instead of three

**Exports**
- [ ] Add a "Download PDF" action hitting `reports/export/pdf` (same params as xlsx)
- [ ] Handle the response as a **blob** — never `res.json()`
- [ ] Send both `Authorization` and `x-workspace-id`; a bare `<a href>` will 401
- [ ] Pass the Reports page's active filters through, so the file matches the table on screen
- [ ] Update any reference to Excel columns by position — B–E all shifted

---

## Known backend issues (not frontend-blocking)

1. ~~**Schema/DB nullability mismatch.**~~ **Resolved — was not a real issue.**
   `prisma migrate diff` against the live database returns an empty diff, so the
   columns really are `NOT NULL DEFAULT 0` and the database matches the schema.
   The `Decimal | null` in the generated client is a Prisma 7 type-generation
   artifact, not a schema drift. No action needed.
2. **Stale Swagger.** `PATCH /employees/:id` is still summarised as *"Rename an
   employee"*; the `POST` summary omits the commission fields. Behaviour is
   correct — only the docs are wrong.
3. **No test coverage** for `employees`, `clients`, or `accounting-dashboard`.
   Everything above was verified by hand against the live API.

---

## Verification log

Run against `localhost:3020` as `accountant@swiftnine.com`, workspace
`d6edc250-…` ("Swiftnine"). Test rows created and deleted.

| Test | Result |
|---|---|
| `POST` with both fields | `201` — `15000 / 5000 / 20000` |
| `POST` with fields omitted | `201` — defaults `0 / 0 / 0` |
| `POST paidCommission: -5` | `422` "Paid commission cannot be negative" |
| `GET /employees` | All items carry all 3 fields; every sum correct |
| `PATCH` only `pendingCommission` | `200` — `paid` preserved, total → `23000` |
| `PATCH` only `name` | `200` — both commissions preserved |
| `PATCH {}` | `422` "At least one field is required" |
| Decimals `0.15 + 0.30` | `0.45` — no float drift |
| `GET /employees/:id` | Carries all 3 fields |
| `DELETE` | `200`, unconditional |
| `GET` after delete | `404` |
| `GET /clients/search?q=zzzz` | Full list returned — `q` ignored |
| `GET /clients` | `totalRevenue: 0` vs `totalRevenueUsd: 11338.28` |
| `GET /overview` | `topClients[].totalRevenue: null`, `totalRevenueUsd` correct |
| Transaction response keys | No `employeeId` / `commission*` — clean |
| `tsc --noEmit`, `nest build api`, `eslint` | Clean (after `prisma generate`) |
| `jest` | 345 passed / 26 pre-existing failures — unchanged baseline |
| PDF: 120 rows | 8 pages, repeated header, `Page N of M` footers |
| PDF: long client name | Truncated with an ellipsis to one line, row height held |
| PDF: zero transactions | Renders header + "No transactions match the selected filters." |
| PDF: per-currency totals | USD 1,000+1,751.50+2,503 = 5,254.50 — correct |
| Live `reports/export/pdf` | `200`, `application/pdf`, logo + table render correctly |
| Live `reports/export` (xlsx) | `200`, columns `Date, Client, Bank, Currency, Revenue` |
| Daily metric: seeded yesterday $1,000 / day-before $500 / today $9,999 | `today.totalUsd: 1000`, `changePercent: 100` — today's $9,999 correctly excluded |
| `POST /clients` `{"clientName":"…"}` | `201` — `totalRevenue: 0`, `currencyType: null` |
| `POST /clients` with legacy `totalRevenue`/`currencyType` | `201` — both silently discarded |
| `POST /clients` `{}` | `422` — `clientName` required |
| Existing clients after the change | Kept their original `currencyType: USD` — untouched |
| Client FX: 1,000 USD + 50,000 PKR + 5,000 HKD + 2,000 AED | `totalRevenueUsd: 2362.50` — matches an independent recomputation exactly |
| Same client via `/clients`, `/clients/:id`, `/overview` | All three paths returned `2362.50` |
| Single-currency client (3,672.50 AED) | `totalRevenue: 3672.5`, `currencyType: AED`, `totalRevenueUsd: 1000` |
| `POST /vendors` name + `pendingPayment` | `201` — `45000` stored |
| `POST /vendors` name only | `201` — `pendingPayment: 0` |
| `POST /vendors` negative / no name | `422` both |
| `PATCH /vendors` amount only / name only | `200` — the other field preserved |
| `PATCH /vendors` `{}` | `422` "At least one field is required" |
| `GET /vendors` list | All items carry `pendingPayment`; pagination meta correct |
| `GET /vendors/search?q=Print Karachi` | Matched out-of-order words |
| Vendor from another workspace | `403` — tenant-isolated |
| `DELETE /vendors/:id` then `GET` | `200` then `404` |
| Employee add: name + paid 15,000 + pending 5,000 | `201` — `totalCommission: 20000` |
| Employee edit: paid only / pending only / name only / all three / both zero | All `200`, other fields preserved, total recalculated each time |
| Employee list: 3 seeded employees | All four fields on every row, every total = paid + pending |
| Employee PKR: sent `paidCommission: 277880.85` (≈$1,000 at live FX) | Returned `277880.85` unchanged — no conversion, no currency/USD keys |
| Vendor PKR: sent `pendingPayment: 277880.85` | Returned `277880.85` unchanged — no conversion, no currency/USD keys |
