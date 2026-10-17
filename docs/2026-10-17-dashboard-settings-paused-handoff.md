# Dokumentasi perbaikan dan pengaturan yang ditunda
Mas Jawa Laundry · 17 Oktober 2026, 18.48 WIB

## Status terakhir

Pekerjaan pengaturan dashboard dihentikan atas instruksi pengguna. Tidak ada branch protection, pengaturan password Supabase, atau klasifikasi secret Vercel yang diubah melalui dashboard. Ketiga layanan meminta login pada browser sesi ini; tidak ada kredensial yang dimasukkan atau dikirim. Tab sementara sudah ditutup.

Perbaikan aplikasi dan maintenance database yang selesai sebelumnya tetap berlaku. Dokumen ini mencatat keadaan tersebut agar pekerjaan dapat dilanjutkan tanpa mengulang perubahan yang sudah selesai.

## Referensi kandidat yang sudah diuji

| Komponen | Referensi |
|---|---|
| Repo | warasjawa-laundry/Mas |
| PR | [PR #12](https://github.com/warasjawa-laundry/Mas/pull/12), masih draft |
| Branch kandidat | feature/admin-operations-reliability-20261017 |
| Commit aplikasi yang diuji | 1819d174c31b9fd4b20c16db5408b98a6f2921e8 |
| Main saat perbaikan diserahkan | f742b8ada74091672c882da2a0b4cf09ae20beb4 |
| Preview QA | [Buka Preview](https://mas-git-feature-admin-operat-e444d5-m8traders-projects-081d9dc2.vercel.app/) |
| Deployment | dpl_2AgqcrCZEgoBLTQw76MKYpcvNr9i, READY, bom1 |
| Vercel untuk review | akun unyilhm1, proyek mas |
| Supabase QA | tnadzytuamdxfypoeggy |
| Supabase pelanggan | hncfyfvqtlnvqyfrydzb |

Commit dokumentasi setelah kandidat tersebut tidak berarti aplikasi telah di-deploy ulang. Tidak ada merge ke main, deployment aplikasi produksi resmi, atau perubahan DNS dalam pekerjaan ini. Domain resmi masih dilayani Netlify pada pemeriksaan terakhir.

## Perbaikan yang selesai

### Aplikasi

- Riwayat transaksi memiliki pagination 30 catatan per halaman dengan urutan occurred_at dan id. Transaksi lama dapat dibuka dan tersedia untuk pembatalan jika statusnya mengizinkan.
- Nominal dan poin dimuat berdasarkan ID transaksi pada halaman aktif.
- Kegagalan pemuatan nominal menampilkan pesan belum dapat dimuat, bukan label transaksi lama dengan 0 poin.
- Status VOID diperiksa terpisah dari batas halaman. Transaksi yang pembatalannya berada di halaman lain tetap ditandai sudah dibatalkan.
- Tombol pembatalan disembunyikan jika status pembatalan belum dapat dipastikan.
- Kandidat juga memuat perbaikan login ulang admin, penghapusan editor aturan poin, navigasi kartu member, dan perbaikan kalimat publik dari tahap sebelumnya.

### Database

| Tindakan | QA | Database pelanggan |
|---|---|---|
| Indeks foreign key tambahan | 7 indeks | 5 indeks |
| Izin aplikasi mengubah aturan poin | Dicabut | Dicabut |
| Pembacaan aturan dan pencatatan nominal owner | Tetap tersedia | Tetap tersedia |
| Timestamp migration history | Sudah disamakan dengan repo | Sudah disamakan dengan repo |
| Menjalankan ulang isi migrasi historis | Tidak | Tidak |

Isi tujuh migrasi historis pelanggan dan sembilan migrasi historis QA cocok dengan repo setelah normalisasi akhir baris dan spasi luar. Rekonsiliasi hanya memperbarui kolom versi pada baris history yang hash isinya cocok.

Maintenance Stage 15 tidak mengubah data member, transaksi, promo, kartu, saldo atau nilai aturan poin. Verifikasi pelanggan membandingkan jumlah baris dan seluruh isi baris aturan poin sebelum/sesudah: sama. Tidak ada fixture sintetis yang dijalankan pada database pelanggan.

Stage 10 reissue kartu belum diterapkan ke database pelanggan. Stage 15 menangani ketidakhadiran tabel/RPC tersebut tanpa mengaktifkannya. Jangan menandai Stage 10/11 sebagai sudah diterapkan hanya karena akses perubahan aturan poin telah dikunci oleh maintenance Stage 15.

## Validasi yang sudah selesai

| Pemeriksaan | Hasil pada kandidat aplikasi |
|---|---|
| Tes kode | 108 lulus |
| TypeScript | Lulus |
| Production build | Lulus |
| Tes browser lokal | 42 lulus |
| GitHub CI | 8 workflow sukses |
| SQL QA | Siklus kartu, idempotensi, izin owner/anon, dan maintenance lulus |
| Advisor indeks | Tidak ada temuan unindexed_foreign_keys pada kedua database |
| Preview / dan /membership | HTTP 200 |
| Preview /admin | HTTP 303 ke /admin/login?notice=reauth |
| Preview /admin/login | HTTP 200, form password tersedia |
| Preview /api/qa-readiness | HTTP 200, qaPreviewIsolation=configured |
| Preview /k/not-a-token | HTTP 404 |

[Audit Release Gate](https://github.com/warasjawa-laundry/Mas/actions/runs/39029725980) dan [PostgreSQL Concurrency QA](https://github.com/warasjawa-laundry/Mas/actions/runs/39029725913) adalah dua bukti CI untuk kandidat tersebut.

Pengujian lokal tidak memakai kredensial owner nyata. Pengujian login owner, kamera Android, cetak kartu, dan alur transaksi lengkap pada Preview tetap merupakan UAT tersendiri. Tes lokal juga menemui pembatasan DNS gambar eksternal; lulusnya tes browser tidak membuktikan semua gambar eksternal terkirim.

## Tiga pengaturan yang ditunda

### 1. GitHub: proteksi main

**Status:** belum aktif pada audit. API branch mengembalikan protected=false dan tidak ada ruleset.

**Yang sudah disiapkan:** workflow audit-release-gate.yml berjalan pada setiap PR ke main dan push ke main tanpa filter path. Nama job yang dapat dijadikan pemeriksaan wajib: **Audit release gate**.

**Saat dilanjutkan:**

1. Login dengan akun yang memiliki hak admin pada warasjawa-laundry/Mas.
2. Buka pengaturan branch protection atau ruleset dan targetkan main.
3. Wajibkan perubahan melalui PR dan pemeriksaan Audit release gate.
4. Pertahankan larangan force push dan penghapusan branch main.
5. Tentukan kebutuhan reviewer sesuai jumlah pengelola. Jangan mewajibkan reviewer kedua tanpa memastikan ada reviewer lain yang tersedia.
6. Jika pemeriksaan PostgreSQL juga akan diwajibkan, pastikan workflow-nya selalu berjalan pada PR yang ditargetkan. Workflow dengan filter path dapat membuat required check terus menunggu pada perubahan dokumentasi.
7. Simpan dan verifikasi pengaturan aktif melalui dashboard serta pembacaan API.

Tidak ada pengaturan proteksi yang disimpan pada sesi browser terakhir.

### 2. Supabase: proteksi password bocor

**Status:** advisor kedua proyek masih melaporkan Leaked Password Protection Disabled.

**Saat dilanjutkan:**

1. Pastikan proyek pelanggan dan QA dipilih dengan benar.
2. Periksa konfigurasi password pada Supabase Auth, lalu cari fitur leaked-password protection. Lokasi kontrol dan kelayakan paket belum dapat diperiksa karena dashboard meminta login.
3. Aktifkan jika tersedia pada paket saat ini. Dokumentasi Supabase menyebut fitur ini tersedia pada Pro ke atas.
4. Jika memerlukan upgrade berbayar, hentikan perubahan dan sampaikan opsi serta biayanya terlebih dahulu.
5. Periksa kembali advisor keamanan setelah perubahan.

Jangan mengganti password owner, membuat akun baru, atau mengubah metode login sebagai bagian dari pengaturan ini.

### 3. Vercel: klasifikasi secret shared Preview

**Target:** akun unyilhm1, proyek mas, shared Preview variable LAUNDRY_CARD_ENCRYPTION_KEY.

**Status:** shared variable masih bertipe encrypted dan ditandai readable-secret. Override untuk branch QA sudah bertipe sensitive.

**Kendala koneksi:** perubahan metadata type=sensitive ditolak karena API juga memerlukan visibility=secret. Skema alat yang tersedia tidak menerima field visibility. Kedua percobaan tidak mengubah variable.

**Saat dilanjutkan:**

1. Buka Environment Variables pada proyek mas yang benar.
2. Bedakan shared Preview variable dari override khusus branch QA.
3. Cari cara mengubah klasifikasi menjadi Sensitive/Secret dengan mempertahankan nilai persis sama.
4. Jangan menampilkan, menyalin ke chat/dokumen, atau mengganti material key.
5. Jika UI hanya menawarkan penggantian nilai, hentikan sebelum memasukkan nilai baru. Rotasi key memerlukan rencana terpisah karena kartu yang sudah ada masih memerlukan key yang sesuai.
6. Verifikasi klasifikasi dan cakupan environment setelah disimpan; jangan mengubah Production atau override QA tanpa alasan yang ditinjau.

Belum ada perubahan klasifikasi atau rotasi key pada dashboard.

## Batas kelanjutan

Instruksi terakhir pengguna adalah menghentikan pekerjaan pengaturan dashboard dan membuat dokumentasi. Jadi tidak ada kelanjutan otomatis, percobaan login baru, perubahan paket, merge, atau deployment tambahan berdasarkan dokumen ini.

Jika pekerjaan dibuka kembali, periksa keadaan aktual terlebih dahulu karena akun, pengaturan, branch dan deployment mungkin sudah berubah. Gunakan alur login aman; jangan meminta password atau kode verifikasi melalui chat.

Dokumentasi teknis pendamping dalam repo: docs/2026-10-17-audit-remediation-checkpoint.md. Alat rekonsiliasi yang sudah tersedia: scripts/reconcile-migration-history.mjs. Jangan menjalankan migrasi historis ulang untuk menyelesaikan perbedaan timestamp.
