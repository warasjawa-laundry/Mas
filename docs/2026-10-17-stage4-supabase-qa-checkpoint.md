# Mas Jawa Laundry — Supabase QA Database Certification Checkpoint

**Date:** 2026-10-17 WIB  
**Project:** `mas-jawa-laundry-qa` — `tnadzytuamdxfypoeggy`  
**Organization:** `warasjawa-laundry's Org` (`irwtmqbaqcnbxuuyamvk`)  
**Region:** Mumbai `ap-south-1`; status `ACTIVE_HEALTHY`  
**Quoted project creation cost:** US$0/month; further usage subject to provider plan.  
**Customer Supabase project (READ-ONLY for schema provenance):** `hncfyfvqtlnvqyfrydzb`.

## Stage-by-stage checklist

- [x] User authorized QA project in the named organization/region.
- [x] Created distinct QA project with no customer accounts or records.
- [x] Recovered **exact** original Stage 3 SQL from `supabase_migrations.schema_migrations.statements` in production, committed identical DDL text to this feature branch. No data, emails, keys or login credentials cloned.
- [x] Applied eight of eight migrations to QA (from original Stage 3 foundation through new Stage 10).
- [x] QA integration script 1 PASS: atomic reissue, old QR rejected, new QR allowed, one-active-card invariant, same-request idempotency, cross-actor/reason conflicts, anonymous denial; new point year based on prior year, repeated setup harmless, invalid future year blocked.
- [x] QA integration script 2 PASS: impersonated PostgreSQL roles `authenticated` and `anon`; correct owner is allowed, anon denied and audit SELECT forbidden.
- [x] Explicit ROLLBACK verified: QA `auth.users=0`, `laundry_owner_accounts=0`, `laundry_members=0`, `laundry_member_cards=0`, `laundry_card_reissues=0`, `laundry_audit_events=0`.
- [x] Seeded **only** 2026 and 2027 initial point rules (five tiers, revision 1), as migrations require.
- [x] All **ten** `laundry_*` tables have RLS enabled. `anon` cannot execute `laundry_reissue_card` or `laundry_initialize_point_year`, and authenticated users cannot directly SELECT/INSERT into the reissue audit journal.
- [x] Supabase QA security advisor: 2 informational `rls_enabled_no_policy` notes (card token table and reissue audit, intentionally private); performance advisor: 7 informational unindexed foreign keys and 9 unused-index notices with near-empty QA tables.
- [x] True two-connection concurrent rotation and year initialization verified against ephemeral PostgreSQL 17 in GitHub Actions, replaying all 8 source migrations. Same request UUID yields one replacement; concurrent year initialization yields one insert and one no-op.
- [ ] Further contention tests for different request IDs and concurrent rule revision edits.
- [ ] Full authenticated browser E2E with **QA-only** Auth user and Preview env isolated from customer DB.
- [ ] Real QR camera/gallery scan and measured mobile/desktop latency.
- [ ] Separate approval for live schema migration, enabling feature flags and promotion.

## Migration provenance and outcome

| Order | Filename / name | QA |
|---|---|---|
| 1 | `20261016070822_mas_jawa_membership_stage3_foundation.sql` | PASS |
| 2 | `20261016070905_mas_jawa_stage3_fk_indexes.sql` | PASS |
| 3 | `20261016150000_stage4_members_and_cards.sql` | PASS |
| 4 | `20261016180000_stage5_owner_checklist.sql` | PASS |
| 5 | `20261016190000_stage6_manual_promotions.sql` | PASS |
| 6 | `20261016210000_stage8_member_contact_management.sql` | PASS |
| 7 | `20261016230000_stage9_amount_points.sql` | PASS |
| 8 | `20261017090000_stage10_card_reissue_and_next_year.sql` | PASS |

The Supabase service assigned its own execution timestamps/versions to QA migrations; names/source and ordering were preserved.

## Reproducible test scripts

- `supabase/tests/20261017_stage10_sql_integration_rollback.sql`
- `supabase/tests/20261017_stage10_role_isolation_rollback.sql`

Both tests use synthetic UUIDs and `BEGIN; ... ROLLBACK;`, with no production credentials, customer data or persistent QA login accounts. SQL tests do **not** replace browser or real multi-session load tests.

## Boundaries and next work

`PR #11` remains OPEN; `main` remains `50d9bd9`. The existing manually created protected Vercel Preview (Mumbai) is **pre-Stage-4** and still uses its original environment. **No Stage 10 SQL was applied to customer Supabase.** No feature flag activated, Netlify or live domain changed.

Next gate: isolated QA Preview and synthetic Auth credentials via supported admin/secret management, then authenticated browser end-to-end tests. Database concurrency is now proven independently in CI. Do not reuse, copy, or expose the customer's owner login/password or QR encryption material.

## 2026-10-17 concurrency follow-up and cleanup
- [x] Gate `Stage 10 PostgreSQL Concurrency QA` PASS on code SHA `6195757`; CI run `39004521560`; all seven workflows PASS.
- [x] Fixture cleanup after Supabase QA sequential API tests: `auth.users=0`, owners `0`, members `0`, cards `0`, reissues `0`, audit `0`. Retained only default rules for 2026/2027. Cleanup guarded by exact counts and synthetic record labels.
- [x] Fixed QA card origin for exact Vercel feature-branch alias and added regression test. No new QA deployment.
- [ ] Browser Auth UAT remains blocked on QA-only Vercel environment and supported QA Auth user provisioning. Existing `mas` Vercel project is **not** Git linked; branch-scoped env change was rejected by provider; global Preview variables were not touched.
