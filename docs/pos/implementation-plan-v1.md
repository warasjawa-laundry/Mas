# Implementation Plan V1 — Redesign Admin Mas Jawa Laundry menjadi POS Laundry Terintegrasi

**Tanggal penyusunan:** 1 November 2026 (WIB)  
**Status:** Rencana implementasi — belum dieksekusi  
**Repository:** `warasjawa-laundry/Mas`, branch dasar `main` (bekukan SHA aktual saat pekerjaan dimulai)  
**Penggunaan:** Dokumen kerja untuk pengembangan, review owner, QA, dan release gate.

## 0. Keputusan tetap (non-negotiable)

1. **Tidak membuat website, domain, atau repository baru.** Modul kasir adalah redesign total area `/admin` dari aplikasi Next.js Mas Jawa Laundry; website publik dan tautan QR tetap berfungsi.
2. **Pengalaman kasir familier dengan Binatu:** urutan halaman, istilah, posisi aksi utama, alur tambah pesanan, durasi, layanan, pengaturan pesanan, detail nota, status pembayaran, mutasi kas. Gunakan aset, logo, dan implementasi orisinal Mas Jawa Laundry; jangan menyalin kode atau aset proprietary Binatu.
3. **Pertahankan identitas/data lama:** `laundry_members`, `laundry_member_cards`, `laundry_point_rules`, `laundry_amount_transactions`, `laundry_checklist_events`, `laundry_member_promotions`, dan QR lama tidak di-reset, tidak di-rename, tidak diberi ulang nomor member.
4. **Satu member untuk seluruh outlet:** `laundry_members.id` adalah FK kanonis; nomor tampilan `MJL-xxxxxx`. Nomor nota kasir berbeda dari nomor member.
5. **Poin terbit tepat satu kali saat pembayaran lunas 100%**, terlepas dari status pekerjaan laundry. Kasir tidak menginput poin terpisah.
6. **Scan QR tidak pernah menghasilkan poin atau transaksi.** Scan kasir memilih member, scan pelanggan membuka halaman read-only.
7. **Pembayaran, mutasi kas, dan poin konsisten secara atomik** di database; retry, dua kasir bersamaan, dan reload tidak boleh menggandakan penjualan atau poin.
8. **Tidak ada write uji coba ke produksi.** Migrasi bersifat tambahan, kompatibel, diverifikasi, dan memakai release gate terpisah.
9. **Fitur admin lama tidak hilang:** pendaftaran/edit member, kartu cetak & reissue, scan kamera/galeri, promo, consent, riwayat dan void, katalog harga, tahun program, layanan publik `/membership`, serta portal `/k/[token]`.

## 1. Fakta baseline yang sudah diverifikasi

**Kode dan platform**
- Next.js `16.4.2`, React `19.3.1`, TypeScript `5.9.3`, Node `24.x`, Supabase SSR/client, Playwright, Node tests.
- `app/admin/*` sudah ada; form nominal manual di `components/admin/amount-visit-form.tsx` dan `app/admin/points/actions.ts` menggunakan RPC `laundry_record_amount_visit` tanpa nomor nota.
- Scan petugas `components/admin/scan-card.tsx`; scan pelanggan `components/customer-card-scanner.tsx`; portal publik `/k/[token]` membaca balance/history/promos.
- Katalog `laundry_services` dan editor owner sudah ada. Service catalogue awal belum boleh dianggap mencakup seluruh item Binatu; lakukan mapping manual.
- Fitur `laundry_owner_accounts` sekarang adalah kontrol owner; **peran kasir belum ada** dan tidak aman jika kasir diberikan credential owner.
- Dokumen historis mencatat sumber QA lama pernah berisi data nyata yang kemudian dikonsolidasikan ke operasional; **jangan dipakai sebagai sandbox sintetis secara otomatis**.

