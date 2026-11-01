# G2 POS schema — verified QA receipt, 1 Nov 2026

## Delivered

- **17 additive tables**: outlets, staff, roles by outlet, guests, invoice counters, orders, order items/adjustments, command results, shifts, payments, cash ledger, audit events, point links, import batches/rows, legacy reconciliation.
- **17/17 RLS enabled**, **zero direct browser table privileges** for anon/authenticated, no exposed financial writes; read-only `laundry_pos_authorized_outlets()` checks active owner/staff.
- **5 immutable-journal triggers** reject direct UPDATE/DELETE for payments, cash ledger, points links, order events and command results.
- Checklist actor FK widened **only in QA** from owner accounts to `auth.users(id)`; old owner authorization code and historical records untouched.
- New outlets default inactive and write-disabled. No outlet, user, order, member or payment seeded.

## Validation

- Project: isolated QA `cwxsbgfjynwxqalwonae`, not production `hncfyfvqtlnvqyfrydzb`.
- One migration successfully applied with Supabase migration name `pos_g2_foundation_roles_orders_financial_schema`. Repo canonical filename is `20261101142000_pos_g2_foundation_roles_orders_financial_schema.sql`; avoid running the same migration twice on that QA project.
- QA rollback-only SQL regression passed: grants, RLS, legacy FK/functions, defaults, unique/check constraints, immutable triggers, empty-state checks. SQL fixture rolled back; no customer data copied.
- Security advisor INFO `rls_enabled_no_policy` occurs for intentionally restricted tables and is acceptable under deny-by-default; do not add broad permissive policies to clear the INFO. [Supabase linter reference](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- Stage 10 CI replays migrations and executes the SQL regression **once in a consolidated PR**.

## Not yet complete

- Authenticated owner/manager/cashier per-outlet RBAC integration and real owner legacy RPC regression (QA has no test users).
- Order create/payment/point award/VOID/refund/shift SQL transaction functions and concurrency; the current schema alone provides no payment posting.
- Separate production migration approval, migration/backups against full legacy dataset, physical UAT and pilot cutover. **No production DB changes; no new Vercel deployment environment; no live POS functionality enabled.**
