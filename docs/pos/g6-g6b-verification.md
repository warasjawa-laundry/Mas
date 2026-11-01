# Paket B — G6 kas, laporan, WhatsApp manual & G6b impor Binatu

**QA receipt — 2 November 2026 WIB.** Implementasi sumber dan migrasi telah diuji pada Supabase QA terisolasi `cwxsbgfjynwxqalwonae`. Belum diaplikasikan di database operasional `hncfyfvqtlnvqyfrydzb`. Tidak ada pembayaran, poin, atau posting impor produksi yang diaktifkan.

## Cakupan G6

- `supabase/migrations/20261102010000_pos_g6_cash_reports.sql`: izin per tugas dan verifikasi pasangan token perangkat login pada setiap RPC.
- Mutasi kas **tunai** masuk/keluar non-penjualan mengharuskan izin `cash_entry`, alasan 3–300 karakter, UUID permintaan, batas nominal IDR, row-lock outlet→shift, jurnal append-only dan hasil idempotent. Pembayaran non-tunai tetap dilaporkan tetapi tidak dihitung sebagai uang di laci.
- Shift `MAIN` dapat ditutup dengan hitungan tunai fisik, menyimpan selisih dan alasan bila selisih ≠ 0. Pemeriksaan `closed_by` lama dipertahankan untuk histori owner, lalu diperluas dengan atribusi kasir terpisah. Pembayaran selanjutnya harus membuka shift baru.
- `/kasir/kas`: saldo awal, masuk/keluar, saldo harapan, riwayat hingga 80 baris, mutasi non-sale, tutup shift dan pesan gagal/tidak jelas. `/kasir/laporan`: rentang WIB eksklusif akhir, mutasi tunai/non-tunai, jumlah nota dibuat, saldo piutang *as-of*, poin netto, hingga 300 baris. `/kasir/laporan/export`: CSV dengan metadata, snapshot ringkas, pengamanan formula injection dan akses `reports_view`.
- Draf WhatsApp pada detail nota hanya tombol **salin** untuk petugas dengan izin `whatsapp_draft`. Tidak mengirim otomatis, tidak menarik daftar penerima atau menganggap pesan terkirim.

## Cakupan G6b

- `supabase/migrations/20261102011000_pos_g6b_import_review.sql` adalah non-posting owner-only. Tidak dapat membuat `laundry_pos_orders`, `laundry_pos_payments`, jurnal kas, ADD/VOID atau saldo poin.
- `/admin/pos/import`: unggah Binatu XLSX/CSV maksimal 1,5 MB, satu worksheet untuk XLSX, ≤200 nota; validasi 6 header penting dari contoh laporan 23 kolom. Parser menolak formula/macro, external links/ZIP bombs, nominal pecahan/tidak masuk akal, dan header berubah. Berkas penuh tidak disimpan.
- Identitas file SHA-256 dan nomor nota asal digunakan untuk replay/konflik. File sama menampilkan batch lama; nota asal yang berulang pada batch lain ditandai `CONFLICT`, tidak diam-diam ditimpa.
- Review transaksi **lunas** secara bergantian melalui dialog. Pemilik memilih member dari calon **nama sama** yang disertai nomor member Mas Jawa, telepon dan alamat, atau menandai konflik/melewati. Nama tidak cukup untuk otomatis mengklaim identitas; keputusan tidak memposting poin.
- Riwayat impor menunjukkan tanggal unggahan terakhir dan sisa nota lunas yang perlu direview. `PAID` berbeda dari status kerja `SIAP AMBIL` atau `ANTRIAN`.

## Bukti aktual

- Dry-run DDL dua migrasi di Supabase QA dengan BEGIN/ROLLBACK: PASS.
- Penerapan DDL G6 dan G6b dengan migration tool pada Supabase QA: **SUCCESS**.
- `supabase/tests/pos-g6-g6b-rollback.sql`: **PASS**. Termasuk flag-off denial; pembayaran tamu Rp25.000; kas masuk non-penjualan Rp5.000; keluar Rp1.000; expected cash Rp29.000; UUID replay/konflik; close shift dan alasan selisih; reopen shift; laporan; peran owner-only impor; pencocokan member tanpa poin; duplikat SHA dan nota; semua dibungkus ROLLBACK.
- `tests/pos-g6-import.test.mjs`: **6/6 lokal lulus** pada Node 22 type stripping; Node 24/CI tetap menjadi bukti tambahan. Parser XLSX juga diuji lokal terhadap **struktur** laporan milik owner (13 nota, 8 lunas) tanpa mengunggah isinya ke repo/CI.
- Setelah QA regression: **0** orders, payments, cash ledger, point links, import batches/rows; `MJL.write_enabled=false`. Semua **20/20 tabel POS** tetap RLS, tanpa akses tabel mentah bagi anon/authenticated. SQL regressions dijalankan pada Stage 10 CI setelah migrasi G5.

## Keterbatasan / NO-GO sebelum pilot

- Ini bukan penutupan penuh G6/G6b produksi: belum uji dua koneksi paralel posting/close; hitung uang fisik dan Android UAT; cetak printer thermal; backup/restore produksi dan persetujuan cutover; rekonsiliasi data Binatu sebenarnya bersama owner.
- Parser XLSX sengaja terbatas pada file laporan Binatu tanpa formula, macro, file eksternal atau beberapa sheet. Varian lain ditolak sampai ada fixture dan persetujuan; tidak menebak header.
- XLSX/CSV input dengan format/status/nilai konflik gagal atau dikarantina melalui review, bukan membuat jurnal atau poin. Piutang awal/cutover dari Binatu **belum** diposting; memerlukan gate tersendiri di G8.
- Laporan `receivables_as_of_end` adalah posisi operasional, bukan laba akuntansi. Ekspor menolak >300 mutasi untuk mencegah hasil parsial tanpa diberi tahu.
- QA Auth sesungguhnya dan verifikasi UI pixel/workflow terhadap 25 screenshot Binatu belum selesai; tahap G7 wajib. Identitas Mas Jawa dipakai, tanpa aset asli Binatu.
- Integrasi ke Vercel tetap **satu** proyek `mas` Production; Git connection `unyilhm1-hue/mas` tidak berubah. Merge `main` bukan izin menjalankan SQL di database produksi atau mengaktifkan write flag.