**Lingkungan (hasil pemeriksaan 1 November 2026)**
- Supabase operasional: `hncfyfvqtlnvqyfrydzb`, `ACTIVE_HEALTHY`.
- Supabase QA lama: `tnadzytuamdxfypoeggy`, `INACTIVE`; harus diputuskan apakah akan dibuat ulang QA bersih terpisah. **Pilihan default: QA baru/terisolasi dengan data sintetis, bukan mendaur ulang QA lama tanpa audit.**
- Aturan poin aktif, revisi 1 untuk 2026 dan 2027: 10k→1; 25k→3; 50k→5; 100k→10; 200k→20. Di bawah 10k→0. Selalu baca nilai dan revision dari database saat award, jangan hardcode.
- Dokumentasi release repo menyebut Git-triggered deploy dinonaktifkan pada branch tertentu dan pernah ada pemisahan Preview/Production. Validasi keadaan Vercel/DNS **aktual saat implementasi**, jangan mengandalkan checkpoint lama.

**Referensi UI (25 screenshot Binatu milik pengguna)**
- Login Manajer/Kasir; dashboard kasir; Antrian/Siap Ambil/Belum Bayar; pilih pelanggan; durasi Reguler/Ekspres/Kilat; kategori kiloan/satuan/meteran; +/− kuantitas; sticky total & Lanjut; parfum; antar-jemput; diskon; catatan; rincian nota; selesai kerja & pelunasan terpisah; WhatsApp draf; mutasi kas bertanggal; pengaturan kasir per outlet.
- Dari screenshot **belum terkonfirmasi** alur pembayaran DP/cicilan, refund, transfer verifikasi, printer thermal, dan operasi offline. Fitur ini diperlakukan sebagai kebutuhan desain baru, bukan sebagai klaim perilaku Binatu.

## 2. Target UX dan informasi layar

### 2.1 Rute dan navigasi

Tetap satu area `/admin` dan satu domain. Rute yang disarankan:

| Rute | Peran | Fungsi |
|---|---|---|
| `/admin/login` | Semua | Pilihan login Manajer/Kasir; tiap pegawai punya identitas + password/PIN aman |
| `/admin` | Semua | Redirect/landing sesuai hak akses; owner dapat dashboard gabungan |
| `/admin/pos` | Kasir, manajer, owner | Ringkasan outlet, aksi Tambah Pesanan, Cari Pesanan, Data Pelanggan, Mutasi Kas |
| `/admin/pos/orders` | Semua sesuai outlet | Tab Antrian, Siap Ambil, Belum Bayar, cari nama/nota |
| `/admin/pos/orders/new` | Kasir+ | Wizard: pelanggan → durasi → layanan → atur → review/buat nota |
| `/admin/pos/orders/[id]` | Kasir+ | Nota, progres kerja, pembayaran, kontak/draf WA, audit sesuai izin |
| `/admin/pos/cash` | Kasir terbatas; manajer+ | Mutasi kas, filter outlet/periode/kasir/metode, tutup kas |
| `/admin/pos/reports` | Manajer+ | Analitik & ekspor laporan |
| `/admin/pos/import` | Owner/izin khusus | Migrasi/rekonsiliasi Excel Binatu |
| `/admin/staff`, `/admin/outlets` | Owner, manajer sesuai izin | Akun dan outlet |
| `/admin/members`, `/admin/scan`, `/admin/points/rules` | Izin sesuai kebijakan | Mempertahankan fungsi lama dengan komponen UX baru |
| `/k/[token]`, `/membership` | Pelanggan | Tetap publik/read-only; URL QR lama tidak berubah |

Jangan memindahkan route lama secara massal pada tahap awal. Pertahankan kompatibilitas link, redirect aman, dan regression test untuk setiap route lama.

### 2.2 Alur kasir (sedekat mungkin dengan Binatu)

