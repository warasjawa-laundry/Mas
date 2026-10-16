# Stage 8 — Member Contact & WhatsApp Consent Management

**Branch:** `integration/mas-jawa-laundry` · **Draft release PR:** #8 · **Production:** unchanged.

## Owner workflow
- Daftar Member → **Ubah Data**, atau halaman detail member → **Ubah Data & WhatsApp**.
- Edit nama, nomor WhatsApp opsional (format 08…, 628…, atau +62…).
- Pilih tindakan izin promo: **Pertahankan** (default), **Aktifkan setelah persetujuan pelanggan**, atau **Cabut izin**.
- Mengaktifkan izin membutuhkan nomor valid **dan konfirmasi terpisah** bahwa pelanggan sudah memberi izin. Tidak ada consent otomatis.
- Mengubah nomor dengan opsi Pertahankan selalu menonaktifkan izin sebelumnya. Menekan Aktifkan dengan bukti persetujuan yang dicatat owner menerbitkan persetujuan baru.
- Perubahan tidak membuat member baru dan tidak mengubah QR token, member number, checklist, maupun promo tersimpan.
- Jika nomor/izin tidak tersedia, composer WhatsApp menyediakan tautan langsung ke halaman edit; pesan WhatsApp tetap hanya draf manual.

## Security and implementation
- Database migration: `supabase/migrations/20261016210000_stage8_member_contact_management.sql` applied to the existing Supabase project.
- `public.laundry_update_member_contact` exposes a **SECURITY INVOKER** wrapper. Private `laundry_private.update_member_contact` has **SECURITY DEFINER** with empty search path and explicit active-owner check `auth.uid()`.
- Raw `laundry_members` UPDATE is not granted to authenticated; public RPC EXECUTE is granted to authenticated, **not anon**.
- New `member_edit_revision` is a monotonic optimistic-concurrency value. A stale edit is rejected rather than silently overwriting another device.
- Unique request UUID stored in `laundry_member_contact_events` makes retries idempotent; events record actor, time, and boolean name/phone/consent changes. No historical phone number or member name stored in this new audit history.
- `laundry_member_contact_events` RLS SELECT is owner-only; no client-side INSERT/UPDATE/DELETE grants. Existing generic member-update audit continues as before.
- `whatsapp_consent_at` is cleared on revocation or implicit revocation from phone replacement and set on explicit customer-confirmed opt-in.
- The owner checkbox attests to permission; this is **not** independent verification of customer consent.

## QA
- `tests/stage8-contract.test.mjs` checks RPC safety, optimistic revision/idempotency, UI consent gating, audit privacy and preserved QR/checklist paths.
- `tests/stage8.ui.spec.ts` tests that unauthenticated access redirects to login. Integrated with the same GitHub CI workflow that runs Stage 2–7 gates.
- SQL rollback-only temporary member QA: owner grant after confirmation succeeds, missing confirmation fails, retry with same UUID does not duplicate, and phone replacement revokes prior consent. No temporary member persisted.
- A previously overbroad SQL QA query failed when attempting to read the private card table as `authenticated`; access denial was expected, and subsequent SQL QA used permitted owner APIs.

## Remaining release gates
1. Owner Android UAT: update test member phone/consent, reopen promo and check WhatsApp enabled/disabled. **Do not edit live Kiki data merely for QA unless owner explicitly wants to test it.**
2. Test stale-form edits from two tabs, repeated submission, and revocation while viewing an older tab.
3. Security: owner account recovery and leaked-password protection, rate limiting, QR revoke/reissue and durable printed-domain policy.
4. Real CR80 print tests and owner-approved homepage service/pricing/photos.
5. Explicit final merge/promotion approval; Draft PR #8 stays unmerged.

Stage 8 implements member/contact management now. The security and launch readiness work remains tracked separately and is **not** yet certified as production-ready.
