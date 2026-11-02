> **Koreksi berlaku 2 Nov 2026:** syarat owner pairing yang dijelaskan di bawah adalah **riwayat desain**, bukan lagi login kasir saat ini. Kasir langsung memasukkan ID 4 angka `MAS-XXXX` tanpa password atau aktivasi perangkat. Lihat [G3 direct ID login](./g3-direct-id-login-verification.md) dan Implementation Plan V2 terbaru. Produksi tetap NO-GO sampai review keamanan dan migrasi disetujui.

# POS G3 — satu outlet, kasir tanpa password, dikelola owner

**Tanggal:** 1 November 2026. **Keputusan terbaru owner:** bukan aplikasi multi-outlet dan pegawai kasir tidak memerlukan ID/password. Satu-satunya login tetap pada pemilik melalui `/admin/login` (mekanisme lama tidak diubah).

## Alur pemilik dan pegawai

1. Owner login ke `/admin`, pilih **Pengaturan → Kelola Kasir** (`/admin/pos/kasir`).
2. Owner menambah nama kasir, memilih izin granular, lalu database memberi username berurutan `MAS-0001`, `MAS-0002`, dan seterusnya. Tidak membuat akun Auth, password atau PIN kasir. Nomor tetap saat rename dan tidak reused saat kasir dinonaktifkan.
3. Owner masuk di HP/komputer kasir dengan akun owner, membuka daftar kasir dan menekan **Aktifkan di perangkat ini**. Backend menerbitkan token acak kriptografis 32 byte (43 karakter base64url). Database hanya menyimpan SHA-256 token tersebut.
4. Setelah token terbit, owner `signOut` lokal dan cookie admin dihapus. Kasir membuka `/kasir`, **mengetik username MAS-XXXX tanpa password**; username harus tepat untuk kasir yang dipair pada perangkat tersebut. Server menerbitkan token login kedua HttpOnly/Secure/SameSite Strict (maks. 12 jam); token perangkat berlaku maks. 7 hari. Tidak ada owner settings dari sesi kasir.
5. Untuk mengubah izin, owner membuka `/admin/pos/kasir` dari perangkat yang telah login sebagai owner. Izin berlaku pada pembacaan sesi berikutnya, bukan dari cache role/browser. Owner dapat **Cabut semua perangkat** atau **Hapus kasir**. Hapus = nonaktif + cabut akses saat itu juga; data audit tidak dihapus. Token juga berakhir otomatis setelah tujuh hari.
6. **Tidak ada transaksi POS yang diaktifkan**. `/kasir` menampilkan form username sesudah pairing, lalu informasi kasir hanya setelah validasi dua token. Logout menghapus login kasir, bukan pairing; lepas perangkat/revoke owner memutus akses penuh. Nota/pembayaran menunggu G4/G5.

## Outlet tetap

- Nama: **Mas Jawa Laundry**; kode internal **MJL**.
- Alamat sesuai `lib/site.ts`: **Jl. Raya Kandang Jati Kulon RT.06 RW.01, Kandang Jati Kulon, Probolinggo** (patokan: depan Masjid Al-Hidayah).
- `laundry_pos_outlets` dibatasi satu baris melalui `singleton_key=1` + UNIQUE. Tidak ada layar ataupun RPC untuk menambah cabang. Outlet awal aktif agar dapat dibaca, tetapi **`write_enabled=false`** sehingga nota/pembayaran tidak dapat diposting.
- `laundry_members.id` dan seluruh kartu/QR/riwayat poin lama tidak diubah. Tidak ada ID member per cabang.

## Keamanan dan batas fitur

- Tabel staff G2 dipertahankan tetapi `auth_user_id` dinamakan ulang menjadi `staff_id` UUID internal, tidak lagi mereferensikan `auth.users`. Staff tidak masuk ke `laundry_owner_accounts` dan tidak dapat memanggil fungsi owner-only.
- Hak izin: `order_view`, `order_create`, `order_work`, `member_lookup`, `payment_collect`, `receipt_print`, `whatsapp_draft`, `cash_view`, `cash_entry`, `reports_view`, `refund_full`; semua bertipe boolean dan divalidasi berdasarkan whitelist. Owner-only seperti aturan poin, reissue QR, manajemen kasir, ekspor PII tetap di luar daftar.
- `pos_owner_*` RPC memeriksa `auth.uid()` terhadap owner aktif di DB. Tabel kasir/device/audit tetap RLS + tanpa akses tabel browser. Fungsi `cashier_session` hanya mengembalikan data minimal bila pemanggil memiliki **token mentah** yang aktif, valid dan belum dicabut. Token tidak dikembalikan melalui UI.
- **Kendala G5 penting:** skema finansial G2 (`orders.created_by`, `payments.confirmed_by`, `cash_shifts.opened_by`, dan ledger poin lama) masih menyimpan FK actor `auth.users`. Sebelum menerima uang kasir tanpa password, seluruh command finansial harus memisahkan `owner_id` dari `staff_id` dengan FK dan audit yang benar. Tidak boleh mengisi `owner_id` palsu atau meminjam sesi owner setelah pairing. Tugas ini tetap BLOCKED hingga G5/G2-financial bridge selesai dan diuji.
- Satu token perangkat adalah credential bearer, bukan klaim bahwa kasir bebas risiko. Perangkat harus dikunci secara fisik; owner dapat mencabut segera jika hilang. Jangan menaruh token dalam localStorage, query URL, log, atau HTML.