1. **Login pegawai:** pilih outlet aktif, tampilkan nama kasir; PIN/password tetap dibutuhkan, jangan gunakan ID kasir saja.
2. **Dashboard:** kas tunai dan ringkasan pesanan; Tambah Pesanan dan Cari Pesanan; tab Pesanan/Menu seperti Binatu; tambahan Scan QR yang jelas tanpa mengganti tata letak utama.
3. **Pilih pelanggan:** cari nama/HP/member, tombol tambah, tombol Scan QR; hasil memuat nama + nomor MJL + HP/alamat terbatas; nama identik ditampilkan sebagai daftar pilihan, tidak auto-merge. Guest boleh membuat pesanan, membership opsional.
4. **Pilih durasi:** Reguler/Ekspres/Kilat dalam bottom sheet, estimasi waktu selesai dihitung WIB dan disimpan per nota.
5. **Pilih layanan:** sticky pelanggan, total kg/pcs/m, total harga, aksi Lanjut; tab kategori + pencarian untuk mengurangi scroll; stepper +/− dan input numerik desimal untuk kg/m.
6. **Atur pesanan:** parfum, antar-jemput, diskon persen/nominal, catatan; tampilkan subtotal, biaya tambahan, diskon, total akhir; izin diskon dibatasi.
7. **Review & buat nota:** cek pelanggan, item, kuantitas, nominal, estimasi, outlet; validasi server ulang harga/role; generate nomor nota unik; simpan draft/created tanpa memberikan poin.
8. **Detail nota:** WhatsApp draf, cetak, status pekerjaan, pembayaran, petugas, riwayat. Status pekerjaan dan status pembayaran dua state terpisah.
9. **Pembayaran:** Tunai/Non Tunai; jika diputuskan mendukung DP, bayar sebagian + sisanya; konfirmasi pelunasan mengaktifkan poin otomatis; UI menampilkan status sukses yang berasal dari hasil DB, bukan optimisme client.
10. **Kas & laporan:** mutasi tercatat dari setiap pembayaran, filter tanggal pembayaran; tidak menghitung transfer sebagai kas tunai.

### 2.3 State UI wajib

Loading/skeleton, empty, error offline, timeout, pending-submit, retry/reconcile, berhasil, konflik harga, duplikasi nota, kartu nonaktif, nama ganda, outlet tidak punya akses, pembayaran sedang diproses, status transaksi berubah oleh petugas lain. Tombol pembayaran tidak mengizinkan double-submit, tetapi pencegahan utama di DB.

Minimum QA viewport: 320, 360, 390, 768, 1024, 1440 px dan Android Chrome aktual; 44px+ touch targets, sticky total tidak menutupi tombol, area input tetap terlihat saat keyboard terbuka.

## 3. Model data tambahan (usulan; nama final disepakati saat design review)

**Tabel lama dipertahankan.** Tambahkan tabel POS; perubahan pada tabel lama hanya aditif jika kontrak membutuhkan:

| Tabel baru | Kolom penting | Invarian |
|---|---|---|
| `laundry_pos_outlets` | `id`, `code`, `name`, `is_active`, alamat | `code` unik, audit pengubahan |
| `laundry_pos_staff` | `auth_user_id`, `display_name`, `is_active` | Referensi Supabase Auth, tidak menyimpan password plaintext |
| `laundry_pos_staff_outlets` | `staff_id`, `outlet_id`, `role`, izin operasional | Pengawasan akses per outlet, pemeriksaan server/DB |
| `laundry_pos_guest_customers` | `id`, nama, telp/alamat opsional, `linked_member_id` opsional | Hanya untuk guest; jangan membuat nomor member kedua |
| `laundry_pos_orders` | `id`, `outlet_id`, `invoice_no`, `member_id` nullable, guest reference, customer snapshot, status kerja, status bayar terhitung, total akhir, versi, waktu | `UNIQUE(outlet_id,invoice_no)`; satu nota satu outlet; tidak ada update diam-diam atas pembayaran selesai |
| `laundry_pos_order_items` | order FK, layanan FK, nama/jenis/price snapshot, qty `numeric`, unit, subtotal integer | Harga snapshot immutable sesudah finalisasi kecuali koreksi terotorisasi |
| `laundry_pos_order_adjustments` | parfum, ongkir, diskon, jenis, nilai snapshot, alasan | Persentase dihitung deterministik, pembulatan terdokumentasi |
| `laundry_pos_payments` | `id`, `order_id`, amount IDR, metode, `request_id`, staff, `paid_at`, status, refund reference | Immutable journal; `UNIQUE(request_id)`; tanpa double-charge |
| `laundry_pos_cash_ledger` | `id`, `payment_id` nullable, outlet, metode, arah, nominal, actor | Tidak gandakan mutasi untuk pembayaran sama |
| `laundry_pos_order_events` | order, actor, action, before/after sanitized, timestamp, alasan | Append-only audit |
| `laundry_pos_point_links` | `order_id`, `visit_event_id`, event type/status, revision, timestamp | Kunci satu pemberian aktif per nota; VOID/koreksi tercatat terpisah |
| `laundry_pos_import_batches` | file hash, sumber/outlet, cakupan, uploader, hasil | Batch audit dan re-upload aman |
| `laundry_pos_import_rows` | batch, row, external invoice, status, raw checksum, match member | Data sensitif hanya owner; mapping manual identitas |

