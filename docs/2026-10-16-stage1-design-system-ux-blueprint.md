# Stage 1 — Design System & UX Flow Blueprint (Mas Jawa Laundry)
Tanggal: 2026-10-16 (WIB)
Status: DESIGN DIRECTION DRAFT — BUTUH REVIEW VISUAL OWNER, BELUM CODE PRODUCTION
Berdasarkan source `index.html`, `style.css`, dan kebutuhan nyata laundry. Baca juga `2026-10-16-stage0-baseline-audit.md`.

## 1. Arah visual — "Kasir Tenang, Bisnis Terpercaya"
Bukan dashboard SaaS generik. Dua dunia yang terhubung oleh identitas brand:
- **Publik:** editorial-local-business: putih hangat, tipografi hitam/biru gelap, satu aksen ungu identitas MJL, foto laundry asli sebagai bukti fasilitas. Fokus harga, lokasi, WhatsApp, kartu member. Tidak menggunakan kalimat bombastis ("Level Up", "Laundry Premium Terbaik") tanpa pembuktian.
- **Owner:** utility-first: putih, aksen ungu yang sama, navigasi ringkas; scanner mengisi perhatian utama; tombol kerja nyata lebih menonjol daripada statistik. Admin harus bisa digunakan seseorang yang tidak memahami istilah teknis.
- **Member:** single-purpose receipt/progress page: angka kunjungan dominan; daftar singkat tanggal; promo yang benar-benar diberikan owner. Tidak ada dashboard bento, grafis award/rank, animasi, progress menuju hadiah atau login.

Tidak menggunakan stock photo/AI-generic illustration sebagai bukti bisnis. Logo dan foto dari repo `Web-asset` harus diperiksa aktual dahulu sebelum ditentukan framing/cropping. Bila belum bisa dipastikan, desain tetap kuat menggunakan tipografi dan warna; *jangan membuat foto laundry palsu*.

## 2. Token design — proposal awal, uji contrast sebelum freeze
```css
:root {
  --mjl-brand: #6D28D9;           /* ungu lebih dalam untuk tombol; turunan brand lama #9333EA */
  --mjl-brand-hover: #5B21B6;
  --mjl-brand-tint: #F3E8FF;
  --mjl-ink: #172235;
  --mjl-muted: #556274;
  --mjl-paper: #FFFFFF;
  --mjl-canvas: #F8FAFC;
  --mjl-line: #E3E8EF;
  --mjl-success: #176B45;
  --mjl-warning: #8A4B10;
  --mjl-danger: #B42318;
  --radius-control: 12px;
  --radius-card: 18px;
  --touch-min: 44px;
  --content-width: 1160px;
}
```
Existing legacy brand accents blue `#2563EB` and orange `#F97316` may be used sparingly where meaningful, not simultaneously on every element.
- Type: Outfit (existing identity) OR system UI if loading slow; weights 400/500/600/700 only. Avoid extreme tightly tracked all-caps.
- Text: 16px body, 14px helper, 20–24px section mobile, 32–44px hero, and 40–56px count on member card. Line-height body 1.5–1.65.
- Spacing: 4/8/12/16/24/32/48/64 px. Mobile screen gutter 16px, desktop 24–40px. Owner buttons ≥48px high.
- Color not sole signal: check icon and explicit success message; errors include recovery action.
- Focus rings 2px, 2px offset; keyboard focus visible, no hover-only info.
- Reduce motion: default transitions ≤180ms (opacity, color); `prefers-reduced-motion` disables nonessential animation/parallax.
- Breakpoints verification 320, 360, 390, 768, 1024, 1440; test 200% browser zoom; sticky UI avoids Android keyboard and safe-area overlap.

## 3. Homepage information hierarchy

**Above fold mobile**: compact logo+menu; direct headline "Laundry kiloan & satuan di Kandang Jati Kulon"; brief explanatory line; prominent "Hubungi WhatsApp"; secondary "Lihat Harga"; one real photo or photo slot with known provenance. Avoid giant full-screen hero that hides prices.
**Below**:
1. Daftar Harga (based on existing repo but marked pending owner verification). Group Reguler / Express / Kilat with duration, price per kg; then satuan/gorden.
2. Tentang Layanan / Kenapa MJL (only business-confirmed promises).
3. Kartu Member: short explanation "Daftar di kasir, bawa kartu, lihat jumlah transaksi dengan scan QR"; emphasize promo hanya dari pemilik, bukan poin otomatis. Existing promo tas displayed separately only if confirmed still active.
4. Dokumentasi asli (2–3 photos and descriptive alt text) — no invented testimonials.
5. Lokasi, jam, WhatsApp; map loaded lazily, fallback link.
6. Footer with actual social URLs.

Desktop header is tight and clear, not a complex nav. Mobile uses an unobtrusive responsive menu, not a tall overlay of 7 items; WhatsApp remains visible without blocking content.

## 4. Owner information architecture (mobile primary)

Home/default after login: `/admin/scan`, not statistics dashboard.
Bottom nav while authenticated: `Scan` (prominent), `Member`, `Promo`, `Pengaturan`. Desktop same nav in restrained sidebar/header.

### Flow A: member creation (4 decisions max)
```text
Daftar Member (tombol)
  → nama wajib + WA opsional/izin pesan promo
  → SIMPAN & BUAT KARTU
  → layar sukses "Member berhasil dibuat" + ID
  → [Cetak Kartu] [Nanti Saja] [Daftar Lagi]
```
No required profile photo, gender, address, birthday, account password, card format preferences. Duplicate name/phone warning is advisory and manual.

