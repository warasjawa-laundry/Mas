# Mas Jawa Laundry — Branch integrasi Stage 1–7 dan rencana Stage 8

**Ditetapkan:** 16 Oktober 2026. **Branch integrasi:** `integration/mas-jawa-laundry` (dibuat dari `feature/stage7-manual-whatsapp` commit `a62379f570fe16057126b5b6c50c2f43c3d9656d`).

## Tujuan dan batasan

Satu branch pengembangan menjadi tempat pekerjaan berikutnya; satu Draft PR dari branch integrasi ke `main` menjadi calon rilis tunggal. **Tidak otomatis merge, deploy ke production, atau menghapus branch/PR terdahulu.** PR #1–#7 adalah jejak historis pengembangan bertingkat; commit ketujuh sudah memuat leluhurnya tanpa rebase/cherry-pick tambahan. Jangan menggabungkan tujuh PR satu per satu ke `main` karena seluruh kode sudah berada pada ujung integrasi.

## Fitur terintegrasi

- Stage 1: audit baseline dan aturan bahasa anti-slop
- Stage 2: homepage responsive Next.js; kontrak informasi produk tanpa klaim berlebihan
- Stage 3: owner-only ID/password login dengan Supabase Auth dan RLS
- Stage 4: registrasi member, QR card per-member, read-only progress dan promosi
- Stage 5: kamera dan screenshot galeri QR scanner, resolusi member tanpa side effect, owner +1 transaksi, riwayat dan VOID alasan
- Stage 6: owner secara manual memberikan, menggunakan, atau membatalkan promo
- Stage 7: shortcut Promo pada daftar member, badge responsif, dan WhatsApp message composer yang editable, copy-only / membuka WhatsApp secara manual bila ada nomor valid dan persetujuan promo.

## Kontrak keamanan

- Customer **tidak memiliki login** dan QR scan **tidak** mencatat transaksi; owner secara eksplisit menyimpan +1.
- Satu member dapat memiliki promo yang dipilih owner; tidak ada reward otomatis berdasar jumlah transaksi.
- WhatsApp tidak mengirim otomatis. URL `wa.me` hanya dapat dibuka dari dashboard owner untuk promo aktif pada member aktif yang punya nomor valid dan persetujuan promo.
- Data pelanggan tidak ditulis ke public homepage atau GitHub; jangan memodifikasi transaksi/promo pelanggan nyata hanya untuk QA.
- Encrypted Vercel Preview env untuk branch integrasi menggunakan kredensial identik Stage 7 yang sudah diuji (termasuk QR card encryption key). Pastikan Preview dibangun **setelah** env branch tersedia; login `?error=unavailable` dapat terjadi jika deployment dibuat sebelum penyimpanan env selesai.

## Integrasi CI dan release gates

Workflow `.github/workflows/stage7-whatsapp-ci.yml` pada branch integrasi menjalankan unit test semua Stage, TypeScript, build, dan browser checks. Preview baru harus READY, login GET 200, halaman owner tidak diakses tanpa login, dan QR invalid tetap 404. Uji autentikasi positif, pemindaian QR Android, penggunaan promo, copy/buka WhatsApp, dan penerimaan notifikasi oleh owner secara manual sebelum release.

## Tahap berikut: Stage 8 (belum diimplementasikan)

1. Owner dapat mengoreksi data member, terutama WhatsApp dan persetujuan menerima promo; tidak wajib nomor saat registrasi.
2. Desain alur pembaruan consent yang eksplisit (catat waktu dan perubahan, jangan menjadikan consent aktif secara otomatis).
3. Rapikan halaman detail member agar menu transaksi, promo, dan kartu QR mudah ditemukan pada Android lama.
4. Audit keamanan: proteksi login, rate limits, QR revoke/reissue jika token pernah bocor, dan uji cetak fisik CR80.
5. QA isi homepage: foto, daftar layanan, harga, alamat dan teks harus disetujui owner. Setelah itu baru pertimbangkan merge `main` secara sengaja.

**Rilis masih diblokir sampai semua gate lulus dan owner menyetujui merge secara eksplisit.**
