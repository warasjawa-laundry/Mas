# Member points and transaction history

The public QR portal previously prioritized the 2027 balance while 2026 transactions appeared only in a secondary trial line. It offered no transaction-level explanation of the points balance.

## Result

The current WIB calendar year is selected by default. Members can select another year without combining balances. A compact summary shows selected-year points and the all-time transaction count after cancellations.

History displays each original transaction once, with WIB date/time, original amount when available, captured points, and cancellation status. Cancelled points are labelled as cancelled and excluded from the balance. Legacy entries without amounts are explicitly labelled. No redemption target or artificial progress bar is invented.

History is paginated in groups of 20 with a 21st-row lookahead and stable timestamp/ID ordering. A refresh button updates server data. Errors are shown as unavailable, separately from a genuine empty year or missing year rules.

## Data boundary

New migration `20261017123427_stage16_public_member_history.sql` adds an index and a read-only history function following the existing active-card digest capability. The public wrapper is SECURITY INVOKER; the private lookup uses a fixed empty search path and verifies the active, non-revoked card and active member before reading that member's records. There is no caller-supplied member ID and no table grant to anonymous users.

Returned fields are transaction ID, date/time, amount, captured points, program year and cancellation status. Customer names, contact information, staff identities, free-text transaction descriptions and cancellation reasons are excluded. Existing point rules and ledger values are unchanged.

## Verification and deployment scope

- Isolated QA migration applied with the canonical migration version above.
- Rollback integration test verifies active/revoked/inactive/unknown cards, member isolation, year separation, pagination, legacy null amounts, cancellation/balance reconciliation and denied anonymous table reads.
- CI repeats the integration test against PostgreSQL 17. Route tests cover current-year default, scoped digests, failure states and pagination boundaries. Browser fixtures render the exact public presentation component with synthetic data at phone/desktop widths.
- Security/performance advisors reviewed: existing closed-card-table RLS informational notices and paused leaked-password protection remain; the new index may be reported unused until normal traffic uses it.
- Customer database, production deployment and provider settings are unchanged. The implementation is for the existing isolated QA Preview candidate.
