# Stage 3 — Member Operations Checkpoint
**Status:** implementation and CI PASS, authenticated UAT PENDING. **Candidate:** `4729a62`.

## Changes
- Bounded server-side member pagination (25/page) with stable sort and preserved search query.
- One primary `Simpan Transaksi & Poin` form is visually prioritized before editing, QR, promo or historical correction actions.
- History correction wrapped in a collapsible details element without disabling any server action, idempotency, or stored ledger.
- CSS compresses transaction and point summaries for small mobile screens.

## Checklist
- [x] Existing Auth/session owner checks preserved
- [x] Search results paginated and sort deterministic
- [x] Transaction, void, promo, consent actions preserved in source
- [x] CI 6/6 PASS on `4729a62`
- [ ] Validate last page/empty search/paging on populated QA dataset
- [ ] Validate transaction saves once, points match rule, duplicate request cannot create two visits
- [ ] Validate VOID removes points but preserves immutable transaction history
- [ ] Check mobile navigation/footer overlap and form visibility on physical Android
