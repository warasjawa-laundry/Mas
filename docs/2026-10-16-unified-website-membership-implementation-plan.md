## Checkpoint aktual — 2026-10-16 (WIB), branch-only

**Stage 0:** audit baseline SOURCE CODE dan inventaris file/aset/konten SELESAI. Tidak boleh disebut FULL PASS: halaman live tidak bisa diperiksa dari lingkungan audit; screenshot/Lighthouse real, status DNS/hosting aktif, konfirmasi tarif/klaim/foto/testimonial, dan printer fisik masih PENDING. Lihat `docs/2026-10-16-stage0-baseline-audit.md`.

**Stage 1:** design direction, token, wireflow, pesan/error/loading dan prototype review HTML dibuat. Prototype hanya simulasi statis (tidak ada kamera, akun owner, database, QR aktif, cetak final, pengiriman WA). Pemeriksaan struktur sumber dan ID DOM dilakukan; belum ada browser visual QA atau persetujuan owner. Lihat `docs/2026-10-16-stage1-design-system-ux-blueprint.md` dan `prototypes/mas-jawa-ux-review.html`.

**Stage 2–8:** BELUM DIMULAI. Tidak ada refactor aplikasi, migrasi, PR merge, ataupun deployment. Main dan domain produksi harus tetap tidak berubah.

**Kriteria sebelum lanjut implementasi Stage 2:** review prototype bersama pemilik usaha di Android serta desktop; cocokkan semua foto/logo/harga/garansi/program tas dengan kenyataan; verifikasi domain/hosting dan cara rollback; lakukan visual QA yang benar. Jangan menganggap prototype statis sebagai fitur selesai.

---

# Mas Jawa Laundry — Unified Website + Membership Implementation Plan

Date: 2026-10-16 (WIB)
Status: PLANNED / documentation only. No implementation, main merge, deployment or database provisioning.
Source of requirements: docs/2026-10-16-unified-website-membership-uiux-spec.md
Production: https://masjawalaundry.web.id/ — preserve until gated cutover.
Target: ONE repository and domain, independent visitor checklist product (no POS).

## Policy / safe execution

- Branch-only work; never directly deploy planning branch to production. Main unaffected until approved and acceptance gates pass.
- Stages have explicit dependencies, artifacts and exit criteria. Prefer separate PR(s) during build; do not merge without review.
- Keep current domain and public pages working through migration; snapshot/rollback plan is mandatory before DNS or hosting changes.
- Design first and validate with nontechnical owner, then implement. Not all design details are currently visually QA'd.
- Do not accidentally expose admin access, full member data or QR tokens publicly.
- Real-time is a UI convenience; authoritative state is transactional PostgreSQL.

## Stage 0 — Baseline, inventory, decisions

Tasks:
1. Record exact main SHA, current hosting, DNS, redirects, SSL, canonical/sitemap and public asset URLs. Capture mobile/desktop screenshots, lighthouse baseline, accessibility quick audit.
2. Snapshot working public content, including current service names/prices, testimonials, business claims, contact, WhatsApp, SEO/schema and exclusive-bag program; ask owner to confirm factual content and consent to reuse imagery/reviews.
3. Inventory device/printer(s) and trial print options; confirm whether contacts consent to promotional WhatsApp, whether old stamps must be imported, and how owner wants lost-card reissue handled.
4. Prepare test account, test phone(s), printer, staging domain, secrets separation, preview hosting and rollback.
Exit: checked content inventory + accepted MVP scope + reproducible baseline + staging strategy documented. No production change.

## Stage 1 — Architecture, design system, visual approval