Indeks wajib: `(outlet_id,invoice_no)` unik; `orders(outlet_id,created_at)`, `(outlet_id,status_work)`, `payments(order_id,paid_at)`, `point_links(order_id)`, `staff_outlets(staff_id,outlet_id)`. Tambahkan indeks FK sesuai advisor/perf.

Uang: integer IDR (`bigint`) pada hasil transaksi; kuantitas `numeric(12,3)` atau skala yang disetujui (bukan JavaScript float untuk uang). Tentukan pembulatan subtotal per item **sebelum** implementasi. Total akhir = total item + biaya layanan/antar – diskon; validasi pengurangan tidak negatif.

Jangan memperluas akses anon ke tabel baru; gunakan RLS dan operasi sensitif lewat RPC terbatas.

## 4. Integrasi dengan ledger poin lama (bagian tersensitif)

1. **Satu sumber saldo:** tetap `laundry_checklist_events` + `laundry_amount_transactions` dan existing public/owner balance RPC; tidak ada saldo alternatif yang dihitung sendiri di POS.
2. **Jangan pakai RPC owner lama langsung dari akun kasir.** `laundry_record_amount_visit` memvalidasi owner; jangan menghapus check owner agar kasir dapat memanggilnya. Tambahkan internal service/DB function khusus POS yang mengecek staff-outlet privilege dan menulis ke ledger lama dengan semantik poin yang sama. API owner lama tetap kompatibel.
3. **Satu RPC bisnis atomik:** `pos_post_payment_and_award(request_id, order_id, amount, method, ...)` (nama provisional) melakukan lock order, otorisasi, validasi versi & sisa bayar, ledger pembayaran, mutasi kas, recompute paid_total, lalu jika mencapai lunas **dan** member aktif/terverifikasi, menulis satu event ADD + amount transaction + link nota dalam satu commit. Kalau semua operasi gagal, rollback total.
4. **Guard DB, bukan UI:** constraint/link unik pada nota+award aktif; row lock untuk dua kasir; idempotency `request_id` untuk retry; input nominal dan poin tidak dipercaya dari client.
5. **Poin berdasar total akhir nota**, bukan nilai DP, bukan jumlah cicilan, bukan saldo bayar terakhir. Nilai di bawah tier pertama memberi 0 poin; pesanan bernilai nol tidak dipaksakan ke old RPC yang min Rp1.
6. **Tahun program:** tetapkan kebijakan `paid_in_full_at` berdasarkan WIB (default usulan), bukan tahun upload/created_at atau tahun request diproses. Karena RPC lama memakai waktu sekarang, endpoint POS perlu desain eksplisit untuk kejadian batas tahun dan snapshot `rule_revision`. Riwayat 2026/2027 lama tetap utuh.
7. **Salah member, refund, pembatalan:** koreksi hanya oleh peran berizin; gunakan event VOID append-only untuk meniadakan poin lama; jika re-award diperbolehkan, harus atomik dan dijaga `one active award per order`. Jangan menghapus riwayat lama atau re-award otomatis tanpa aturan.
8. **Tutup celah manual:** UI input poin lama jangan dibiarkan menjadi jalur kedua tanpa nota. Untuk transaksi POS baru, semua pemberian poin berasal dari nota. Transaksi historis yang tanpa nota dipertahankan read-only; penautan/manual reconciliation harus terotorisasi dan diaudit.
9. **Guest:** pesanan dan pembayaran tetap sah; secara default *tidak* membuat poin jika tidak ada member terverifikasi pada saat pelunasan. Kebijakan retroaktif perlu keputusan owner terpisah.
10. **Pengiriman WhatsApp** tidak disatukan secara atomik dengan pembayaran: gunakan outbox/event + retry aman; pengiriman dapat gagal tanpa menggagalkan pembayaran/poin.

