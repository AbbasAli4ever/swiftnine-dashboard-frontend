# Admin Flow

Admin integration covers guarded report screens, authenticated CSV exports, and
certificate revocation. These endpoints are for users whose University user ID
has a matching `lms_admins` row.

Read [`../01-foundations.md`](../01-foundations.md) first for bearer auth,
success envelopes, error envelopes, IDs, and timestamps. Use Swagger for
current response schemas; this doc defines the screen-level admin behavior and
the cases where admin endpoints intentionally diverge from learner conventions.

## Admin gate

Admin endpoints remain bearer-authenticated. After JWT auth, the admin guard
checks `lms_admins` for the current user ID.

| Runtime result | Frontend meaning |
| --- | --- |
| `401` | Bearer token is missing, invalid, or expired. Hand auth recovery to the dashboard flow. |
| `403` | User is authenticated but has no University admin row. Render an access-denied state, not an empty report table. |
| `2xx` | User passed the current admin gate for that endpoint. |

Do not infer admin access from frontend role labels alone. The backend guard is
the final check for these report and revocation routes.

## Route map

| Admin need | Endpoint |
| --- | --- |
| User progress table | `GET /lms/admin/reports/user-progress` |
| User progress CSV | `GET /lms/admin/reports/user-progress.csv` |
| Course completion table | `GET /lms/admin/reports/course-completion` |
| Course completion CSV | `GET /lms/admin/reports/course-completion.csv` |
| Certificate table | `GET /lms/admin/reports/certificates` |
| Certificate CSV | `GET /lms/admin/reports/certificates.csv` |
| Expired certificate table | `GET /lms/admin/reports/expired-certificates` |
| Expired certificate CSV | `GET /lms/admin/reports/expired-certificates.csv` |
| Revoke certificate | `PATCH /lms/admin/certificates/:id/revoke` |

## Admin report pagination

JSON report endpoints return paginated report data. They use the same
`{ data, meta }` response idea as other paginated JSON endpoints, but not the
same query limits as learner lists.

| Query param | Admin report convention |
| --- | --- |
| `page` | One-based integer. Default `1`. Minimum `1`. |
| `pageSize` | Integer. Default `50`. Minimum `1`. Maximum `200`. |

Keep admin report pagination config separate from learner list helpers when the
frontend caps or defaults page size.

## Report screens

### User progress

Use:

```text
GET /lms/admin/reports/user-progress
```

This report is enrollment-centered. It combines enrollment status with course
progress information.

| Row area | Frontend use |
| --- | --- |
| Enrollment and user IDs | Stable admin drill-down/reference values. |
| Course ID and title | Course context for the row. |
| Enrollment status | Enrollment lifecycle state. |
| Progress status, percentage, completion flag | Learner completion view. |
| Enrolled and completed timestamps | Report ordering/display fields. |

If course progress does not exist for an enrollment, backend report rows fall
back to `NOT_STARTED`, `0` percent, and incomplete.

### Course completion

Use:

```text
GET /lms/admin/reports/course-completion
```

This report is course-centered.

| Row area | Frontend use |
| --- | --- |
| Course ID, title, category, active flag | Course identity and catalog state. |
| Enrollment count | Denominator for completion reporting. |
| Completion count | Completed progress count. |
| Completion rate | Backend-calculated percent, `0` when there are no enrollments. |

### Certificate reports

Use:

```text
GET /lms/admin/reports/certificates
GET /lms/admin/reports/expired-certificates
```

The general certificate report includes certificate lifecycle data. The expired
certificate report is the same reporting family filtered to expired
certificates.

Rows include certificate/user/course references, recipient snapshot fields,
status, issued and expiry times, and revocation metadata where present. Keep
recipient fields separate from live dashboard profile identity: certificates
carry issuance-time recipient snapshots.

## CSV exports

Each report table has a `.csv` export endpoint. CSV responses are raw streamed
responses with:

```http
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="..."
```

They are not JSON envelopes.

### Download with auth

The CSV endpoints require the same bearer authorization as JSON admin reports.
A plain `window.open(csvUrl)` does not attach the University bearer token.

Use an authenticated browser request that attaches the current bearer token,
then hand the resulting CSV blob to browser download handling. If the frontend
architecture proxies authenticated API downloads through its own server layer,
that proxy can own the file response instead.

Do not try to parse the export as JSON before download.

### Streaming failure note

CSV is streamed in batches. If export work fails after the stream starts, the
backend logs the failure and writes an error CSV line before ending the stream:

```csv
# ERROR,export_failed,<message>
```

That is different from a pre-stream HTTP error. For operational/reporting UX,
keep an eye on file download failures and avoid treating every downloaded CSV
as guaranteed complete without the consumer checking its content.

## Revoke a certificate

Call:

```text
PATCH /lms/admin/certificates/:id/revoke
```

Payload:

```json
{
  "reason": "Issued in error."
}
```

`reason` is required, trimmed, and limited to 1000 characters.

Revocation behavior:

1. Missing certificate ID returns not found.
2. A certificate that is not yet revoked changes to `REVOKED`, stores
   `revokedAt` and `revokedReason`, and records a revocation event.
3. Revoking an already revoked certificate returns its current certificate
   payload without creating a new state transition.

## Revocation impact

Revocation is visible outside the admin screen:

| Surface | Expected effect |
| --- | --- |
| Learner-owned certificate data | Certificate status becomes `REVOKED`. |
| Learner-owned download | Current download route blocks revoked certificates. |
| Public verification | Verify page should render the revoked state from certificate status and revocation data. |

The public certificate behavior is documented in
[`certificates.md`](./certificates.md). Admin UI should update its own report
row after revocation and should not assume already-issued verification links
stop resolving.

## Frontend checklist

Before marking admin integration complete:

1. Render `403` as an explicit admin access-denied state.
2. Use admin report pagination defaults and limits, not learner-list defaults.
3. Treat JSON reports and streamed CSV exports as separate response types.
4. Attach bearer auth to CSV downloads through authenticated fetch or an owned
   proxy path.
5. Refresh certificate/report state after revocation and keep learner/public
   revoked status behavior aligned with the certificate flow doc.
