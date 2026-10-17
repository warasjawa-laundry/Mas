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
- [ ] Apply Stage 11 migration to **QA only**; SQL-verify privileges deny policy write and still allow point read + transaction recording.
- [ ] All CI checks pass on exact SHA.
- [ ] Redeploy protected Vercel QA Preview in Mumbai and inspect UI at mobile width.
- [ ] Separate approval before applying Stage 11 SQL or deploying to any customer/production resource.

## Operator-only yearly maintenance
Starting with 2028, a database operator must create/update the next-year rule row through reviewed SQL, before the next WIB calendar year starts. Ordinary owner/staff login cannot change or seed it. No historical transaction/point backfill.

## Identity limitation
A shared owner username/password remains an owner identity, so it is not possible to distinguish which human is using it. Closing point-policy writes protects **that specific operation**, not all owner privileges. A future staff account with separate roles is recommended if employee access expands.

No customer records, Auth credentials, domain, or production database mutated.