**State ledger POS yang diajukan:** `draft`→`created`→`paid_partial`→`paid_full`→(jika refund) `refund_pending/refunded`. State kerja terpisah: `antrian`→`siap_ambil`→`selesai`, dengan log perubahan. Jangan mengubah pekerjaan menjadi `lunas` atau sebaliknya.

## 5. Member, QR, dan portal publik

- Canonical FK `laundry_members.id` dipakai kasir. Nomor MJL tetap; kartu lama dan `app/k/[token]/page.tsx` tidak diubah URL-nya.
- Scan kasir = resolve QR→member; boleh pilih member untuk order, tidak merekam kunjungan, pembayaran, atau poin.
- Scan pelanggan = buka portal read-only saldo per tahun, total transaksi, riwayat nominal+poin+status batal, promo; lanjutkan pemanggilan RPC publik sempit yang ada.
- Pada tahap integrasi POS, tambah metadata tampilan nota/status dengan **RPC scoped by active token**, hanya setelah review privasi. Jangan membuka HP/alamat/keterangan internal lewat QR.
- QR adalah bearer credential: siapa pun yang memegang foto/token bisa melihat data yang disediakan. Pertimbangkan ringkasan saja secara default; detail lebih sensitif memerlukan autentikasi tambahan. Pertahankan revoke/reissue serta `noindex`, `no-store`, dan `no-referrer`.
- Foto QR yang dipilih dari galeri diproses lokal pada klien seperti sekarang; jangan log raw token/QR.

## 6. Ekspor, impor, dan migrasi Binatu

**Export POS (baru):** tiga report berperiode/outlet: `Pesanan`, `Pembayaran/Mutasi`, `Poin Member`. Cantumkan filter, jumlah record, total uang, program_year, timezone WIB, exported_at, schema_version, identitas outlet, hash/versi jika diperlukan. Pada export dari server, lindungi CSV/XLSX dari formula injection; akses ekspor dibatasi.

**Import Excel Binatu (migrasi/cadangan):**
1. Upload ke endpoint owner; validasi `.xlsx`, ukuran, ekstensi/MIME, header, sheet, area `PESANAN MASUK` dan `PESANAN BATAL`, lokasi header, total footer, rentang periode/outlet.
2. Mapping `NOTA`, `TANGGAL MASUK`, `PELANGGAN`, `LAYANAN`, `HARGA AKHIR`, `STATUS`, `PEMBAYARAN`, `BELUM BAYAR`, `SUDAH BAYAR`, petugas. Label harus divalidasi; jangan bergantung hanya pada posisi kolom.
3. Pemeriksaan uang: `harga_akhir = sudah_bayar + belum_bayar` jika format report menggunakan semantik itu; status lunas harus konsisten (`belum_bayar=0`, `sudah_bayar=harga_akhir`, status nonbatal). Bila tidak konsisten → karantina.
4. `external_outlet + external_nota` unik; hash file dan hash baris. Re-upload aman; update hanya jika bukti sumber lebih baru/terverifikasi, jangan overwrite paid state oleh laporan lebih lama.
5. Nama sama ≠ identitas sama. Kandidat berdasarkan nama, dengan HP/alamat dari Supabase hanya untuk petugas berizin; owner memilih bila ambigu. Jangan keluarkan PII ke file debug/PR.
6. Karena Excel contoh tidak memuat **tanggal pelunasan**, `paid_at` historis harus dianggap tidak diketahui, bukan diisi dengan tanggal pesanan atau tanggal upload. Catatan histori tahun poin memerlukan kebijakan approval.
7. Import historis default `dry-run`/preview, tanpa award otomatis. Setelah owner merekonsiliasi poin manual lama, baru post transaksi historis yang disetujui. Aktifkan jalur kasir live secara terpisah dari impor.
8. Laporan pesanan berdasarkan tanggal dibuat tidak membuktikan semua pembayaran lama tercakup. Untuk migrasi lengkap, minta laporan pembayaran/rekonsiliasi khusus atau ekspor seluruh rentang nota terbuka.

## 7. Keamanan dan hak akses

