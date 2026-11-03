# G8 Controlled Cutover — satu outlet MJL

> **Aktivasi konfigurasi Production — 3 November 2026, 15:47 WIB.** Atas instruksi eksplisit pengguna, outlet MJL sekarang write_enabled=true dan finance_enabled=true. Ini perubahan konfigurasi, bukan bukti G8 lulus. Package workflow masih false, paket/keluarga layanan aktif 0 dan kasir aktif 0; UI buat nota tetap memerlukan konfigurasi paket Owner melalui Pengaturan Layanan & Harga. Tidak menetapkan durasi/tarif rekaan atau mengubah izin kasir. Verifikasi sesudah aktivasi: orders/payments/cash/point-links 0, direct app DML grants 0. Histori Binatu/backfill tetap tidak dijalankan. Status readiness tetap NO_GO karena bukti UAT/identitas/restore belum lengkap; checker preflight tidak dilonggarkan. Lihat [receipt aktivasi](./financial-activation-20261103.md). Checkpoint OFF sebelumnya adalah histori sebelum aktivasi ini.


> **Production schema migrated — 3 November 2026.** Seluruh 21 migrasi POS source17430c0 telah diterapkan melalui konektor Supabase pada hncfyfvqtlnvqyfrydzb setelah izin schema eksplisit Owner. Production kini22/22 tabel POS ber-RLS,1 outlet; write_enabled=false, finance_enabled=false, package_workflow_enabled=false; orders/payments/cash/point-links 0 dan direct app DML grants 0. Seluruh1.546 fingerprint schema yang dibandingkan identik dengan QA, dan13 tabel lama pada kolom asalnya memiliki jumlah/hash identik. Backup logis13 tabel publik aplikasi dibuat terenkripsi DPAPI lokal sesudah3 migrasi pertama dan sebelum18 sisanya; decrypt/readback PASS, bukan full PostgreSQL restore/Auth/Storage backup. **G8 NO-GO untuk aktivasi finansial** sampai bukti keamanan/UAT/restore yang tersisa terpenuhi. Histori Binatu/backfill tidak diperlukan pada scope awal keputusan Owner; member/poin lama dipakai langsung. Checkpoint lama yang menyebut Production0tabel atau migrasi menunggu izin adalah histori yang telah digantikan receipt ini. Lihat [receipt migrasi](./production-migration-20261103.md).


