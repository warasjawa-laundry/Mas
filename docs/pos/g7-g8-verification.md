# Paket C G7/G8 technical verification — 2 November 2026

**Verdict: G7 automated portion in progress; G8 CUTOVER BLOCKED.** Tidak melakukan migrasi produksi, write flags tetap off.

## Bukti telah diperiksa
- Read-only prod Supabase `hncfyfvqtlnvqyfrydzb`: **785 member, 18 kartu, 21 visit events, 19 amount rows, 0 tabel POS** pada awal Paket C.
- QA `cwxsbgfjynwxqalwonae`: 20 tabel POS, 0 enabled outlet, 0 order; migrasi G7 QR/board diterapkan dengan operasi khusus QA, regression synthetic rollback aktif/revoked/inactive, permission/revoke, fake device dan QR read-only **PASS**.
- SQL G7 hanyalah dua fungsi pembaca yang membutuhkan token kasir; tidak memperluas izin tabel, tidak membuat ADD/pembayaran. Input URL QR validasi dan hash server; gambar tetap dibaca lokal.
- Perbaikan UI G7: scanner kasir kamera/galeri (tidak auto award), tab pesanan aktif, warna kuning/identitas Mas Jawa. **Belum dikonfirmasi pada Android fisik**.
- G7 race CI PostgreSQL 17 dijadwalkan dua koneksi (satu request UUID idempotent dan dua UUID berbeda untuk nota sama); bukti PASS hanya sah jika GitHub Action selesai sukses.
- G8 preflight lint fail-closed untuk backup rehearsal, live owner/cashier UAT, physical QR, 25 visual, perpindahan saldo, owner approval dan SHA Production; config saat ini **NO-GO**.

## Temuan / blockers
- QR kamera permission, gallery dari Android, scan kartu fisik dan offline recovery belum diuji pada HP pemilik.
- 25 screenshot paritas menyeluruh belum ditandatangani; fitur bottom sheet durasi, diskon, ongkir, preset parfum dan member name search belum dipenuhi (lihat [audit UI](./ui-parity-audit.md)).
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