- Auth: pemilik memakai identity owner lama; pegawai memiliki akun individual di Supabase Auth, tidak menggunakan password/ID bersama. Simpan role aktif dan afiliasi outlet di tabel server-controlled (bukan user-editable metadata).
- Staff hanya dapat membaca/mencatat pesanan pada outlet berizin; role `cashier`, `outlet_manager`, `owner` ditentukan server/DB. Owner lintas outlet, manajer subset, kasir minimal.
- Jangan mengubah `requireOwner()` atau hak owner lama menjadi akses umum. Gunakan auth helper `requirePosStaff()` baru serta RLS/RPC authorization untuk jalur kasir.
- Database post-money: revoke EXECUTE dari PUBLIC/anon pada fungsi sensitif; `SECURITY DEFINER` private only bila diperlukan dengan `search_path=''`, validasi `auth.uid()`+izin outlet di dalam fungsi. Frontend dan Next Server Actions tetap harus diverifikasi ulang karena endpoint bisa dipanggil langsung.
- Perintah penting (refund, diskon override, hapus/void, re-award, export PII) memerlukan role, reason, audit dan idealnya reauth owner untuk nilai tertentu.
- Rate limit login/payments, CSRF/proxy protection, request validation, no leakage of service_role/key/token, sensitive log redaction, noindex admin/member token routes.
- Perlu backup/retention/perlindungan data pelanggan sesuai ketentuan yang berlaku.

Rujukan: https://supabase.com/docs/guides/database/functions ; https://supabase.com/docs/guides/database/postgres/row-level-security ; https://nextjs.org/docs/app/guides/data-security.

## 8. Tahapan pekerjaan, keluaran, dan gate

| Stage | Implementasi utama | Deliverable & gate untuk lanjut |
|---|---|---|
| **G0 — Freeze & baseline** | Bekukan SHA `main`; snapshot struktur, data dan fungsi lama; uji seluruh jalur QR/member/poin; audit migration history, Vercel env & feature flags | Baseline dan checksum; nol perubahan produksi; desain keputusan awal disetujui |
| **G1 — QA baru** | Buat/validasi proyek Supabase QA terisolasi + environment Preview terlindungi + data sintetis; CI test non-destructive | Bukti isolasi egress/credentials; tidak mungkin tes menulis ke operasional |
| **G2 — Kontrak data & keamanan** | ADR, ERD, izin role/outlet, model nominal/status/tahun; migrasi aditif; tests privilege/RLS dan migrasi rollback-only | SQL integration PASS, advisor ditinjau, sumber historis tetap kompatibel |
| **G3 — UI Shell & login** | Redesign `/admin` gaya Binatu; login kasir/manajer; dashboard, navigasi, old member modules terintegrasi | Visual/UAT HP, owner lama tetap bisa login, cashier tidak membuka menu owner |
| **G4 — Order lifecycle** | Wizard pelanggan→durasi→layanan→pengaturan→nota; status laundry, katalog, scanner QR; print receipt | Order totals benar, qty satuan/kg/m, history immutable, screenshot flows UAT |
| **G5 — Pembayaran & poin** | Payment ledger, mutasi, cash vs noncash, DP bila approved, RPC atomic points, refund/void, DB uniqueness | Test concurrency, idempotency, rollback, year boundary, QR visible points PASS |
| **G6 — Laporan/Excel/WA** | Reports & export 3 tipe, import Binatu preview/reconcile, WhatsApp draf, filter per outlet | Reconcile totals dan data legacy; tidak ada double credit; privacy PASS |
| **G7 — UAT perangkat nyata** | Android kasir/owner, printer thermal, network loss/retry, QR kamera/galeri, browser desktop, accessibility | Owner dan petugas sign-off, tidak ada blocker P0/P1 |
| **G8 — Rollout bertahap** | Pilot satu outlet; feature flags; shadow reconciliation dengan Binatu; cutover setelah sign-off; monitoring & rollback aplikasi | Laporan keuangan/nota/poin cocok; tidak ada data ganda; release approval terdokumentasi |

**Saran pembagian PR:** PR-01 kontrak/QA, PR-02 schema/RBAC, PR-03 UI admin shell, PR-04 order flow, PR-05 payments/points, PR-06 portal/report/import, PR-07 acceptance/release. Pecah lagi jika review terlalu besar. Semua PR ditautkan ke test evidence.

## 9. Test matrix (wajib lulus)