## Bukti QA dan batas penerimaan

- **Penyesuaian regresi G2 setelah G3:** tes lama awalnya mengasumsikan 17 tabel dan belum ada outlet. Sesudah migrasi G3 ada **19 tabel** dan **satu outlet MJL tetap**; pengujian G2 kini memverifikasi kondisi baru, serta tetap menolak outlet kedua dan transaksi yang write-enabled. Perubahan ini diperiksa lulus di QA sebelum CI diulang.

- Migrasi tambahan: `supabase/migrations/20261101155000_pos_single_outlet_owner_managed_cashier.sql`.
- Test: `supabase/tests/pos-single-outlet-passwordless-cashier.sql` (synthetic owner and staff, transaction rollback); Node `tests/pos-cashier-*.test.mjs`.
- Pada Supabase QA `cwxsbgfjynwxqalwonae`: migrasi dan tes SQL **lulus**; satu outlet dan anon tanpa izin owner, token salah/expired/revoked gagal, izin dinamis, soft-delete, audit, dan fungsi owner lama tidak diperluas. Seluruh test data sintetik di-rollback.
- CI Stage 10 menjalankan replay semua migrasi dan tes skema di PostgreSQL 17. Tes Node unit bertujuan mengonfirmasi whitelist dan token, bukan menggantikan uji Android fisik/authenticated real browser.
- **Database produksi `hncfyfvqtlnvqyfrydzb` belum dimigrasi**, sehingga halaman owner menampilkan pesan fitur belum tersedia di produksi dan tidak membuat kasir sungguhan. Deployment aplikasi ke Vercel Production tidak otomatis menerapkan migrasi SQL.
- **Belum lulus:** uji perangkat autentikasi owner→kasir→revoke fisik; transaksi pembayaran, potong poin, shift kas, refund, akses lintas outlet (tidak berlaku karena hanya satu outlet), keamanan akses owner saat sesi kasir, backup/restore serta cutover.

**Strategi kuota CI:** seluruh migrasi, halaman owner/kasir, tes, dan pembaruan plan dikirim sebagai **satu PR dan satu push konsolidasi**; merge setelah pemeriksaan lulus.
## Penambahan username urut MAS-XXXX (1 November 2026)

Migrasi `20261101172500_pos_cashier_sequential_username_login.sql` dan tes `pos-cashier-sequential-username-login.sql` sudah berhasil di Supabase QA, tanpa mengubah produksi. Counter di outlet tunggal mengalokasikan `MAS-0001` sampai `MAS-9999` berurutan dan mengunci row agar permintaan concurrent tidak menduplikasi ID. ID tidak berubah oleh rename dan tidak reuse saat kasir dihapus. Username adalah ID publik, **bukan password**; perangkat harus diaktifkan owner untuk kasir yang bersangkutan. Login memerlukan username tepat, token perangkat, dan token login kedua. Lima username salah mengunci 5 menit; sesi login 12 jam, pairing 7 hari; per-request verifikasi DB dan owner revoke tetap berlaku. Test SQL rollback mencakup owner-only, nomor urut, edit, delete, mismatch kasir/perangkat, login ulang, logout, penguncian dan revoke. Node test parser/login UI melengkapi QA.

Regresi G2 disesuaikan dari 19 menjadi **20 tabel** setelah tabel sesi login, tanpa menurunkan RLS. **UAT perangkat nyata, migrasi DB produksi, dan aktivasi finansial belum dilakukan.**

**CI regression tetap:** `.github/workflows/stage10-postgres-concurrency.yml` menjalankan `pos-cashier-sequential-username-login.sql` setelah migrasi penuh pada PostgreSQL 17 CI lokal. SQL QA manual saja tidak cukup sebagai gate berkelanjutan.
