# G8 Controlled Cutover — satu outlet MJL

> **Checkpoint terkini sebelum final CI (2 Nov 2026): PROVISIONAL / G8 NO-GO.** Root mengonfirmasi ketiga migrasi canonical telah diterapkan **QA saja**: `20261102190000_pos_owner_creation_duration_snapshots.sql`, `20261102193000_pos_owner_operations_shared_cores.sql`, `20261102210000_pos_import_review_audit.sql`. Fixture owner duration, owner operations, import audit dan regresi existing G5/G6/G2 PASS setelah apply. `write_enabled=false` dan `finance_enabled=false`. Lima browser test wizard sintetis PASS pada 320/390/1440px memakai mocks; ini bukan real Auth atau PHYSICAL_UAT. Synthetic restore dan race tambahan menunggu CI yang akan datang, **belum PASS**. Final tree/CI dan deployment paket baru belum disertifikasi. Produksi tetap 0 tabel POS; tidak ada mutasi produksi. Lihat [master audit](./master-audit-20261102.md) untuk dependensi dan bukti penutupan.

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


## Tambahan blocker pasca keputusan UI terbaru
- Jangan GO jika penulisan nota oleh Owner belum memakai actor Owner pada RPC SQL tersendiri, jika durasi per item belum disimpan konsisten pada invoice/due date, atau jika risiko login karyawan ID empat angka belum di-review secara eksplisit.
- Lihat hasil agregat QA dan Production pada [G8 audit aktual](./g8-audit-20261102.md). Migrasi owner create/operations/audit yang sudah dijalankan hanya di QA tidak berarti migrasi Production boleh berjalan.


**Pemilik tindakan eksternal:** Owner bersama reviewer keamanan/operator jaringan memilih dan menguji trusted workplace network yang benar-benar dibatasi atau kontrol identitas lebih kuat; ID-only known-ID impersonation tidak diselesaikan throttle. Operator DB membuktikan backup/restore produksi aman dan RPO/RTO; Owner+kasir/tester membuktikan real Auth, Android, uang/print dan visual; Owner+pemeriksa keuangan menandatangani cutoff/saldo/piutang/poin; Owner+operator release memberi approval schema dan cutover secara terpisah. Bukti/reviewer/timestamp privat wajib; semua masih BLOCKED sampai tersedia. [Daftar acceptance dan penanggung jawab](./master-audit-20261102.md#tindakan-eksternal-wajib-dan-pemilik-bukti).
