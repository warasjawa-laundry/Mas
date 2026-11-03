# Verifikasi G7/G8

Checkpoint diperbarui 3 November 2026 terhadap main baseline `fe04ef7` dan perubahan dalam integrasi ini. **Pilot dummy tetap aktif, G8 live riil NO_GO.** Tidak membuat laporan audit tambahan. [Riwayat sebelumnya](https://github.com/warasjawa-laundry/Mas/blob/fe04ef7f1a9f7d65baece7373a708e730586d058/docs/pos/g7-g8-verification.md) mempertahankan checkpoint 2–3 November.

## Bukti yang sudah ada dan tidak diulang

- Source/DB: core Owner/kasir, authoritative price/revision, package snapshots, cash/points/refund, import review, four-step wizard dan kalender sudah terhubung. Katalog Production sekarang aktif; tiga-tahap, ongkir belum dibangun dan Production belum dimigrasi adalah klaim usang.
- CI baseline kode ae5da9d lulus [release](https://github.com/warasjawa-laundry/Mas/actions/runs/41653046151) dan [DB concurrency](https://github.com/warasjawa-laundry/Mas/actions/runs/41653046216); fe04ef7 berikutnya merupakan receipt dokumentasi pilot. Hasil tersebut tetap bukti untuk baseline itu, bukan otomatis hasil kode baru.
- Backup aplikasi terenkripsi sudah ada dan readback diverifikasi; restore sintetis CI juga ada. Keduanya tidak diberi label full Production restore.
- Data member/kartu dan ledger lama dipertahankan; impor histori Binatu/backfill tidak diperlukan pada tahap awal.

## Perubahan teruji dalam review ini

| Jalur | Bukti perilaku |
| --- | --- |
| Preflight | Kandidat dengan pilot=true/unknown atau test orders nonzero/unknown ditolak; kandidat yang bersih tetap tunduk pada semua evidence, SHA dan finance-off checks |
| SQL Owner + kasir | Fixture sebelum patch gagal karena DTO kehilangan marker; sesudah patch marker true pada nota uji, false pada nota normal walaupun nama diawali UJI |
| Ongkir detail | Fixture sebelum ekstensi gagal karena snapshot ongkir tidak diteruskan; sesudah patch subtotal 4.000 + ongkir 3.000 = total 7.000 terbaca tanpa mengubah core harga |
| Kontak/receipt | Nota uji menolak verifikasi kontak; DTO redacts kontak test. Nota biasa tetap dapat membaca kontak terverifikasi dengan guard/revoke semula |
| Print | Notice memakai marker DB, bukan prefix nama; visible pada print media 320/1440px, termasuk kasus nama huruf kecil |
| WhatsApp | Watermark simulasi, tanpa bank/payment notice nyata; tidak ada contact form/wa.me pada nota uji; normal receipt DP/lunas/points tetap diuji pada 320/390/1440 |
| Data Production | Apply hanya definisi pembaca/guard; before/after flags dan counts nota/payment/cash/point-link sama; member/kartu/event/nominal hash sama |

Migrasi canonical `20261103210501_pos_pilot_receipt_boundary.sql` diuji QA sebelum Production. QA juga mempunyai receipt koreksi metadata ongkir saat pengembangan; schema final dibandingkan secara semantic, bukan menyalin timestamp history. 1.594 entri pada checkpoint review sebelumnyaes Production=QA, 0 selisih dalam scope comparator. RLS 22/22, direct DML aplikasi 0.

## Hasil lokal dan CI

- `npm test`: 297 PASS.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `npm run test:ui`: 96 PASS, termasuk dua test pilot print/WA tambahan.
- QA: `pos-pilot-receipt-boundary-rollback.sql` dan fixture receipt/points/revoke existing PASS, semua data uji rollback.
- Workflow PostgreSQL menjalankan fixture baru pada fresh replay dan database hasil synthetic restore; race dua koneksi existing dipertahankan. Jangan menjalankan fixture write/rollback ini pada Production yang sedang dipakai.

Hasil RED: missing marker dan delivery snapshot di QA direproduksi; preflight menerima pilot/test count sebelum guard; receipt uji menyerupai nota biasa sebelum watermark. Fixture awal memakai nilai parfum Tidak dan ditolak POS_PERFUME_INVALID; diperbaiki memakai nilai resmi Sakura, bukan melemahkan validasi. Typecheck awal menemukan field parfum/catatan Owner belum dideklarasikan pada DTO TS dan telah diperbaiki.

Hasil CI final terikat commit integrasi melalui GitHub checks. Tidak mengisi signature/reviewer atau bukti lapangan dari hasil fixture. [Readiness JSON](./g8-readiness.json) adalah snapshot dan tetap NO_GO.

## UAT yang belum boleh diberi PASS

Real login Owner/kasir, expiry/revoke/two-tab/network-loss, scanner Android/camera/gallery, printer fisik, WA aplikasi asli, cash count, 25-screen visual signoff, real backup/restore dan rekonsiliasi/arsip jurnal uji. Satu nota/payment pilot yang terlihat di database tidak cukup untuk menandatangani seluruh perjalanan pengguna.

UAT Production tetap guest dummy dan uang simulasi. Member/poin nyata diuji di QA dengan data sintetis. Jika hasil command tidak pasti, lookup UUID dan rekonsiliasi; jangan menerima pembayaran ulang atau membuat UUID baru. Pemilik acceptance tersisa ada pada [master audit](./master-audit-20261102.md).

## Regresi lanjutan nomor, kasir, kartu dan WhatsApp — 3 November 2026

299 Node, typecheck/build dan 96 browser lokal PASS. Tujuh regresi SQL relevan QA PASS dengan rollback, termasuk namespace invoice/cashier, DP/lunas/poin, receipt, retire/retry dan penolakan nota normal. Tes redirect membuktikan signed one-use entry grant dibuat sebelum success/error redirect; halaman menampilkan ID berdasarkan UUID hasil RPC dan daftar terotorisasi. Ini belum menggantikan login Owner manusia.

Browser 320/390/1440 px memeriksa tautan kartu, recipient confirmation dan watermark print. Test awal menemukan tinggi row 320 px bertambah setelah tautan kartu; label/padding diperbaiki tanpa menaikkan batas tes. Pengaman lama yang menutup semua kontak uji diubah atas permintaan Owner: kontak penguji terverifikasi dapat dipakai untuk wa.me, tetap simulasi, tanpa pengiriman otomatis atau bank nyata. Aplikasi WA/perangkat asli tetap PHYSICAL_UAT_REQUIRED.

Replay CI kini mencakup 42 migrasi dan fixture retire setelah synthetic restore. Produksi bukan lokasi fixture write; hanya satu UUID nota dummy lama dihapus/diarsipkan atas izin khusus Owner. Checkpoint 1 nota/payment di atas adalah snapshot sebelum operasi ini. Lihat [master audit](./master-audit-20261102.md) untuk hasil integritas dan batas kewenangan.

CI 41668917004 pada c957d22 menolak top-level LOCK TABLE saat psql autocommit replay. Penguncian serta disable/rename/enable username trigger dipindahkan ke satu DO atomik; schema hasil API QA/Production tetap sama dan tidak menjalankan ulang retire. Perbaikan packaging ini wajib dibuktikan oleh replay CI berikutnya.

Replay migrasi dan seluruh fixture SQL pada e0140e7 lulus, tetapi CI 41669192881 menemukan loop for tergandakan saat fixture retire ditambahkan pada script synthetic restore. Loop diperbaiki menjadi satu daftar regresi dan diperiksa dengan bash -n sebelum CI berikutnya; cakupan fixture tidak dikurangi.

## Koreksi sesi sebelum Simpan Kasir — 3 November 2026

RED di source dan probe HTTP Production terkonfirmasi: GET login dengan header Next prefetch mengirim Set-Cookie penghapusan Owner. Tes baru menjalankan proxy, pemeriksa Owner dan save action berurutan dengan Auth/RPC sintetis: Next/purpose/sec-purpose prefetch mempertahankan sesi, save mencapai RPC sekali, intentional login mencabut sesi dan write berikutnya ditolak. Seluruh 300 Node lokal PASS; TypeScript/build dan regresi browser diverifikasi pada integrasi. Ini tidak diklaim sebagai real Auth UAT pengguna.

Probe HTTP setelah deployment bae120a menunjukkan Purpose/Sec-Purpose prefetch aman, tetapi Next prefetch masih menerima cookie penghapusan. Routing matcher kini mengecualikan hanya GET login-prefetch pada level pencocokan route; route admin lainnya, login normal dan logout tetap melewati proxy. Tes memakai compiler matcher Next yang terpasang, bukan regex tiruan. Jumlah Node menjadi 301; probe Production berikutnya wajib memeriksa ketiga header prefetch dan actual login.
