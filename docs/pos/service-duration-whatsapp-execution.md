# Eksekusi tambahan layanan, paket dan WhatsApp

> **Aktivasi konfigurasi Production — 3 November 2026, 15:47 WIB.** Atas instruksi eksplisit pengguna, outlet MJL sekarang write_enabled=true dan finance_enabled=true. Ini perubahan konfigurasi, bukan bukti G8 lulus. Package workflow masih false, paket/keluarga layanan aktif 0 dan kasir aktif 0; UI buat nota tetap memerlukan konfigurasi paket Owner melalui Pengaturan Layanan & Harga. Tidak menetapkan durasi/tarif rekaan atau mengubah izin kasir. Verifikasi sesudah aktivasi: orders/payments/cash/point-links 0, direct app DML grants 0. Histori Binatu/backfill tetap tidak dijalankan. Status readiness tetap NO_GO karena bukti UAT/identitas/restore belum lengkap; checker preflight tidak dilonggarkan. Lihat [receipt aktivasi](./financial-activation-20261103.md). Checkpoint OFF sebelumnya adalah histori sebelum aktivasi ini.


> **Production schema migrated — 3 November 2026.** Seluruh 21 migrasi POS source17430c0 telah diterapkan melalui konektor Supabase pada hncfyfvqtlnvqyfrydzb setelah izin schema eksplisit Owner. Production kini22/22 tabel POS ber-RLS,1 outlet; write_enabled=false, finance_enabled=false, package_workflow_enabled=false; orders/payments/cash/point-links 0 dan direct app DML grants 0. Seluruh1.546 fingerprint schema yang dibandingkan identik dengan QA, dan13 tabel lama pada kolom asalnya memiliki jumlah/hash identik. Backup logis13 tabel publik aplikasi dibuat terenkripsi DPAPI lokal sesudah3 migrasi pertama dan sebelum18 sisanya; decrypt/readback PASS, bukan full PostgreSQL restore/Auth/Storage backup. **G8 NO-GO untuk aktivasi finansial** sampai bukti keamanan/UAT/restore yang tersisa terpenuhi. Histori Binatu/backfill tidak diperlukan pada scope awal keputusan Owner; member/poin lama dipakai langsung. Checkpoint lama yang menyebut Production0tabel atau migrasi menunggu izin adalah histori yang telah digantikan receipt ini. Lihat [receipt migrasi](./production-migration-20261103.md).


