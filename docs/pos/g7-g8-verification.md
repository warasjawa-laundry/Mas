# Paket C G7/G8 technical verification — 2 November 2026

> **Checkpoint terkini sebelum final CI (2 Nov 2026): PROVISIONAL / G8 NO-GO.** Root mengonfirmasi ketiga migrasi canonical telah diterapkan **QA saja**: `20261102190000_pos_owner_creation_duration_snapshots.sql`, `20261102193000_pos_owner_operations_shared_cores.sql`, `20261102210000_pos_import_review_audit.sql`. Fixture owner duration, owner operations, import audit dan regresi existing G5/G6/G2 PASS setelah apply. `write_enabled=false` dan `finance_enabled=false`. Lima browser test wizard sintetis PASS pada 320/390/1440px memakai mocks; ini bukan real Auth atau PHYSICAL_UAT. Synthetic restore dan race tambahan menunggu CI yang akan datang, **belum PASS**. Final tree/CI dan deployment paket baru belum disertifikasi. Produksi tetap 0 tabel POS; tidak ada mutasi produksi. Lihat [master audit](./master-audit-20261102.md) untuk dependensi dan bukti penutupan.

**Verdict: G7 automated portion in progress; G8 CUTOVER BLOCKED.** Tidak melakukan migrasi produksi, write flags tetap off.

## Bukti telah diperiksa
- Read-only prod Supabase `hncfyfvqtlnvqyfrydzb`: **785 member, 18 kartu, 21 visit events, 19 amount rows, 0 tabel POS** pada awal Paket C.
- QA `cwxsbgfjynwxqalwonae`: 20 tabel POS, 0 enabled outlet, 0 order; migrasi G7 QR/board diterapkan dengan operasi khusus QA, regression synthetic rollback aktif/revoked/inactive, permission/revoke, fake device dan QR read-only **PASS**.
- Lingkup historis SQL G7 QR/board adalah fungsi pembaca yang membutuhkan token kasir; tidak memperluas izin tabel, tidak membuat ADD/pembayaran. Input URL QR validasi dan hash server; gambar tetap dibaca lokal.
- Perbaikan UI G7: scanner kasir kamera/galeri (tidak auto award), tab pesanan aktif, warna kuning/identitas Mas Jawa. **Belum dikonfirmasi pada Android fisik**.
- G7 race CI PostgreSQL 17 dijadwalkan dua koneksi (satu request UUID idempotent dan dua UUID berbeda untuk nota sama); bukti PASS hanya sah jika GitHub Action selesai sukses.
- G8 preflight lint fail-closed untuk backup rehearsal, live owner/cashier UAT, physical QR, 25 visual, perpindahan saldo, owner approval dan SHA Production; config saat ini **NO-GO**.

## Temuan / blockers
- QR kamera permission, gallery dari Android, scan kartu fisik dan offline recovery belum diuji pada HP pemilik.
- 25 screenshot paritas menyeluruh belum ditandatangani; wizard tiga tahap, pencarian nama dan preset parfum tersedia; diskon/ongkir masih diblokir sampai kontrak bisnis; visual dan perangkat nyata belum dipenuhi (lihat [audit UI](./ui-parity-audit.md)).
- Tidak ada bukti backup→restore rehearsal untuk DB produksi; Supabase tool yang tersedia tidak menyediakan backup/restore di sesi ini.
- Tidak ada approval eksplisit cutover owner, tarif/piutang Binatu masih butuh konfirmasi, dan DB produksi belum memiliki tabel POS.
- Mutasi/close-shift fisik, WA consent, actual printer, regression old QR/member real hardware, post-commit network loss UAT belum terbukti.
- Di QA migration history terjadi entri `pos_g7_readonly_qr_and_order_board` yang hanya berisi komentar sebelum DDL sesungguhnya dicatat sebagai `pos_g7_readonly_qr_and_order_board_ddl`. **Jangan samakan nama entri tersebut dengan migrasi source.** Pada cutover gunakan SQL canonical `20261102063000_pos_g7_cashier_qr_lookup.sql`, cek checksum dan rekonsiliasi histori QA, jangan copy histori QA ke produksi.

## Kebijakan
Satu source repo `warasjawa-laundry/Mas` → satu PR batch → merge `main` setelah CI, hanya proyek Vercel Production `mas` saat kode aman. Git connection tetap `unyilhm1-hue/mas`. Tidak ada deployment staging, tidak ada perubahan database produksi, **G8 belum diaktifkan**. Lihat [UAT](./uat.md), [cutover](./cutover.md), [rollback](./rollback.md), [monitoring](./monitoring.md).


## G7 continuation — katalog dan pencarian member (2 Nov 2026)

