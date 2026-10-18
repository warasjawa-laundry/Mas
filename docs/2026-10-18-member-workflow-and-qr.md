# Member workflow and QR reliability — QA candidate, 18 October 2026

## Scope

Follow-up to the supplied mobile screenshots: gallery QR decoding, member identification after scanning, transaction entry, member promos, and directory actions. This extends the work in `2026-10-17-member-points-history.md`.

## Changes

- Both customer and owner gallery scanners use the same local decoder. It tries the full image followed by overlapping square regions at two sizes, rescales each region with a white border, and enables ZXing's harder search. This addresses small QR codes surrounded by browser chrome and page content. Photos are never uploaded. Supported-host/token checks, size limits, owner checks, and read-only scanning remain in place. Work is bounded to nine seconds plus the current decode attempt; unmount cancels further attempts and releases the image URL. Irrecoverable blur or missing QR modules still cannot be reconstructed.
- The public card page shows the member's display name above the card number. This disclosure is explicitly requested by the user: anyone holding an active card's bearer URL can see its associated display name as well as the existing limited progress. A narrowly scoped function checks card digest, revocation and member activity. No phone, private transaction description, cancellation reason, or staff identity is added. Errors omit the name without inventing a value.
- Member detail has separate Catat transaksi, Riwayat, and Promo tabs. Transaction entry shows only current-year context and a preview of points. Periksa transaksi displays the selected member, amount, description and points before Simpan transaksi. Editing retains the inputs and idempotency key. Save and edit controls are disabled while saving. Server validation and scoring are unchanged.
- Promo creation has a dedicated tab and identifies the recipient. Applying a promo requires an explicit confirmation. Pending submits prevent repeated clicks, inactive members cannot create/use promos, and the existing cancellation reason remains required. WhatsApp remains manual and consent-aware; no messages were sent.
- Directory rows show name, number/status, the primary Catat action and a Lainnya menu for QR/promo/edit. The old full-width action cascade is avoided. Search supports a name or a numeric/MJL member number; stable pagination remains bounded to 25 rows.

## Database

`20261018034442_stage17_card_member_name.sql` was applied only to QA project `tnadzytuamdxfypoeggy`. The existing rollback-only synthetic history integration test now also checks name isolation for two cards and rejection of revoked, inactive and unknown cards. It passed on QA. Production/customer database was not modified.

Supabase advisors were rechecked after DDL: no new findings attributable to this function. Existing deliberately closed card tables report RLS-without-policy information; unused indexes remain informational. The previously paused leaked-password-protection setting remains unchanged ([provider guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).

## Verification

Node regression tests cover two-stage transaction review, retained inputs/request key, inactivity, public-name output and existing privacy/failure contracts. Browser CI tests decode synthetic full phone screenshots, a long screenshot, JPEG and cropped QR, and reject a foreign host before retrying. Synthetic mobile/desktop directory/promo and public-progress screenshots cover 320, 390 and 1440 pixels with overflow checks. Real member data and bearer QR codes are excluded from artifacts. No assertion of physical Android/iOS testing is made.

The change is confined to the existing draft PR and Vercel QA Preview. Main merge and production release remain pending.
