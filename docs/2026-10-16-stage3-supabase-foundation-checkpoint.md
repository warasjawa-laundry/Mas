# Stage 3 — Supabase Foundation Checkpoint (2026-10-16)

## Verified environment

- Connected Supabase project **warasjawa-laundry's Project**, ref `hncfyfvqtlnvqyfrydzb`, organization `warasjawa-laundry's Org`, region `ap-south-1`, PostgreSQL 17; completely separate from other users' projects.
- Six empty tables created; no actual owner Auth account provisioned and no live member data inserted.
- Migration applied and recorded in Supabase:
  - `20261016070822_mas_jawa_membership_stage3_foundation`
  - `20261016070905_mas_jawa_stage3_fk_indexes`
- This document records LIVE database changes made via the Supabase integration. **SQL migration sources are in the Supabase migration history, not yet mirrored into GitHub files**. Before CI-based rollout, retrieve and check in identical SQL migration source and verify schema drift. Do not fabricate or reconstruct migrations without matching exact applied changes.

## Tables and constraints

1. `laundry_owner_accounts`: explicit Auth UUID allowlist, with `is_active`.
2. `laundry_members`: name, sequential nonsecret membership number, optional WhatsApp E.164 with promotion consent and timestamps; actor/time.
3. `laundry_member_cards`: cryptographic QR SHA-256 digest, encrypted QR token payload for authorized reprints, revoke actor/reason/timestamp, unique active card per member. No direct browser privileges.
4. `laundry_checklist_events`: append-only ADD/VOID ledger, unique request IDs, required reason for VOID, one VOID per original ADD; same-member target enforced; trigger-written audit.
5. `laundry_member_promotions`: owner-assigned free-text title and optional terms/expiry, AVAILABLE/USED/CANCELLED lifecycle and actors, unique request IDs; no count-based auto-award.
6. `laundry_audit_events`: immutable audit entries for business mutations, no customer phone or QR token values copied into context.

All six are RLS-enabled. Anonymous users do NOT have SELECT/INSERT/UPDATE privileges on business records. Authenticated clients only have read grants for approved tables and only pass RLS if their auth user ID exists in the explicitly provisioned active owner allowlist; business write APIs will be mediated by hardened server-side routes (not by exposing a service-role key to browsers). Owner login is not implemented. Full interactive authorization testing remains pending real Auth test account provisioning.

## Advisory results after migrations

- Security advisor: one informational `rls_enabled_no_policy` on `laundry_member_cards` is intentional: no browser QR-token access. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Performance advisor: `unindexed_foreign_keys` resolved by a second migration, while `unused_index` info warnings are expected for a database with zero business rows. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index
- Counts checked: **owners=0, members=0, cards=0, checklists=0, promotions=0, audits=0**.

## Remaining Stage 3 contract and tests

- [ ] Create Supabase Auth identity for the business owner ONLY after owner explicitly supplies which email should be used to sign in; **the email used to connect the Supabase management account is NOT automatically the app login identity**.
- [ ] Manually provision owner UUID in `laundry_owner_accounts` from verified `auth.users.id`; no public self-registration or email-string-only authorization.
- [ ] Implement Next.js SSR Supabase Auth session and safe password login/logout; server must check active owner allowlist for EVERY mutation, not merely any signed-in user. Rotate sessions appropriately.
- [ ] Backend APIs for member creation with idempotent registration; secure random QR token generated on server, encrypted with key never exposed to browser, SHA-256 lookup; expiry/revocation plus reprint, safe response headers.
- [ ] Confirm key management for token encryption and safe recovery from losing the key, or revise QR reprint contract if needed.
- [ ] Build atomic server-backed checklist +1, void with required reason and promotion assignment/redeem/cancel actions. No direct unrestricted client mutations.
- [ ] Build public /k/[token] sanitized server-only read model: no browser exposure to table `laundry_member_cards`; no full name, phone, encrypted QR token or private owner audit; rate limiting, noindex, Referrer-Policy no-referrer, Cache-Control no-store.
- [ ] Verify SQL constraints under concurrent retry, invalid void target, duplicate request, double redemption, and privilege escalation; use dedicated test users without touching real customer records.
- [ ] Run RLS/security/health advisors after auth and each permission change, and keep recorded results. Include service role secret in server-only environment; never commit it.
- [ ] No automatic eligibility, no promo-triggering by checklist number, and no WhatsApp auto send.
- [ ] Reconcile/commit exact DB migration SQL and regenerate DB types before declaring Stage 3 complete.

## Release guard

Stage 3 foundation (schema) COMPLETE; authentication, policy penetration tests, secure API, login UI and live end-to-end tests PENDING. No merge, production deployment, or live card issuance. Stage 2 remains a DRAFT PR with its own owner-content approval gate.