- Migrasi `pos_g7_member_name_prefix_safe` diuji dan dijalankan hanya pada Supabase QA, dengan helper `laundry_pos_g7_member_name`; regresi SQL roll-back: dua member bernama sama tetap dua nomor unik, member nonaktif tidak tampil, prefix pendek/tanda wildcard tidak memperluas hasil, perangkat salah/izin dicabut ditolak, tidak menambah kunjungan atau poin. **PASS**.
- Canonical source: `supabase/migrations/20261102074500_pos_g7_member_name_search.sql`. Catatan: selama verifikasi fungsi QA diperbaiki melalui tambahan migration receipt QA `pos_g7_member_name_prefix_fix_qa` setelah pertama kali percobaan `pg_catalog.coalesce` gagal; source canonical sudah diperbaiki dan akan replay dari nol oleh CI. **Jangan menyalin histori QA ke produksi**.
- Wizard source menampilkan durasi nyata katalog dan menggunakan harga layanan SQL, bukan tarif ekspres buatan. Pencarian nama manual diperkecil ke nama + nomor, tidak menampilkan HP/alamat. Preset parfum tanpa biaya. Diskon/ongkir sengaja nonaktif hingga policy dan RPC ditetapkan owner.
- Tes Node `tests/pos-g7-catalog-ux.test.mjs` dan regresi SQL `pos-g7-member-name-rollback.sql` masuk satu PR; klaim PASS CI hanya setelah GitHub benar-benar selesai.
- **Tidak ada bukti baru G8**: physical UAT/QR, pixel parity, restore rehearsal, opening receivables, owner sign-off, dan migrasi produksi tetap BLOCKED.


## Audit aktual susulan G8 — 2 November 2026
- Bukti agregat terbaru dan QA RPC baca-saja Owner: [G8 audit aktual](./g8-audit-20261102.md). Tetap NO-GO. 20 tabel QA ber-RLS, direct write grant 0, QA owner RPC berhasil diterapkan; Production POS 0 tabel tanpa migrasi. Bukan tanda terima cutover.
- Wizard baru tiga langkah dan durasi di tiap layanan mengikuti keputusan Owner; snapshot ETA per-item known-only kini tersedia QA melalui migrasi 190000; policy ETA, range/blank PENDING dan cetak perlu signoff G8 sebelum invoice live.


## Tambahan terverifikasi lokal — 3 November 2026

Keputusan Owner terbaru: wizard **Pelanggan → Durasi → Layanan → Konfirmasi**, satu paket per nota, **jam kalender**; durasi dan tarif resmi diisi Owner. Ini menggantikan kontrak tiga tahap/mixed-duration untuk katalog paket yang diaktifkan. Snapshot nota lama tidak dibackfill atau diubah.

Lima migrasi tambahan 20261103070000–074000 telah diterapkan QA saja. Keluarga layanan satu record + tarif per paket; pemetaan opsional record lama mempertahankan service ID; paket default nonaktif/tanpa durasi/tanpa tarif contoh. Tombol aktivasi katalog tidak mengubah write_enabled atau finance_enabled.

Nota memakai harga/revisi otoritatif; backend menolak campuran paket pada mode paket. Diproses, ready_at, collected_at, histori aktor, tab Sudah Diambil dan detail pembatalan tersedia. Trigger database menolak serah terima Belum Bayar, DP, refund dan tagihan nol; tidak ada override.

Template WA asli Owner tersimpan sebagai konfigurasi berotorisasi dan berversi. Nota/Siap/Sudah Diambil membaca ulang receipt dan ledger periode aktual, menyembunyikan poin untuk guest, membedakan perkiraan dengan saldo aktif. Kontak diverifikasi untuk nota dengan audit aktor; link wa.me hanya sesudah pemeriksaan penerima. Tidak ada pengiriman otomatis atau status SENT. Sumber URL: https://faq.whatsapp.com/5913398998672934.

23 fixture SQL regresi QA lulus secara kolektif; satu pemeriksaan jumlah tabel G5 awal gagal karena 20 menjadi 22 dan diperbarui ke 22 tanpa mengurangi RLS/ACL. Tambahan uji menolak unpaid/DP/refund/zero handover, menguji posting poin/lunas, ID kontak idempotent, revoke izin WA dan histori aktor. 284 tes Node dan TypeScript lulus; build dan suite browser final dijalankan kembali pada tree akhir. Fixture browser bukan real Auth atau uji Android/print fisik.

CI main c262a7f lulus: Audit Release Gate dan Stage 10 PostgreSQL Concurrency QA (run 41590525471 / 41590525640). CI/deployment **paket tambahan** harus diverifikasi pada SHA berikutnya; belum dinyatakan PASS di checkpoint ini. Production belum dimigrasi. G8 tetap NO-GO.

Advisor QA: default-deny RLS INFO disengaja; 3 anonymous dan 9 authenticated SECURITY DEFINER RPC exposure warnings pada tambahan awal ditinjau sebagai endpoint yang berotorisasi, bukan akses publik tanpa pemeriksaan. Negative auth/revoke fixtures lulus; kontrol identitas ID-only kasir tetap blocker sebelum finance. Tidak menyatakan advisor bersih. Raw ACL provider berbeda dari CI; fingerprint membandingkan definisi, RLS dan hak efektif anon/authenticated/kolom. Perbedaan semantic tersisa harus dijelaskan sesudah artefak CI final tersedia.


Checkpoint lokal final: 284/284 Node, TypeScript, build Next.js dan 93/93 browser PASS. Browser menguji komponen/route dan fixture sintetis; bukan bukti sesi bisnis nyata, WhatsApp terkirim atau physical UAT. Dua CI paket tambahan dan deployment SHA final masih harus diperiksa. Bukti aktual final disimpan pada release receipt terpisah setelah CI/deployment, tanpa mengubah persyaratan G8.
