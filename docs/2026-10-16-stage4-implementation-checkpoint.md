# Stage 4 checkpoint — owner registration + QR (16 October 2026)
Status: **IMPLEMENTED IN PREVIEW / AUTOMATED QA PASSED / OWNER UAT PENDING**

## Implementation
- `/admin/scan` now acts as mobile owner hub with prominent **Buka Daftar Member**.
- `/admin/members`: protected owner-only list, search and add-member CTA (newest 100).
- `/admin/members/new`: required name, optional WhatsApp (08.. normalized to +62..), explicit promo consent checkbox, server request idempotency key. If a submission receives a retriable error, the key is preserved.
- `/admin/members/[id]/card`: owner-only reprint using AES-256-GCM encrypted card material, server-generated QR, physical CR80 dimensions 85.6×53.98mm and A4 print stylesheet. TEST PREVIEW printed on the actual card. **Do not hand out preview cards.**
- `/k/[token]`: anonymous, read-only QR landing with member number, effective checklist count and manually assigned available promos; no full customer name, phone, owner audit or card secret material. The raw opaque URL token is necessarily present in the customer's QR/URL; no third-party QR generation.
- Database private-schema security-definer routines plus public security-invoker wrappers. Explicit `auth.uid()` active-owner allowlist check for registration and card material; public read uses digest of a random 256-bit token only. Unique registration request ID prevents duplicate cards. No anonymous table read.
- Crypto key `LAUNDRY_CARD_ENCRYPTION_KEY` is a 32-byte base64 secret in **Vercel encrypted Preview environment**, scoped exclusively to `feature/stage4-member-card`. Preserve this key for reprints; do not rotate without migrating or reissuing cards.
- One-time GitHub Actions lockfile bootstrap was removed after pinning `qrcode@1.5.4`, `@types/qrcode@1.5.6` and committing lockfile.
- Stage 5 scanner/visit increment remains disabled. No promo automation, WA sending, card issuance on production.

## Database and tests
- Applied SQL source in repository: `supabase/migrations/20261016150000_stage4_members_and_cards.sql`. Applied migration ref: `20261016080931_stage4_members_and_cards`; use Supabase migration history ID as authoritative (GitHub filename is source version).
- A rollback-only SQL test established owner JWT can atomically create member+card, matching anonymous progress lookup, same registration request ID returns same member (idempotent), and anon can see a valid high-entropy card via public RPC. A fake nonowner Auth UUID was rejected by the function. Test was wrapped in `BEGIN...ROLLBACK`; subsequent query confirmed 0 members/0 cards/0 audits.
- Stage 4 GitHub Actions CI [run 38872216392](https://github.com/warasjawa-laundry/Mas/actions/runs/38872216392): SUCCESS, npm ci, unit contracts, TS, build and Playwright. Stage 3 and Stage 2 regressions on same commit SUCCESS.
- Later commits improve owner hub and retry; latest branch CI must be rechecked before declaring final technical acceptance.
- Supabase advisor still has the existing intentionally policy-less QR table INFO and existing **Leaked Password Protection Disabled** WARN. https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Branch Preview 5 encrypted environment keys: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, OWNER_LOGIN_ID, OWNER_AUTH_EMAIL, LAUNDRY_CARD_ENCRYPTION_KEY.

## Remaining gates before release
- [ ] User to verify Stage 4 on actual Android with owner session and a knowingly fake QA-only member. An actual user-driven POST/login with real account credentials has NOT been tested by automation (secret not available).
- [ ] QR scan preview can be blocked by Vercel deployment authentication. **Do not print or distribute preview cards**. Public URL and domain launch sequencing must be validated before real issuance.
- [ ] Implement owner cancellation/reissue UX before distributing cards, and read-only customer expired/revoked states.
- [ ] Rate limiting of QR lookup and member creations, password protection, owner recovery, production configuration/rollback, and operational secret key backups.
- [ ] Manual visual QA of 320px Android, printed paper/laminate physical dimensions and QR scan.
- [ ] Stage 2 business owner approval for pricing, contact, images and copy still pending. Stage 4 branch remains a stacked Draft PR; no main merge, no live production deployment.

**Do not label Stage 4 production-ready.** Current member data intentionally empty; Stage 4 backend is connected only to the shared Supabase project and feature branch preview UI.
