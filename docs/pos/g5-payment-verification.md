# G5 — Payment, points and full refund QA verification

**Status: implementasi dan tes di QA terisolasi; belum ada transaksi finansial produksi.** Semua fixture sintetis di-rollback.

## Hasil satu paket G5

- Penambahan `actor_staff_id` pada checklist+amount ledger serta `confirmed_staff_id`/`created_staff_id` pada payment/cash, dengan CHECK XOR agar satu event dicatat tepat satu owner Auth atau kasir nyata. Riwayat owner lama tetap berlaku.
- Dua token pada perangkat kasir yang dipair owner, setiap perintah memeriksa izin `payment_collect`/`refund_full` di database. RLS dan default-deny tetap; tidak ada INSERT finansial tabel publik dari browser.
- Shift kas utama MAIN dengan saldo awal 0 untuk G5. Pengelolaan closing, opening balance dan koreksi kas masih G6.
- Pembayaran parsial/lunas: jumlah rupiah string bulat, expected order version, UUID dan payload digest, row lock outlet+order+shift, immutable receipt+cash ledger. Poin member ditambahkan sekali saat lunas penuh dengan rule/year snapshot WIB. Tidak memberi poin untuk DP, guest atau nota nol. Pelunasan member tanpa rule tahun ditolak secara atomik.
- Refund penuh per receipt/metode asal, immutable cash-out dan VOID append-only pada award semula; refund parsial tidak didukung.
- ADD manual legacy ditolak hanya setelah outlet POS yang satu write-enabled. Histori/VOID lama tetap dapat dibaca/dikoreksi.
- UI `/kasir/pesanan/[id]`: status bayar, total diterima, sisa tagihan, buka kas, form tunai/non-tunai, daftar receipt, refund berizin, status kerja terpisah. Ikuti 25 screenshot Binatu sebagai acuan alur dan tata letak, tetapi gunakan identitas Mas Jawa Laundry.

## Bukti QA aktual

- Supabase QA `cwxsbgfjynwxqalwonae`: `pos_g5_payment_cash_points_full_refund` **SUCCESS**; DDL dry-run transaksi rollback juga **SUCCESS**.
- `supabase/tests/pos-g5-payment-rollback.sql`: **PASS** termasuk nota Rp93.000, DP Rp30.000 (tanpa poin), sisa Rp63.000 (5 poin menurut fixture QA 2026), replay UUID, stale version/overpayment/konflik, refund tunai+non-tunai dan VOID, guest tanpa poin, nota nol, izin refund terpisah dan token revoke.
- `tests/pos-g5-payment.test.mjs` di Node lokal: **5/5 PASS**; pengujian CI Node 24 tetap dibutuhkan.
- Setelah tes QA: 0 nota, 0 payment, 0 cash ledger, 0 point links; outlet `write_enabled=false`. Seluruh 20 tabel POS tetap RLS dan tidak ada direct financial INSERT untuk `anon`/`authenticated`.
- Security advisor INFO `rls_enabled_no_policy` adalah *default deny* yang disengaja, bukan alasan untuk membuat permissive policy. [Panduan Supabase lint](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Gate yang masih terbuka — NO GO untuk POS pembayaran produksi

1. Race dua koneksi database atas sisa bayar yang sama; satu transaksi rollback tidak membuktikan concurrency commit nyata.
2. Pengujian owner→kasir pada Android/perangkat yang dipair, kamera QR fisik, jaringan terganggu, cetak nota nyata, serta regresi portal poin setelah posting dari kasir.
3. Review migrasi kompatibel terhadap data historis, backup/restore dan persetujuan eksplisit migrasi serta cutover produksi.
4. Paritas UI 25 screenshot G4–G7: QR scan, ongkir, preset diskon/parfum, ETA, kas tutup shift, laporan dan impor Excel belum selesai.
5. Satu proyek Vercel Production `mas` tetap; Git connection ke `unyilhm1-hue/mas` tidak diganti. Cocokkan SHA rilis setelah merge. **Merge kode ini tidak mengotorisasi menjalankan migrasi G5 pada Supabase produksi.**