# G8 Controlled Cutover — satu outlet MJL

**Status per 2 Nov 2026: NO-GO.** Source POS sudah di GitHub `main`/Vercel `mas` namun database produksi belum memiliki tabel POS. Tidak ada keputusan owner untuk aktivasi transaksi produksi. Jangan menjalankan SQL, menyalakan flag, atau mengimpor data pelanggan dari dokumen ini tanpa approval eksplisit.

## Urutan wajib; tidak ada deployment staging
1. Freeze SHA GitHub `main`, cocokkan build Vercel Production `masjawalaundry.web.id` yang aktif. Koneksi Git Vercel tetap `unyilhm1-hue/mas`, jangan reconnect; tidak membuat proyek baru.
2. Ambil baseline **read-only** jumlah member, kartu, kunjungan ADD/VOID, snapshot amount, aturan poin, saldo kas yang relevan dan checksum migrasi. Angka baseline 2 Nov: 785 member, 18 kartu, 21 events, 19 amount snapshots, 0 tabel POS (angka historis, **bukan** nilai saat cutover).
3. Konfirmasi jalur backup/restore **dengan bukti restore rehearsal** dan perjanjian RPO/RTO. Tidak tersedia alat backup saat sesi ini; **belum diverifikasi**.
4. Lengkapi [UAT perangkat 25 screen](./uat.md), race 2 session CI dan QA with live authenticated owner/device, lint RLS/FK; review harga/durasi/ongkir/discount yang masih gap, no P0/P1.
5. Rekonsiliasi laporan Binatu dengan nota unik, paid-as-of, piutang pembukaan, tanggal cutoff WIB, dan event poin manual lama; tentukan source-of-truth tunggal. Impor tetap **non-posting**.
6. Setelah owner memberi **approval migrasi schema terpisah**, jalankan migrasi additive POS berurutan pada produksi dengan semua write flags **off**. Tidak pernah copy data QA atau secret QA. Verifikasi 20 tabel RLS dan tidak ada direct grant; bandingkan baseline member/kartu/ledger lama; periksa RPC live dalam mode read-only dan audit.
7. Isi `docs/pos/g8-readiness.json` hanya dengan bukti nyata + reviewer untuk setiap gate (jangan mengubah PASS dari dugaan), jalankan `node scripts/pos-g8-preflight.mjs docs/pos/g8-readiness.json`. Output NO-GO menghalangi keputusan aktivasi.
8. Dapatkan **approval cutover dan aktivasi pilot spesifik** dari owner setelah receipt lolos, lalu nyalakan hanya satu outlet/shift dalam jendela perubahan yang diawasi; transaksi G4/G5/G6 memerlukan audit harian, rekonsiliasi kas/piutang/poin dan kemampuan stop-write DB.
9. Go/No-Go monitor setiap shift; owner menandatangani penerimaan ketika seluruh constraint, tes fisik, rekonsiliasi stabil. Jangan memperluas cabang.

## Batas yang tidak bisa disubstitusi
- CI hijau ≠ backup restore terbukti; SQL rollback synthetic ≠ benar-benar restore backup; Vercel READY ≠ pembayaran live siap.
- Script preflight **tidak menjalankan SQL/enable/deploy**; receipt manusia tanpa bukti jelas harus gagal.
- Tidak mengubah Supabase produksi, koneksi Git, schema, kartu maupun poin selama gate belum lengkap.
- Jika sebagian gate gagal, gunakan [protokol STOP/rollback](./rollback.md), bukan mengedit jurnal secara langsung.
