# Stage 4 — Database-Gated Card Lifecycle & Future Points
**Status: DESIGN-ONLY — NOT IMPLEMENTED.** `main`, live Supabase schema and data untouched.

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
- Existing `laundry_point_rules` accepts years 2026–2100, but `laundry_private.set_point_rules` requires a pre-existing row; current UI/actions hard-code 2026/2027.
- Test WIB year rollover (Dec 31–Jan 1), missing year error, concurrent edits, and ledger year isolation in a dedicated test database.

## Security and performance follow-up
- Keep RLS; Supabase Security Advisor warns leaked-password detection is disabled (separate Auth setting approval).
- Performance advisor notes 5 informational unindexed FKs; evaluate query plans with realistic QA data before modifying indexes.

## Checklist
- [x] Identified missing card reissue UI and future-year rules contract
- [x] Documented transaction/identity/locking/idempotency invariants
- [x] Verified live schema includes partial unique active-card index (read-only)
- [ ] Provision/authorize isolated QA database and apply migrations there
- [ ] Implement/test card-rotation migration and feature-gated owner UI
- [ ] Implement/test dynamic year initialization and point-rule UI
- [ ] Receive explicit authorization before any production SQL or credential-setting change
