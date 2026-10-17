# Stage 4 — Database-Gated Card Lifecycle & Future Points
**Status: SOURCE IMPLEMENTED / CI PASS; QA SQL AND AUTHENTICATED UAT PENDING.** `main`, live Supabase schema and data untouched.

## 4A. Replace a lost/stolen card atomically
1. Dedicated test Supabase project/schema: replay all current `supabase/migrations` before writing any production SQL.
2. New owner-only RPC uses `auth.uid()`, active `laundry_owner_accounts` allowlist, and `SECURITY DEFINER SET search_path = ''`; expose a caller-identity-preserving SQL invoker wrapper with EXECUTE only to authenticated.
3. Guard owner-submitted request UUID for idempotent retry and reject cross-member/actor reuse. Lock `laundry_members` row `FOR UPDATE` to serialize concurrent rotations.
4. Under one SQL transaction, revoke current active card with reason and actor audit, then insert fresh SHA-256 token digest and AES-256-GCM ciphertext. Existing partial unique index `laundry_one_active_card_per_member` must still enforce no more than one active card per member.
5. Never send raw token into logs, DB plaintext, query strings of private actions, or analytics; only owner-encrypted card retrieval and public `/k/[token]` remain.
6. User must deliberately confirm the old card is invalidated. No rotation from a passive QR scan.
7. Verify old card progress resolves to no member; new card resolves to same member, visits and points unchanged; concurrent duplicate requests safely return same card. Add tests for inactive member, deleted/revoked card, and owner privilege failures.
8. Add visible lost-card action and issuance confirmation only after QA test passes and with feature flag default OFF. Never run on Kiki.

## 4B. 2028+ points rules
- Preserve 2026 trial and 2027 official historical ledgers; do not silently merge or backfill or re-evaluate old awarded points.
- Add owner-only, validated, idempotent creation of a new year's five-tier rule (current year and next year only), seeded from previous-year rules with deliberate owner confirmation and revision concurrency checks.
- Existing `laundry_point_rules` accepts years 2026–2100, but `laundry_private.set_point_rules` requires a pre-existing row; the old UI/actions hard-coded 2026/2027. Stage 4 adds year initialization and dynamically generated year tabs.
- Test WIB year rollover (Dec 31–Jan 1), missing year error, concurrent edits, and ledger year isolation in a dedicated test database.

## Security and performance follow-up
- Keep RLS; Supabase Security Advisor warns leaked-password detection is disabled (separate Auth setting approval).
- Performance advisor notes 5 informational unindexed FKs; evaluate query plans with realistic QA data before modifying indexes.

## Checklist
- [x] Identified missing card reissue UI and future-year rules contract
- [x] Documented transaction/identity/locking/idempotency invariants
- [x] Verified live schema includes partial unique active-card index (read-only)
- [ ] Provision/authorize isolated QA database and apply migrations there
- [x] Implement card-rotation migration and feature-gated owner UI in source
- [ ] Run isolated PostgreSQL integration tests for card rotation
- [x] Implement dynamic year initialization and point-rule UI in source
- [ ] Test year-setup RPC in QA, including concurrent initialization and invalid years
- [ ] Receive explicit authorization before any production SQL or credential-setting change

## Implementation evidence (2026-10-17 WIB)
- Migration: `supabase/migrations/20261017090000_stage10_card_reissue_and_next_year.sql`.
- App: `app/admin/members/card/actions.ts`, `app/admin/members/[id]/card/page.tsx`, `app/admin/points/actions.ts`, `app/admin/points/rules/page.tsx`, `lib/laundry/program-years.ts`.
- Customer read model year presentation: `app/k/[token]/page.tsx`, `app/admin/members/[id]/page.tsx`.
- Regression: `tests/stage10-contract.test.mjs` — GitHub six CI suites PASS for source SHA `0798e10`.
- Full checkpoint: `docs/2026-10-17-stage4-implementation-checkpoint.md`. No QA DB has yet been created; remaining database cases must NOT be marked complete.