### Flow B: transaksional scan HP
```text
Halaman Scan (kamera hanya aktif setelah izin)
  → QR dikenali (kamera freeze/pause)
  → [Siti A., ID, Total 12, Terakhir: 14 Okt]
  → satu tombol "Catat 1 Transaksi"
  → loading/locking UI until commit
  → sukses: "Berhasil dicatat — Total 13"
  → [Scan Berikutnya] (atau auto-rearm setelah owner sempat membaca hasil)
```
Never count on camera capture alone. Invalid QR says "Kartu tidak ditemukan" and offers retry/manual search. Network unknown: don't pretend success, check status request id.

### Flow C: manual reward
```text
Daftar member → Siti A. → "Berikan Promo"
  → nama promo (wajib), ketentuan, berlaku sampai (opsional)
  → Tinjau → Simpan
  → Pesan WA dari promo tersimpan [Salin Teks] [Buka WhatsApp]
  → Owner manually sends; no delivered claim
  → Owner "Tandai Sudah Digunakan" at redemption
```
No "eligible" badge; nothing granted automatically based on visit count. Count unchanged after redemption.

### Flow D: reprint/lost card
Detail member → "Cetak Kartu Lagi" for normal wear (same valid code) OR "Kartu Hilang — Ganti QR" (invalidate old card permanently, new QR, same member/history). Both require clear descriptive confirmation only when revoking.

## 5. Member single-page (no login)
```text
[Logo Mas Jawa Laundry]
Kartu Member MJL-00128
Total transaksi yang tercatat
                   12
12 kali laundry

Riwayat terakhir
• 14 Oktober 2026   +1
• 11 Oktober 2026   +1
• 06 Oktober 2026   +1

Promo dari laundry
Gratis cuci 2 kg     Tersedia
"Sampaikan ke kasir ketika ingin menggunakan."

Bila ada kesalahan, hubungi petugas laundry.
```
Public view uses preferred name initials or masked alias, never entire phone number. Anyone with card photo may read limited data; card's QR must point to random protected token and be revocable. Technical noindex/referrer restrictions are essential.

## 6. Printed card & actual scanner affordance
- Material recommendation: CR80 (85.6×53.98mm) if printer supports; fallback A4 6–10 cards per sheet with cut guides. The physical printer must be tested before specifying final batch count.
- Card front: real logo, title "KARTU MEMBER", alias/name, non-secret printed ID, high-contrast true QR with 4-module quiet zone; short 1-line instruction, no fake QR drawings on production.
- Back: "Bawa kartu saat laundry. Scan dengan kamera HP untuk cek transaksi." + owner-approved contact, no tiny paragraphs.
- QR scanning area >= comfortable 240px viewfinder on Android, camera torch only when supported; provide clear manual fallback for torn card, permission denied.
- Validate QR after actual printed/laminated material at real distances under dim shop lighting.

## 7. State matrix — must design before coding

| Surface | Loading | Empty | Error | Success |
|---|---|---|---|---|
| Owner Login | authenticating | N/A | generic safe credentials error | enter scan |
| Member list | rows/skeleton | "Belum ada member" + Tambah | retry | member saved |
| Scan | camera init | ready with guide | denial/invalid token/offline/revoked | count updated confirmed |
| Card print | prepare PDF | N/A | browser print not available | PDF ready, not "physically printed" |
| Promo | save pending | no manual promo yet | save conflict | saved, copy/WA actions |
| Member public | fetch pending | 0 visits | revoked or invalid card | count/time & manually granted promos |

Copy (approved default, Indonesian casual but polite):
- CTA homepage: "Hubungi lewat WhatsApp" / "Lihat Harga"
- Admin CTA: "Scan Kartu", "Tambah Member", "Cetak Kartu", "Catat 1 Transaksi", "Berikan Promo", "Salin Pesan"
- Info: "Belum ada transaksi tercatat", "Belum ada promo dari laundry"
- Success: "Transaksi berhasil dicatat. Total sekarang 13."
- Unknown connection: "Belum bisa memastikan transaksi tersimpan. Periksa riwayat sebelum mencoba lagi."
- Camera denied: "Kamera tidak diizinkan. Aktifkan izin kamera atau cari member secara manual."

## 8. Accessibility / anti-slop release checklist
- Every assertion on the homepage traces to current owner-confirmed business fact (not SEO filler).
- Design can be recognized as Mas Jawa Laundry without stock devices/personas; recognizable logo and existing brand hue maintained.
- Do not add vanity KPI cards to owner scan screen; prioritize scanning and next customer.
- Every form has visible labels, errors, correct input types, and saved-state feedback.
- No gradient pile-up, decorative 3D, unrealistic photography, artificial testimonials, emoji as primary icon system, glassmorphism overlay on legible content, marketing jargon, or animating entire page before it's usable.
- Real devices: Android camera, A4/CR80 scan, 320px width, slow connection, no JS for public marketing content, reduced-motion mode, keyboard access, screen readers.
- Security/public member view reviewed explicitly, not treated as admin-only auth problem.
- Show prototypes to owner for an actual task walkthrough; if they need explanations to find "Scan" or "Cetak", simplify again.

## 9. Proposed stage-1 approvals (NOT YET CERTIFIED)
[ ] Homepage mobile and desktop review against actual verified business images.
[ ] Owner scan (ready / recognized / success / failure), creation, print and promo task review.
[ ] Member no-login QR page review on real small Android.
[ ] Owner accepts data exposure implications of QR bearer-link.
[ ] Content and price approvals, staged rollout ownership & printer decision.
