# G3 — login kasir dengan ID empat angka tanpa pairing

**Tanggal:** 2 November 2026 WIB. **Status:** QA implementasi lulus; production database tetap belum dimigrasi (G8 NO-GO).

## Keputusan owner dan implementasi

- Owner mempertahankan login ID/password. Karyawan memasukkan satu ID berpola `MAS-XXXX` tanpa password, tanpa owner memasangkan perangkat. Form login terlihat di `/kasir` walau pengguna belum memiliki sesi.
- Sistem G3 lama sudah memberi ID unik berurutan `MAS-0001` hingga `MAS-9999` dan mempertahankannya saat rename/disable; `MAS-0000` dicadangkan sesuai konvensi lama. Tidak ada migrasi renumber data historis.
- Migrasi `20261102093000_pos_cashier_direct_id_login.sql` membuat RPC terotorisasi, sesi `DIRECT_ID` dengan dua digest token acak 256-bit/12 jam, owner tetap dapat revoke seluruh sesi, dan aktor `issued_by=null` tidak dipalsukan menjadi owner.
- Throttle DB global 10 percobaan per menit (termasuk ID tak dikenal), kemudian kunci 5 menit; batas lima sesi aktif per karyawan. Tabel throttle privat RLS default-deny. Tidak ada akses ke owner/settings/PII dari halaman login.
- Hilangkan tombol aktivasi perangkat dari halaman owner; legacy pair RPC belum dihapus agar sesi historis tetap dikenali, tetapi tidak diperlukan lagi.

## QA yang benar-benar diuji

- Supabase QA `cwxsbgfjynwxqalwonae`: migrasi berhasil di-apply; setelah apply, SQL regression `supabase/tests/pos-cashier-direct-id-login.sql` **lulus** dalam transaksi `BEGIN/ROLLBACK`. Juga lulus uji gabungan dry-run schema+regression sebelum apply.
- Bukti: login tanpa pairing untuk karyawan sintetik, pola 4 digit, owner-only provisioning, dua token wajib, sesi 12 jam dan identitas issuer, revokasi owner, ID tidak ditemukan, throttle guess global, serta tidak ada payment/point yang tercipta.
- SQL metadata pascates: 0 karyawan/perangkat/login sintetik tersisa, throttle attempts=0, direct table grants anon=none; security advisor tidak melaporkan temuan ERROR. INFO `rls_enabled_no_policy` sesuai kebijakan default-deny pada tabel privat.
- Node test `tests/pos-cashier-username.test.mjs` 3/3 lulus saat pemeriksaan terisolasi; CI Stage10 dan integrasi lengkap harus diverifikasi pada commit PR sebelum merge.

## Keamanan dan pekerjaan yang belum selesai

**ID empat angka bukan rahasia yang kuat.** Bila diketahui orang lain, ID itu sendiri cukup untuk membuat sesi baru. Throttle global menurunkan kecepatan tebakan tetapi juga dapat disalahgunakan untuk memblokir login seluruh outlet; tidak setara dengan autentikasi kuat. Jangan mempublikasikan daftar ID kasir. UAT riil, review risiko, audit percobaan berulang, dan approval owner menjadi gate G8 sebelum pembayaran dan poin live dibuka.

**Tidak ada migrasi database produksi** `hncfyfvqtlnvqyfrydzb` atau aktivasi `write_enabled`; aplikasi kasir produksi tetap menunjukkan belum tersedia sampai G8. Proyek Vercel tetap `mas`, Git connection `unyilhm1-hue/mas`, tanpa deployment staging baru.
