# Stage 4 — Member registration + physical QR card implementation contract
Date: 2026-10-16
Source: branch `feature/stage3-membership-auth-data`, current parent commit `887453330f427c3c2c2ab01a05005f73652d65ea`.
Implementation branch: `feature/stage4-member-card`.
Status: **PLAN / READ-ONLY RECONNAISSANCE**; Stage 4 code, SQL and preview NOT yet implemented.

## Product intent

This is a local laundry service with nontechnical users and a phone-first owner.

**Owner flow (max 3 operations):**
1. Owner signs in using ID and password; chooses "Tambah Member".
2. Enter member name (required, 2–100 chars), optional WhatsApp number, optional explicit consent for promo messages.
3. Confirm "Simpan & Lihat Kartu" → get a printable card featuring Mas Jawa Laundry, member name, human-readable MJL number and a QR code. Allow reprint, deactivate, and replace cards with a confirmation and history.

A card scan by an ordinary customer launches the **read-only member progress** at `/k/<opaque-token>` with no account/password/app install. A scan never logs a visit; owner-initiated "+1 Transaksi" is Stage 5. Member progress and promos are not auto-awarded based on checklist count.

**Owner interface:** 44+ px touch targets, prominent create action, simple search by member name/number/optional WA, clear empty/loading/error/success states, mobile camera-friendly, careful typography, no jargon, no AI copy, no fake rewards.

## Security contract (must be implemented before enabling card issuance)

The Supabase project already contains:
- `laundry_owner_accounts` (1 active account)
- `laundry_members` (0 rows)
- `laundry_member_cards` (0 rows; intentionally NO RLS browser SELECT policy)
- immutable checklist and audits, promotions schema.

Auth is proven from real Android flow; don't rebuild it. All server actions call `getVerifiedOwner()` and rely on RLS for reads. Preserve the existing protection of the QR table.

### Token issuance
- Generate high-entropy (>= 256 bits) random card bearer token in a trusted server runtime, not client JS or database identifiers.
- Store SHA-256 digest for lookup; ciphertext for authorized reprinting only. Use AES-256-GCM with distinct random nonce, authenticated tag, a dedicated 32-byte server-only key stored in branch-scoped Vercel encrypted env. Never expose key or raw token in logs, analytics, URLs of third parties, JSX page hydration or external image APIs.
- Issue member and card **atomically** inside one controlled transaction. Anonymous and ordinary authenticated clients have no direct write grants. Owner identity must be checked in DB for every privileged operation; validate data at both action and SQL layer, including anti-duplication, idempotency on network retries.
- Prefer a tightly scoped *private-schema* `SECURITY DEFINER` routine with empty `search_path`, explicit owner check, and a narrow `SECURITY INVOKER` exposed RPC wrapper to avoid publicly exposed definer lint. Include privilege-negative tests. Keep secret QR table non-readable directly.
- Reprints decrypt authorized active cards server-side; revoking a card invalidates its token immediately, and card replacement requires owner confirmation.
- WhatsApp number is optional; normalize Indonesian `08...` to `+62...` with explicit validation; do not send promotional messages automatically. Track manual opt-in consent explicitly.

### Public QR landing
- A member card must NOT be physically issued to real customers before `/k/[token]` exists, resolves only by digest, and shows sanitized read-only progress. No surname/phone/owner audit or raw digest in HTML, and no API allowing outsiders to enumerate member numbers.
- Prevent token exfiltration: `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `robots: noindex,nofollow`; don't embed third-party trackers or externally generated QR images.
- A photographed card is a bearer credential; explain this tradeoff and support revoke/reissue. Add abuse/rate limiting before production.
- Scanning does not modify visits, no checklists automatically.

## Printing contract
- Member card aspect is CR80 (85.60 mm × 53.98 mm), high contrast black-and-white QR with quiet zone and sufficient optical size. Business name prominent, member number shown as `MJL-000001` and name.
- Provide print layout for A4 cutout and single-card output, `@media print` hides controls, no clipped QR, honors practical printer scaling/margins.
- Use locally generated QR pixels/SVG from trusted server; do not send full URL token to third-party QR service.
- Android print dialog validated against real device before release.

## Implementation sequence and gates
1. Verify current Stage 3 source and permissions; branch from Stage 3, do not touch `main`.
2. Check in exact new SQL migration file and atomically apply only after review. Run DB advisors. Do not reconstruct or overwrite applied Stage 3 migration history.
3. Add owner-only member listing, searchable create flow, detail and printable card UI with no fake functionality. All form actions server-validated.
4. Wire server cryptographic issuance and reprint, then public token read-only page BEFORE letting cards print.
5. Automated negative tests: anon and nonowner cannot create/read; owner only; invalid/duplicate inputs; revocation; repeated submits; malicious URL; no token leakage; card issuance and rollback atomic; zero countdown/threshold-based awards.
6. Playwright Chromium 320/360/390/768/1440 plus actual physical Android camera and printer checks. Price/business copy remains subject to business owner review.
7. PR stays DRAFT, stacked on Stage 3. Keep deployment Preview branch-only and secrets branch-only; no merge/release until tested.

## Out of scope
- Scanner, +1 checklist event or automatic visit tracking (Stage 5).
- Promo awarding and WhatsApp message dispatch (later stages).
- Real POS, payments, orders, automatic discount eligibility.

## Current checkpoint
Only this Stage 4 design contract has been committed. No registration, QR, scanner, or card public API exists yet. Do not tell owner Stage 4 is finished until acceptance checks are verified.
