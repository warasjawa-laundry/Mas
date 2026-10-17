# Stage 11 — Database-owned Point Policy, No Staff Editing

Date: 2026-10-17 (WIB)  
Scope: PR #12 / existing isolated QA Preview. Production unchanged.

## User request
Remove “Atur nominal & poin” from member transaction screen, and all “Atur Poin” editing navigation. The five rule thresholds and point amounts remain in PostgreSQL to avoid casual changes when employees have access to the operating login.

## Implementation checklist
- [x] Remove member-detail edit link; preserve balances, amount form and point estimate.
- [x] Remove point-policy link from admin sidebar and dashboard quick actions.
- [x] Return HTTP 404 for the old `/admin/points/rules` URL, including when logged in.
- [x] Remove both `savePointRules` and `initializePointYear` server actions; `recordAmountVisit` stays intact.
- [x] New Stage 11 SQL migration revokes EXECUTE for both public and private policy mutation RPCs from `PUBLIC`, `anon`, `authenticated`, and `service_role`; explicitly revoke policy table INSERT/UPDATE/DELETE/TRUNCATE. No existing tiers or transactions are changed.
- [x] Add tests for UI, server actions, SQL revokes and preserved transaction/point read path.
- [x] Applied Stage 11 migration to **QA only**; read-only SQL and executable QA regression confirm policy writes denied for anon/authenticated/service_role, while authenticated rule SELECT and transaction RPC still allowed. 2026/2027 rules preserved.
- [x] All **7/7 GitHub CI workflows PASS** for exact code SHA `18a2441a27790100aa2a306604be33cc8a3b72fe`, including Stage 10/11 PostgreSQL CI and browser tests.
- [x] Deployed protected **Vercel QA Preview READY** in Mumbai (`bom1`), deployment `dpl_AJE5PpTScpG83N8UNX4yU8fUJ1Wc`; QA stable alias points to deployed code SHA. Main Preview alias unchanged.
- [ ] User visual UAT at mobile width: confirm link removed and transaction/point estimate layout unaffected.
- [ ] Separate approval before applying Stage 11 SQL or deploying to any customer/production resource.

## Operator-only yearly maintenance
Starting with 2028, a database operator must create/update the next-year rule row through reviewed SQL, before the next WIB calendar year starts. Ordinary owner/staff login cannot change or seed it. No historical transaction/point backfill.

## Identity limitation
A shared owner username/password remains an owner identity, so it is not possible to distinguish which human is using it. Closing point-policy writes protects **that specific operation**, not all owner privileges. A future staff account with separate roles is recommended if employee access expands.

No customer records, Auth credentials, domain, or production database mutated.

## Gate evidence and scope (2026-10-17)
- [x] SQL policy-regression script `supabase/tests/stage11-point-policy-privileges.sql` reports **PASS** on isolated Supabase QA `tnadzytuamdxfypoeggy`.
- [x] Original 2026/2027 rule rows remain intact; `authenticated` can SELECT `laundry_point_rules` and execute `laundry_record_amount_visit`.
- [x] PostgreSQL CI bootstrap now includes Supabase-compatible `service_role` (only ephemeral CI database); Playwright confirms old editor route HTTP 404.
- [x] CI 7/7 PASS on `18a2441`; Vercel QA Preview READY (`dpl_AJE5PpTScpG83N8UNX4yU8fUJ1Wc`, Mumbai, SHA `18a2441`).
- [x] Verified QA stable alias moved to this deployment; Preview `main` remains at `dpl_3qF3NBniMjH9ka1LCY9jAFuJyM2z`.
- [ ] Screenshot/manual owner UAT of member page after mobile refresh; CI tests are not equivalent to logged-in QA browser testing.
- [ ] **Production migration NOT applied**. For any customer environment, hiding the UI alone does not revoke previously granted DB permissions. Execute Stage 11 SQL only after independent release approval. Existing point scoring remains unchanged.