**Data member dan QR**
- Existing member number/token tetap; guest tidak diberi nomor MJL; nama ganda dengan HP/alamat berbeda tidak auto-merge.
- Active QR kasir memilih member tetapi tidak memberi poin; QR revoke ditolak, reissue tidak menghilangkan saldo; galeri/kamera tetap bekerja.
- Public `/k/[token]` hanya melihat member yang tepat; no PII leakage; no indexing; tidak terjadi perubahan saldo hanya karena reload.

**Order dan nominal**
- Mixed kiloan/satuan/meteran; qty 0/negatif/NaN ditolak; qty desimal dan pembulatan deterministik; diskon nominal/persen, antar-jemput dan total akhir; harga lama immutable saat katalog berubah.
- Dua pengguna membuka nota sama; submit ulang create dengan request_id sama; nomor nota unique lintas konsumen dan per outlet; order tidak muncul ganda.
- Status Antrian/Siap Ambil/Selesai tidak mengubah status lunas/poin; pembatalan kerja diaudit.

**Pembayaran/point/accounting**
- Belum bayar → 0; DP Rp30k dari Rp93k → 0; pelunasan Rp63k → 5 poin sekali.
- Untuk 2026/2027, batas tepat 9.999/10.000/24.999/25.000/49.999/50.000/99.999/100.000/199.999/200.000; rule revision snapshot tidak berubah saat owner mengedit tier.
- Dua kasir bersamaan bayar nota sama; double-click; retry selepas jaringan mati; error sesudah posting awal; semua menghasilkan satu posting unik tanpa double points.
- Tidak ada mutasi kas non-tunai ke saldo kas tunai; refund append-only menurunkan nilai saldo kas dengan referensi yang tepat dan membatalkan poin jika tidak lagi lunas.
- Jumlah poin kasir cocok dengan portal publik dan owner; Tahun WIB 31 Des/1 Jan valid; sebagian pembayaran yang kemudian full sesudah tahun berubah mengikuti keputusan bisnis yang disetujui.
- Login cashier tidak dapat mengubah aturan poin, melihat seluruh outlet, menjalankan owner RPC, atau melakukan refund tanpa izin; cek serangan lewat panggilan API langsung.

**Excel dan laporan**
- Format tidak dikenal, kolom hilang, duplicate nota, footer total mismatch, angka negatif/teks formula, dua file yang sama, upload terlalu besar, nota sama dengan status berubah, tidak ada tanggal pelunasan, nama ganda, laporan antar outlet.
- Revenue report berdasarkan `paid_at`/ledger, bukan tanggal order; jumlah dan metode payment reconcile dengan cash ledger; export PII hanya owner/role berizin.

**UAT perangkat & regression**
- Android Chrome nyata + berbagai viewport; print thermal dan cetak kartu lama; QR kamera/galeri; keyboard resize; offline/online return; double-submit.
- Existing automated `npm test`, `npm run typecheck`, `npm run build`, `npm run test:ui` + test RLS concurrency & auth E2E; Capture CI artifact dan hasil UAT.

## 10. Go/No-Go produksi

**GO hanya bila semuanya benar:**

- Approved migration/permission review, rollback plan kompatibel, backup/snapshot dan hasil restore uji.
- Semua gate automated plus authenticated UAT dan fisik perangkat PASS; tidak ada bug P0/P1.
- QA Preview tidak menunjuk operasional; token/kunci QA tidak tertukar; semua logs menutupi PII/token.
- Baseline jumlah member, card, promo, poin per tahun, total transaksi lama cocok **sebelum vs sesudah** migration.
- Nota baru unik, transaksi lama terisolasi dari award otomatis, refund/DP boundary teruji.
- Pilot outlet: kas masuk, non-tunai, piutang belum bayar, nota, dan poin reconcile setiap shift/hari; tidak ada gap belum dijelaskan.
- Owner menyetujui cutover spesifik ke production; monitoring dan prosedur rollback siap.

**NO-GO apabila** terdapat transaksi ganda, poin ganda, akses kasir ke data lintas outlet, hilangnya QR lama, mutasi kas salah, import historis memberikan poin otomatis tanpa tanggal bayar yang valid, atau QA tidak terisolasi.

