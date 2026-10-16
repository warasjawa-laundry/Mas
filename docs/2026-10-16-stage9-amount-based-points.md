# Stage 9 — Transaksi Nominal dan Poin Member

Tanggal: 16 Oktober 2026. Branch: integration/mas-jawa-laundry. Draft PR #8. Tidak ada deploy production.

## Keputusan
Hadiah diperlakukan sebagai hadiah pasti ketika syaratnya nanti terpenuhi, tetapi klaim/penukaran dan pembagian hadiah **belum dibangun**. Fokus sekarang adalah transaksi nominal, keterangan, perhitungan poin, dan koreksi.

Setiap transaksi owner berisi nominal rupiah (Rp1 sampai Rp1.000.000.000), keterangan 3–240 karakter, 1 catatan transaksi, dan poin sesuai tier. Semua disimpan atomik di database. Memindai QR tidak mengubah total atau poin.

## Aturan poin default
- Rp10.000–Rp24.999 = 1 poin
- Rp25.000–Rp49.999 = 3 poin
- Rp50.000–Rp99.999 = 5 poin
- Rp100.000–Rp199.999 = 10 poin
- Rp200.000 ke atas = 20 poin
- Kurang dari Rp10.000 = 0 poin (transaksi tetap tercatat).

Owner dapat mengubah nominal minimal dan jumlah poin di /admin/points/rules, dengan 5 level, nominal wajib meningkat, revisi aturan untuk mencegah perubahan concurrent, dan snapshot poin yang tidak berubah untuk transaksi yang sudah direkam.

Poin dipisahkan per kalender WIB: 2026 sebagai periode uji coba terpisah dan 2027 sebagai program tahun poster. Poin 2026 tidak otomatis ditransfer ke 2027.

## Migrasi dan data
Source: supabase/migrations/20261016230000_stage9_amount_points.sql, sudah diterapkan pada Supabase proyek yang sama. Dua tabel baru adalah laundry_point_rules dan laundry_amount_transactions (RLS). Penulisan hanya melalui RPC yang memeriksa active owner. UUID request menjamin retry dengan nominal dan deskripsi yang sama tidak menduplikasi transaksi.

Satu record nominal dihubungkan ke 1 event ADD di tabel checklist yang sudah ada. Jika dibatalkan, append-only VOID lama tetap bekerja: saldo poin mengecualikan nominal transaksi yang dibatalkan, tetapi snapshot dan riwayat tetap tersedia. Transaksi lama tanpa nominal, termasuk satu transaksi uji Kiki, tidak di-backfill atau mendapat poin otomatis.

QR pelanggan hanya menampilkan saldo poin per tahun, total transaksi, dan promo yang tersedia. Nama, nomor WA, catatan dan nominal detail tidak dibuka di halaman publik.

## QA
- SQL rollback-only: transaksi Rp75.000 = 5 poin; sesudah ubah aturan nilai baru 9 poin, transaksi baru 9 sedangkan saldo transaksi lama tetap 5.
- SQL rollback-only: Rp200.000 memberi 20 poin; VOID membatalkan poin dari saldo serta mengurangi total transaksi, tanpa menghapus histori.
- SQL rollback-only: izin nonowner ditolak, anon tidak diberi execute RPC penulisan.
- Tests: tests/stage9-contract.test.mjs dan tests/stage9.ui.spec.ts; workflow integrasi menjalankan unit, typecheck, build dan browser tests.

## Sisa pekerjaan sebelum production
Android UAT positif dengan member khusus pengujian, audit akses member/QR, final harga/content homepage, proteksi login/rate limit, dan penentuan mekanisme hadiah pada tahap terpisah. PR #8 tetap Draft; jangan merge atau deploy ke production tanpa persetujuan owner.
