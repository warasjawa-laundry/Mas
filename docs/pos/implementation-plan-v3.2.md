# V3.2 — Laporan Excel otomatis

Baseline `3d6c04ab4a2bf842d6ad150c5497a37820839b5d`, 7 November 2026. Implementasi lokal dan QA tersedia. Rilis mengikuti CI untuk commit yang sama. Mode Uji berlaku dan G8 uang nyata tetap NO_GO. [Riwayat V3.1](implementation-plan-v3.1.md).

## Kontrak dan definisi

Supabase menjadi sumber transaksi. Setiap ekspor membaca satu snapshot PostgreSQL melalui RPC baca baru `laundry_pos_v32_report`; tidak ada sinkronisasi atau input nominal kedua. File yang disimpan adalah snapshot statis. Waktu snapshot (`Data sampai`) dipisahkan dari waktu penyusunan file (`Dibuat pada`), keduanya ditampilkan WIB.

| Nilai | Sumber dan waktu pengakuan |
| --- | --- |
| Nota baru/tagihan bruto | Nota dibuat dalam periode; bukan penerimaan uang. Pembatalan ditandai terpisah dan bruto historis dipertahankan. |
| Kuantitas kg/m/pcs | Snapshot item pada nota baru, masing-masing satuan terpisah; tidak digandakan oleh pembayaran. |
| Penerimaan pelanggan | Kejadian PAYMENT yang dikonfirmasi dalam periode, menurut metode sah yang tersimpan. |
| Refund | Kejadian REFUND dalam periode, terpisah dari penerimaan. |
| Biaya operasional | Kategori EXPENSE; pengeluaran lama tanpa kategori dilaporkan terpisah. |
| Modal | EQUITY; bukan penjualan atau biaya. |
| Perpindahan uang laci | TRANSFER satu sisi, dengan sumber/tujuan; bukan biaya, pendapatan atau saldo bank terverifikasi. |
| Dibayar/refund/sisa/status nota | Kondisi terkini pada snapshot, diberi label CURRENT. |
| Piutang/status historis | BELUM TERSEDIA jika histori lengkap pembatalan/status tidak dapat dibuktikan; tidak diganti saldo terkini. |
| Saldo awal tunai | Pembukaan awal yang sah ditambah seluruh jurnal CASH sebelum awal periode. |
| Saldo akhir tunai | Saldo awal + semua CASH IN periode − semua CASH OUT periode. |
| Pemeriksaan fisik | Hanya hasil Cocokkan Kas yang tersimpan, dengan waktu serta expected pada pemeriksaan itu. Bukan bukti saldo akhir periode bila waktunya berbeda. |

Identitas pelanggan unik hanya dihitung apabila sumber identitas stabil dapat membuktikan deduplikasi. Nomor telepon/alamat tidak diperlukan dan tidak diekspor. Owner dan kasir berizin `reports_view` memakai guard backend; tanpa `order_view`, detail nota/item/pelanggan disembunyikan. Data rekonsiliasi fisik hanya Owner.

## Periode dan batas

UI tanggal akhir inklusif. Backend WIB mulai 00.00 sampai hari sesudah tanggal akhir 00.00 eksklusif. Preset: Hari Ini, Kemarin, Minggu Ini, Minggu Lalu, Bulan Ini, Bulan Lalu, Kustom. Minggu Senin–Minggu; granularitas per hari/minggu/bulan, grup parsial ditandai. Tagihan/kuantitas mengikuti waktu nota, pembayaran/refund mengikuti waktu konfirmasi, biaya mengikuti jurnal.

Batas tetap 93 hari, 1.000 nota, 5.000 jurnal dan 30.000 item sumber; workbook juga memakai batas ukuran aman. Ekspor yang melampaui batas atau gagal validasi ditolak, bukan dipotong diam-diam. V3 dan CSV lama dipertahankan; parameter versi membedakan tanggal inklusif baru dari kontrak eksklusif lama.

## Workbook

Enam sheet tetap: Ringkasan; Rekap Periode; Daftar Nota; Rincian Layanan; Mutasi Keuangan; Rekonsiliasi Kas. Identitas resmi **MAS JAWA LAUNDRY KRAKSAAN**. Angka rupiah/kuantitas serta tanggal menjadi sel numerik, nomor nota dan teks pelanggan tetap string. Tidak ada macro, formula dari input pelanggan atau tautan eksternal. Total ditentukan dari kejadian sumber yang unik, bukan join item×pembayaran.

Generator OOXML existing dipertahankan agar tidak menambah dependency runtime. Warna judul/header mengikuti biru/ungu MasJawa; tabel memakai filter/freeze, lebar/wrap, total, format rupiah/kuantitas/tanggal, A4 dan header cetak. Tabel transaksi tidak menggabungkan sel.

## Pelaksanaan dan bukti

| Tahap | Status | Bukti yang harus tersedia |
| --- | --- | --- |
| Kontrak | IMPLEMENTED | RPC, validasi dan definisi pada dokumen ini |
| Backend | QA_PASS | Migrasi `20261107020000`, suite `pos-v32-report-rollback.sql`, fingerprint 18 sumber dan penolakan jurnal yang hilang atau tidak cocok |
| Workbook | AUTOMATED_PASS | Tiga file dari snapshot sintetis QA dibaca independen dengan openpyxl. Enam tabel, freeze A8, tanggal numerik, A4, tanpa formula, macro atau tautan eksternal |
| UI | AUTOMATED_PASS | Preset, batas inklusif, granularitas, navigasi Next dan unduh fetch. Uji komponen pada 320, 390 dan 1440 px |
| Integrasi | LOCAL_PASS | 394 Node, 171 Playwright, build dan TypeScript. CI commit rilis tetap wajib |
| Rilis | PENDING | Fingerprint Production, migration, deployment/domain SHA |
| Excel dan akun nyata | PENDING | Sesi kendali Excel dihentikan sebelum workbook dibuka. UAT unduhan Owner/kasir nyata dan print preview Excel masih diperlukan |

Fixture lintas bulan menghasilkan satu tagihan Rp100.000 dan DP Rp30.000 pada Oktober. November memiliki pelunasan Rp70.000 dan refund Rp30.000 tanpa tagihan baru dari nota itu. Kuantitas 1,25 kg, 2,35 m, dan 3 pcs hanya muncul dalam rekap Oktober. Fixture SQL juga menguji penolakan pembayaran tanpa jurnal dan memverifikasi data tetap sama setelah pembacaan.

Antislop diterapkan selama pengerjaan. Argon dan warna existing dipertahankan; kontrol diberi label, tanggal akhir dijelaskan, status kosong/error/izin terlihat. Hasil otomatis tidak menggantikan login nyata, uji fisik atau persetujuan operasional G8.