**Rollback:** `feature_flag POS_WRITE_DISABLED` atau matikan login POS; pertahankan fungsi membership/portal lama dan backup. Jangan me-rollback additive migration secara destruktif bila sudah ada penjualan kasir nyata; rollback app ke build kompatibel dan lakukan forward-fix. Setelah cutover penuh, hindari pencatatan jual-beli simultan di Binatu dan POS tanpa kebijakan sumber kebenaran yang jelas.

## 11. Keputusan bisnis yang perlu disahkan (default rekomendasi)

| Topik | Default yang direkomendasikan | Konfirmasi dibutuhkan sebelum stage |
|---|---|---|
| Poin | Saat pembayaran lunas 100%, dihitung dari total akhir setelah diskon + biaya yang memang ditagihkan | G2/G5 |
| DP/parsial | Dukung pembayaran bertahap, poin tetap 0 sampai lunas | G2/G5 |
| Tahun poin | Tahun WIB pada transisi pertama `paid_in_full_at`; tidak memakai tanggal order | G2/G5 |
| Pelanggan guest | Boleh bertransaksi; tanpa poin otomatis, registrasi terlebih dahulu untuk poin | G2/G5 |
| Daftar setelah lunas | Tidak backfill otomatis; jika diperbolehkan, proses khusus owner dengan audit | G2/G5 |
| Refund/void | Owner/manajer berizin, alasan wajib, jurnal append-only; reaward perlu review | G2/G5 |
| Diskon | Kasir hanya diskon daftar; diskon custom perlu izin lebih tinggi | G2/G4 |
| Nomor nota | Generate internal dari outlet+sequence/transaksi; tampilkan unik dan mudah dibaca | G2/G4 |
| Notifikasi WA | Draf/manual lebih dulu, otomatis belakangan hanya lewat integrasi resmi | G6 |
| Migrasi historis | Import pratinjau & pencocokan; tidak memberi poin otomatis sampai validasi historis | G6 |
| Web offline | Tahap awal online-only dengan recoverable forms dan retry aman; jangan janji transaksi offline | G4/G7 |
| Target outlet pilot | Pilih satu outlet sebelum rollout lainnya | G8 |

## 12. File-level worklist pertama

**Tidak langsung diubah; daftar target kerja setelah desain disetujui**:

- Pertahankan: `app/k/[token]/page.tsx`, `components/member-progress-view.tsx`, `components/customer-card-scanner.tsx`, `components/admin/scan-card.tsx`, `lib/laundry/card.ts` (refactor kecil hanya bila dibutuhkan, regression tests wajib).
- Audit/refactor terkontrol: `app/admin/layout.tsx`, `components/admin/admin-navigation.tsx`, `app/admin/page.tsx`, `app/admin/login/*`, `lib/supabase/owner.ts` (jangan menghilangkan owner requirement), `components/admin/amount-visit-form.tsx`, `app/admin/points/actions.ts`.
- Tambahkan: `app/admin/pos/**`, `components/pos/**`, `lib/pos/**`, `lib/supabase/pos-staff.ts`, migration POS baru di `supabase/migrations/` (nama via tool migrasi saat dibuat), tests `pos-*.test.mjs`, `pos-*.ui.spec.ts`, `docs/pos-*/`.
- Audit kembali CI `.github/workflows/*`, `vercel.json`, environment QA/production, kemungkinan security middleware/proxy, dan catalog services mapping.

## 13. Definition of Done akhir

Pegawai dapat masuk sebagai kasir terotorisasi, memilih pelanggan dengan pencarian/QR, membuat nota multi-layanan, menerima pembayaran tunai atau non-tunai, dan setelah lunas poin yang benar tercatat **tepat satu kali** untuk member yang benar. Owner dapat meninjau transaksi/kas/poin per outlet, ekspor laporan valid, serta melihat audit koreksi. Pelanggan memakai **kartu QR lama** untuk melihat saldo dan riwayat yang konsisten; data lama, nomor member, token aktif, dan fungsi publik tetap beroperasi. Semua ini dibuktikan dengan automated tests, database concurrency tests, dan UAT perangkat nyata **sebelum** production release.

---

**Catatan:** Ini dokumen desain/implementasi, bukan bukti fitur sudah dibangun. Tidak ada commit, migrasi atau deployment akibat penyusunan dokumen ini.