Tasks:
1. Choose exact Next.js supported stable version, TypeScript, Tailwind build-time compiler (remove CDN), component and QR libraries after version/maintenance review; document ADR.
2. Prepare shared tokens (logo, restrained purple #9333ea, blue #2563eb, accessible surfaces), typography, spacing, large buttons, focus, errors, responsive components, print stylesheet.
3. Low/high fidelity flows for /, /membership, /admin/login, /admin/scan, /admin/members, /admin/members/[id], /admin/promos, /k/[token].
4. Review all screens with real owner; especially phone scanner, one-visit confirmation, member form and card print.
Exit: visual approval for desktop/mobile plus acceptance matrix; accessibility and mobile controls reviewed.

## Stage 2 — Public homepage redesign and SEO continuity

Tasks:
1. Implement public page sections in approved hierarchy using owner-approved real content and honest wording.
2. Reduce GSAP/Lenis reliance; no hidden-by-default body; prefers-reduced-motion; semantic HTML and keyboard navigation; no scroll hijack.
3. Verify page speed and assets (responsive size, compression, dimensions, caching); make WhatsApp, menu, links and map accessible.
4. Preserve canonical, OG, verified NAP, schema and sitemap; ensure existing anchors work via retained IDs/scroll targets; appropriate redirects when exact path changes.
5. Regression screenshots on 320/360/390/768/1024/1440, keyboard and 200%-zoom tests.
Exit: public homepage is functional and search-visible on preview with no broken links; old root behavior preserved.

## Stage 3 — Data model, auth, permissions, migrations

Proposed relations:
- owner_accounts: identity in Supabase Auth; privileged roles via trusted server-maintained table/claims, not client claims.
- members(id uuid PK, member_number unique, display_name, whatsapp_e164 nullable, consent_promo_whatsapp flag & timestamp, active, created_at).
- member_cards(id, member_id FK, token_hash unique, active, issued_at, revoked_at, reissued_from). Never store plaintext public token in DB/log if avoidable; on create return token to card generation once and securely handle reprint workflow (e.g., encrypted token with controlled owner-only retrieval or intentionally rotate on reprint), document choice.
- checklist_events(id, member_id FK, event_type ADD/REVERSAL, reverses_event_id nullable, request_id unique per owner action, actor_id FK, occurred_at, reason nullable, created_at). Append-only audit.
- promotions(id, member_id FK, title, description, expires_at nullable, state AVAILABLE/USED/CANCELLED/EXPIRED, created_by, created_at, redeemed_at nullable, request_id unique).
- audit_events(id, actor_id, action, entity_id, timestamp, metadata redacted).
- separate restricted public view/RPC producing only masked display name, count, limited visit dates and manually awarded promo labels/statuses. Never expose WhatsApp/owner notes/raw token.

Transactions:
- Owner +1 only after role authorization and active card identity validation, DB transaction, unique request_id (idempotency).
- Reversal is an explicit authorized event referencing an ADD event, with mandatory reason, at most one reversal per event (DB constraint); cumulative = count(ADD) - count(REVERSAL).
- Promo creation/redemption atomic with audit; no change to checklist count.
- Public bearer QR token must be cryptographically random, unguessable, independently revocable, high entropy >=128 bits; resolve via server hash lookup/rate limits, strict token isolation.

Security:
- RLS deny-by-default for all base tables; owner can access authorized management operations; public route served by restricted server-side API with validated active token and strict selection. Never expose Supabase service-role key to browser.
- No self-service owner registration; account provisioning controlled; login rate limit, password reset, safe sessions, CSRF/origin and abuse considerations, optional 2FA later.
- Token public link noindex, Cache-Control:no-store, restrictive Referrer-Policy, safe analytics that strip token URL, no token in logs/WA text, provide lost card revoke+rotate.
- Write abuse tests, SQL RLS integration tests with anonymous/member-token/owner contexts, row-isolation and ID enumeration tests.
Exit: migration and access control tests pass on staging database; backups and rollback tested.

## Stage 4 — Owner create / edit member and print

- Registration screen requires only name; WhatsApp optional with normalized Indonesian format and opt-in consent record.
- Duplicate suggestions without auto-merge; member_number generated atomically; membership itself not gated by smartphone.
- QR resolves view-only progress when scanned normally; owner scanner recognizes same code only in authenticated privileged UI.
- PDF print one-up CR80 85.60x53.98mm and A4 batch layout; proof QR readable from paper/laminated/PVC; safe margins, quiet zone and legible logo/ID.
- Reprint (no forced token rotation) vs lost-card reissue (revoke/rotate preserving count); old card must stop resolving.
Exit: one real Android phone can read printed card under normal shop lighting, browser print within size tolerance; no direct API leak.

## Stage 5 — Android phone QR scan and checklist workflow

- HTTPS camera permission on explicit tap; prefer rear camera, gracefully degrade; code does not open device camera on page load without user action.
- Scanner detection pauses upon first valid token; show safe owner-only name/ID/count; large button "Catat 1 Transaksi" (NOT a scanning side effect).
- Atomic idempotent write keyed to action id, duplicate taps/retries safe; retries after uncertain network check server before proceeding.
- Same customer may have two legitimate transactions in a day with new explicit action; optional warning if rapid repeat, no silent block.
- Success displays stored count, timestamp and resets scanner; deny, offline, invalid/revoked, camera failure, permission denied and stale token states accessible.
- Fallback authorized name/ID search and confirmation (not a guest route).
Exit: physical field acceptance on low-end Android; duplicate-scan, request retry, intermittent connection tests pass.

## Stage 6 — Public member progress and scoped live refresh

- One lightweight read-only view; optional masked alias/member number, total VALID checklist count in large type, small last-visit list, manually awarded promo state.
- No login, password, OTP, account setup, or public directory; token is shared secret, must be kept safe.
- Real-time strategy must not publish member PII or all rows to anonymous subscribers; use strictly isolated projection/subscription or safe periodic refresh instead if cost/access model cannot safely scope channels.
- Clear offline stale state and manual refresh; server/cache headers secure; errors for revoked token, no activity, and unassigned promos.
Exit: no access to another member via changing URL/IDs or other channels; updates visible reliably; no sensitive leakage.

## Stage 7 — Manual promotions and WhatsApp copy/open

- Owner choose member, see count and history without auto-eligibility; free text promo title (required), rules/details, optional expiry.
- Server-side create and audited state transitions AVAILABLE -> USED/CANCELLED/EXPIRED as applicable; protect double redemption and concurrent updates.
- Post-save preview of Indonesian WA message generated from stored promo and current count. Copy works without external API; wa.me deep link only when number valid and contact opted in. Explicit user click sends nothing; does not claim delivered.
- For audit, optional owner-maintained "sudah diberitahu" timestamp is separate from delivery receipts.
- Public member view displays awarded promo status; count remains unchanged.
Exit: full manual reward lifecycle demonstrated end to end, no claims of automatic qualification, no auto-messaging.

## Stage 8 — Release certification and rollout

CI proposal:
- lint, types, unit tests, API contract tests, SQL migrations + RLS tests, integration/E2E mobile viewport, print PDF snapshot/QR decoding, accessibility checks and no secret scanning.
- Security checks: unauthorized writes, guessing/expired QR, revoked-card behavior, replay/duplicate checklist, promotional double-redeem, public QR URL leakage via referrer/analytics, consent/PII.
- Manual Android matrix: at least low-end Android Chrome + second device; poor light, slow network, camera denied; different paper and print outputs; read-only member page and screenshot verification.
- Re-test verified SEO, redirect, OG, schema, contact and pricing.
- Set up staging database separate from production, review migrations and secret rotation, backup/restore, monitoring with no leaked token, audit retention policy, recoverable print reissue.
- Deployment plan: snapshot production, preview approval, one controlled cutover, smoke check homepage/admin/card flows, rollback deployment if critical failures. DO NOT change DNS before plan approved.

Exit: owner UAT signed off; no critical defects; staging/production parity; recovery tested; cutover separately authorized.

## Acceptance scenarios

A. Owner creates "Siti Aminah" with no WhatsApp -> receives unique ID -> prints A4/card -> printed QR opens read-only page with count 0; no credentials required for member.
B. Owner scans card in authenticated phone UI -> preview identity -> confirm once -> count becomes 1. Repeated scan/rapid double tap does not record second visit.
C. Owner scans later for a second legitimate transaction -> explicit confirm -> count increments to 2, event history auditable.
D. Owner creates arbitrary free-text "Gratis cuci 2 kg" for member regardless of count -> promo visible in member page; WA text can be copied; no automatic message sent; promo redeemed with owner action, checklist stays 2.
E. Another anonymous card token cannot access private Siti data or any privileged endpoint; revoked/rotated card stops resolving.
F. Safari/Chrome fallback for camera issue shows manual owner search; unavailable network never produces fake success.
G. Homepage real contacts, canonical, original verified content, legacy navigation anchors and mobile responsiveness remain valid.

## Done / not done

Current delivery goal: write planning documents on a branch only. Feature implementation is NOT part of this checkpoint.
Next implementation work begins at Stage 0 and visual sign-off, never directly on production main.