> **Bukti terkini — 3 November 2026:** source `a502c0bce9638990d314db0f033a48df464b2e9f` lulus [release CI](https://github.com/warasjawa-laundry/Mas/actions/runs/41595889142) dan [database CI](https://github.com/warasjawa-laundry/Mas/actions/runs/41595889081): 284 Node, TypeScript, build, 93 browser; replay semua migrasi, SQL rollback, race dua koneksi dan restore sintetis PASS. Seluruh 1.546 fingerprint schema/RLS/hak efektif aplikasi QA identik dengan replay CI. Deployment existing Production `mas`, `dpl_9RVoM9zYWJT4dg1a8PMF2oeyDbFA`, READY pada SHA tersebut dan domain masjawalaundry.web.id. Production POS **0 tabel**, baseline legacy tetap sama; QA **22/22 RLS**, write/finance/package-mode OFF dan tidak ada transaksi/customer sintetis tersisa. **G8 NO-GO**, external evidence dan approval Production belum ada. Koreksi preflight terakhir mengubah kontrak 20 menjadi 22 tabel, dengan tes regresi red→green; tidak mengubah flag atau bukti bisnis. Paragraf checkpoint sebelumnya adalah histori, bukan status terkini. Lihat [receipt rilis](./release-20261103.md).


> **Checkpoint terkini sebelum final CI (2 Nov 2026): PROVISIONAL / G8 NO-GO.** Root mengonfirmasi ketiga migrasi canonical telah diterapkan **QA saja**: `20261102190000_pos_owner_creation_duration_snapshots.sql`, `20261102193000_pos_owner_operations_shared_cores.sql`, `20261102210000_pos_import_review_audit.sql`. Fixture owner duration, owner operations, import audit dan regresi existing G5/G6/G2 PASS setelah apply. `write_enabled=false` dan `finance_enabled=false`. Lima browser test wizard sintetis PASS pada 320/390/1440px memakai mocks; ini bukan real Auth atau PHYSICAL_UAT. Synthetic restore dan race tambahan menunggu CI yang akan datang, **belum PASS**. Final tree/CI dan deployment paket baru belum disertifikasi. Produksi tetap 0 tabel POS; tidak ada mutasi produksi. Lihat [master audit](./master-audit-20261102.md) untuk dependensi dan bukti penutupan.

**Status per 2 Nov 2026: NO-GO.** Source POS sudah di GitHub `main`/Vercel `mas` namun database produksi belum memiliki tabel POS. Tidak ada keputusan owner untuk aktivasi transaksi produksi. Jangan menjalankan SQL, menyalakan flag, atau mengimpor data pelanggan dari dokumen ini tanpa approval eksplisit.

## Urutan wajib; tidak ada deployment staging
1. Freeze SHA GitHub `main`, cocokkan build Vercel Production `masjawalaundry.web.id` yang aktif. Koneksi Git Vercel tetap `unyilhm1-hue/mas`, jangan reconnect; tidak membuat proyek baru.
2. Ambil baseline **read-only** jumlah member, kartu, kunjungan ADD/VOID, snapshot amount, aturan poin, saldo kas yang relevan dan checksum migrasi. Angka baseline 2 Nov: 785 member, 18 kartu, 21 events, 19 amount snapshots, 0 tabel POS (angka historis, **bukan** nilai saat cutover).
3. Konfirmasi jalur backup/restore **dengan bukti restore rehearsal** dan perjanjian RPO/RTO. Tidak tersedia alat backup saat sesi ini; **belum diverifikasi**.
4. Lengkapi [UAT perangkat 25 screen](./uat.md), race 2 session CI dan QA with live authenticated owner/device, lint RLS/FK; review harga/durasi/ongkir/discount yang masih gap, no P0/P1.
5. Rekonsiliasi laporan Binatu dengan nota unik, paid-as-of, piutang pembukaan, tanggal cutoff WIB, dan event poin manual lama; tentukan source-of-truth tunggal. Impor tetap **non-posting**.
6. Setelah owner memberi **approval migrasi schema terpisah**, jalankan migrasi additive POS berurutan pada produksi dengan semua write flags **off**. Tidak pernah copy data QA atau secret QA. Verifikasi 22 tabel RLS dan tidak ada direct grant; bandingkan baseline member/kartu/ledger lama; periksa RPC live dalam mode read-only dan audit.
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


### Tambahan 3 November 2026

Tambahan katalog/WA tidak membuka uang. Setelah approval migrasi produksi terpisah, konfigurasi paket durasi jam kalender dan tarif resmi, petakan record lama, review template asli Owner, baru aktifkan package_workflow_enabled melalui UI. Kedua flag transaksi tetap OFF. Tidak memakai tarif contoh atau transaksi contoh. Cutover finansial/pilot tetap memerlukan bukti G8 dan approval tersendiri.


## Uji POS sebelum go-live Januari 2027
Pilot data dummy tidak sama dengan G8 GO. Hanya nota pelanggan umum `UJI - ...` yang boleh tercatat selama `pilot_test_only=true`; trigger SQL menolak pelanggan member dan point-link pada nota uji. Wajib rekonsiliasi semua order, pembayaran, cash ledger dan kas shift tes, kemudian arsipkan/reset secara terkontrol sebelum mengizinkan transaksi nyata. Data pelanggan/member dipertahankan dan backup/restore wajib. Catat waktu, reviewer, source SHA, serta state flags saat mulai/hentikan pilot. Jalur STOP: `write_enabled=false` dan `finance_enabled=false` lewat operator DB, lalu review commands/receipts; jangan hapus ledger. G8 preflight tetap menolak GO dengan financial flags ON dan evidence yang belum lengkap. Lihat [pilot test](./pilot-test-20261103.md).


## Status pilot yang sedang aktif — 3 November 2026
Mode uji dummy Production sudah diverifikasi pada commit kode `ae5da9d7`. `pilot_test_only=true`, katalog ON, finansial ON **untuk simulasi**, 0 nota/payment/cash/point-links ketika diaktifkan, 785 pelanggan tidak diubah. G8 masih NO_GO dan tidak ada izin transaksi pelanggan nyata. Saat pilot diakhiri, gunakan prosedur STOP dan rekonsiliasi/arsip/reset test ledger sebelum go-live 2027. Detail: [receipt pilot](./pilot-activation-20261103.md).
