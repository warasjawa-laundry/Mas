# Stage 6 — Manual Member Promotions (2026-10-16)

## Owner workflow

1. Sign in as owner `masjawalaundry`.
2. Open Daftar Member → select one member → **Promo Member → + Berikan Promo**.
3. Enter a free-text promotion name, optional terms, and optional expiration date. No transaction threshold or points eligibility exists.
4. The customer sees only AVAILABLE, non-expired promotions on the QR progress page. No customer login.
5. Owner explicitly marks **Tandai Digunakan** or **Batalkan Promo** (reason required). These are final status transitions, audited by the existing `laundry_log_activity` trigger.

No automatic awards, coupons, payments, visit resets, deductions, or WhatsApp sends.

## Technical implementation

- Branch `feature/stage6-manual-promotions` stacked on `feature/stage5-owner-checklist`; the previous UI edit removes the QR link-paste form, retains camera, gallery and manual member search.
- Exact applied SQL source: `supabase/migrations/20261016190000_stage6_manual_promotions.sql`.
- Private `laundry_private.grant_manual_promotion` and `laundry_private.finish_manual_promotion` are security-definer functions with empty search_path and explicit `auth.uid()` active-owner allowlist check. Public API wrappers use security invoker, authenticated execute only.
- UNIQUE request ID ensures promo grants are idempotent; conflicts with different content fail closed. Promo USE/CANCEL is an atomic AVAILABLE → final-status update, protected from repeat status changes and associated with the correct member.
- `app/admin/promotions/actions.ts` validates all input, calls Supabase RPCs using owner session, and redirects with success/error. Expiration dates entered by owner end at 23:59:59 WIB.
- `components/admin/member-promotions.tsx` shows creation, status, history, expiry and reasoned cancellation on `/admin/members/[id]`.
- Existing customer QR progress RPC only returns active available promos, independent of visit counts.
- No new secrets. Vercel Stage 6 encrypted, branch-specific preview environment inherits same verified project values, including unchanged AES-256-GCM card key from Stage 5 (for old card QR reprints). Production environment unchanged.

## Testing performed

- Supabase integration QA executed inside `BEGIN ... ROLLBACK` with a temporary QA member/card and two promotions:
  - Owner grant and repeat with same request UUID returned same promo ID.
  - Public read model displayed available promo; marking USED removed it from public available promos.
  - Owner cancellation of another promo with a required reason yielded CANCELLED.
  - Four promotion audit records emitted for create/use and create/cancel.
  - Checklist ledger row count remained unchanged.
  - Rollback ensured QA promotion and member did not persist.
- Automated `tests/stage6-contract.test.mjs` verifies owner guard, no automation, lifecycle, member UI and removal of scan link paste.
- CI `.github/workflows/stage6-promos-ci.yml` runs npm ci, unit tests, typecheck, build, and the existing protected-route/customer-layout browser checks.

## Outstanding before production

- Owner Android UAT: create a **test-only** promo for Kiki, verify the customer QR page shows it, mark it USED, verify it disappears from available promos. Confirm Kiki's transaction count does not change.
- Error and double-submission UX on a physical Android device; real owner auth positive flow is not tested in GitHub CI.
- Finalize promo-to-WhatsApp manual message drafting (future stage), voluntary opt-in consent and owner confirmation before opening WhatsApp. Never auto-send.
- Rate limiting and audit/abuse monitoring, owner account recovery, Supabase leaked-password protection advisory, physical cards' long-term QR domain, and business content approval.
- Do not merge/publish to production yet; production remains on the legacy `main` deployment.