> **Bukti terkini — 3 November 2026:** source `a502c0bce9638990d314db0f033a48df464b2e9f` lulus [release CI](https://github.com/warasjawa-laundry/Mas/actions/runs/41595889142) dan [database CI](https://github.com/warasjawa-laundry/Mas/actions/runs/41595889081): 284 Node, TypeScript, build, 93 browser; replay semua migrasi, SQL rollback, race dua koneksi dan restore sintetis PASS. Seluruh 1.546 fingerprint schema/RLS/hak efektif aplikasi QA identik dengan replay CI. Deployment existing Production `mas`, `dpl_9RVoM9zYWJT4dg1a8PMF2oeyDbFA`, READY pada SHA tersebut dan domain masjawalaundry.web.id. Production POS **0 tabel**, baseline legacy tetap sama; QA **22/22 RLS**, write/finance/package-mode OFF dan tidak ada transaksi/customer sintetis tersisa. **G8 NO-GO**, external evidence dan approval Production belum ada. Koreksi preflight terakhir mengubah kontrak 20 menjadi 22 tabel, dengan tes regresi red→green; tidak mengubah flag atau bukti bisnis. Paragraf checkpoint sebelumnya adalah histori, bukan status terkini. Lihat [receipt rilis](./release-20261103.md).


Keputusan Owner 3 November 2026: jam kalender; durasi disimpan Owner, tanpa menetapkan 72/24/6 sebagai tarif/durasi resmi. Template asli diberikan Owner di chat; nilai transaksi contoh tidak diimpor. Empat tahap menggantikan kontrak tiga tahap untuk katalog paket baru.

Dependensi: main c262a7f; database CI PASS pada run 41590525640, release CI menunggu. PR #30 diabaikan.

1. Additive QA migration: keluarga layanan tunggal, paket global, variant tarif/revisi, pengaturan template dan audit. Katalog lama tetap utuh; mode paket diaktifkan eksplisit oleh Owner setelah tarif terisi, tanpa membuka write/finance.
2. Wizard empat tahap dan satu paket per nota, perubahan paket meminta konfirmasi; backend memvalidasi katalog aktif dan melindungi snapshot.
3. Status Diproses dan serah terima hanya setelah lunas; guard database juga mencakup endpoint lama.
4. Draf WA membaca ulang nota/pembayaran/ledger, dipisahkan nota/siap/diambil; template Owner, kontak terverifikasi, salin bila tanpa nomor. Tidak ada status terkirim otomatis.
5. QA rollback fixtures, regresi, browser, race, CI SHA final. Production schema dan financial switch tetap memerlukan approval terpisah.

Status awal: IN_PROGRESS; physical UAT tetap PHYSICAL_UAT_REQUIRED.


## Tambahan terverifikasi lokal — 3 November 2026

Keputusan Owner terbaru: wizard **Pelanggan → Durasi → Layanan → Konfirmasi**, satu paket per nota, **jam kalender**; durasi dan tarif resmi diisi Owner. Ini menggantikan kontrak tiga tahap/mixed-duration untuk katalog paket yang diaktifkan. Snapshot nota lama tidak dibackfill atau diubah.

Lima migrasi tambahan 20261103070000–074000 telah diterapkan QA saja. Keluarga layanan satu record + tarif per paket; pemetaan opsional record lama mempertahankan service ID; paket default nonaktif/tanpa durasi/tanpa tarif contoh. Tombol aktivasi katalog tidak mengubah write_enabled atau finance_enabled.

Nota memakai harga/revisi otoritatif; backend menolak campuran paket pada mode paket. Diproses, ready_at, collected_at, histori aktor, tab Sudah Diambil dan detail pembatalan tersedia. Trigger database menolak serah terima Belum Bayar, DP, refund dan tagihan nol; tidak ada override.

Template WA asli Owner tersimpan sebagai konfigurasi berotorisasi dan berversi. Nota/Siap/Sudah Diambil membaca ulang receipt dan ledger periode aktual, menyembunyikan poin untuk guest, membedakan perkiraan dengan saldo aktif. Kontak diverifikasi untuk nota dengan audit aktor; link wa.me hanya sesudah pemeriksaan penerima. Tidak ada pengiriman otomatis atau status SENT. Sumber URL: https://faq.whatsapp.com/5913398998672934.

23 fixture SQL regresi QA lulus secara kolektif; satu pemeriksaan jumlah tabel G5 awal gagal karena 20 menjadi 22 dan diperbarui ke 22 tanpa mengurangi RLS/ACL. Tambahan uji menolak unpaid/DP/refund/zero handover, menguji posting poin/lunas, ID kontak idempotent, revoke izin WA dan histori aktor. 284 tes Node dan TypeScript lulus; build dan suite browser final dijalankan kembali pada tree akhir. Fixture browser bukan real Auth atau uji Android/print fisik.

CI main c262a7f lulus: Audit Release Gate dan Stage 10 PostgreSQL Concurrency QA (run 41590525471 / 41590525640). CI/deployment **paket tambahan** harus diverifikasi pada SHA berikutnya; belum dinyatakan PASS di checkpoint ini. Production belum dimigrasi. G8 tetap NO-GO.

Advisor QA: default-deny RLS INFO disengaja; 3 anonymous dan 9 authenticated SECURITY DEFINER RPC exposure warnings pada tambahan awal ditinjau sebagai endpoint yang berotorisasi, bukan akses publik tanpa pemeriksaan. Negative auth/revoke fixtures lulus; kontrol identitas ID-only kasir tetap blocker sebelum finance. Tidak menyatakan advisor bersih. Raw ACL provider berbeda dari CI; fingerprint membandingkan definisi, RLS dan hak efektif anon/authenticated/kolom. Perbedaan semantic tersisa harus dijelaskan sesudah artefak CI final tersedia.


Checkpoint lokal final: 284/284 Node, TypeScript, build Next.js dan 93/93 browser PASS. Browser menguji komponen/route dan fixture sintetis; bukan bukti sesi bisnis nyata, WhatsApp terkirim atau physical UAT. Dua CI paket tambahan dan deployment SHA final masih harus diperiksa. Bukti aktual final disimpan pada release receipt terpisah setelah CI/deployment, tanpa mengubah persyaratan G8.


## Estimasi tanggal dan jam otomatis — 3 November 2026

Owner memilih memakai katalog paket yang sudah dikerjakan. Wizard Owner/kasir sekarang menampilkan waktu masuk pratinjau dan estimasi selesai otomatis pada pilihan Durasi serta Konfirmasi. Perhitungan: waktu server + menit kalender paket, tampil dd/mm/yyyy - HH:mm WIB; perubahan paket memperbarui estimasi. Perhitungan menangani pergantian hari, bulan, tahun dan tahun kabisat. Jam pratinjau memakai timestamp server dan elapsed monotonic browser; database tetap menentukan created_at/due_at final saat simpan. Tanggal estimasi dari browser tidak dikirim sebagai otoritas ke RPC. Durasi resmi tetap diatur Owner; label rentang/unitless tidak diubah menjadi durasi rekaan. Harga/identitas layanan dan snapshot nota lama tidak berubah. Tidak ada migrasi database atau aktivasi finansial dari perubahan ini.

Bukti lokal sebelum integrasi: 5 tes kalender/durasi dan 8 tes browser wizard PASS; dua tes baru dijalankan RED sebelum implementasi. Suite final/CI/deployment dicatat pada output receipt setelah verifikasi. G8 tetap NO-GO sampai bukti eksternal tersedia.

Verifikasi lokal akhir estimasi kalender: 290/290 Node, TypeScript, build dan 93/93 browser PASS. Fixture SSR lama sempat gagal karena dependensi helper baru belum dimuat; ditambah import helper aktual, assertions HTML escaping dan disabled submission tetap. Screenshot konfirmasi 320px diperiksa, tidak overflow; kontrol paket/regresi transaksi tetap lulus. CI/deployment SHA baru menunggu pemeriksaan pasca-integrasi.
