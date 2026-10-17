# Stage 14 — Audit Bahasa Homepage dan Kartu Member

**Tanggal:** 17 Oktober 2026 (WIB). **Branch:** PR #12.

## Temuan
- [x] Audit teks homepage, halaman Kartu Member, scanner, halaman catatan kartu QR, navigasi bersama, dan metadata SEO.
- [x] Tidak ditemukan em dash (—) dalam teks komponen publik yang diaudit. En dash (–) pada rentang harga/waktu (contoh: 1–3 hari, 07.00–20.00 WIB) benar dan tidak dihapus.
- [x] Ditemukan judul abstrak, kalimat terlalu umum, pengulangan, dan istilah yang bercampur, seperti *progress*, *scan*, *QR Code*, dan *screenshot*.

## Perbaikan contoh
| Sebelum | Sesudah |
| --- | --- |
| Pilih yang sesuai kebutuhan. | Daftar harga laundry |
| Informasi jelas, jadi lebih mudah menentukan layanan. | Cuci lipat atau cuci setrika? |
| Kartu langganan, tanpa harus mengingat jumlah transaksi. | Lihat catatan transaksi lewat kartu QR. |
| Simpan kartu, transaksi tercatat. | Cara memakai kartu member |
| Ada yang ingin ditanyakan? | Perlu bantuan kartu member? |
| Progress Member | Catatan Kartu Member |

## Batasan fakta yang dijaga
- [x] Paket, tarif dan estimasi lama tetap apa adanya dan tetap perlu dikonfirmasi kepada petugas.
- [x] Program member yang belum aktif tidak disebut sudah tersedia untuk publik.
- [x] Promo tetap ditentukan pemilik dan tidak otomatis berdasarkan jumlah transaksi.
- [x] Penggunaan WhatsApp untuk informasi promo tetap berdasarkan persetujuan.
- [x] QR hanya membaca catatan; transaksi tetap disimpan petugas.
- [x] Tidak mengubah alur Auth, sistem poin, integritas QR, database, atau domain produksi.

## Pekerjaan lanjutan
- [x] Revisi copy halaman dan pesan scanner.
- [x] Perbarui tes judul halaman.
- [x] Semua **7/7 GitHub Actions PASS** pada SHA kode `72deca824e39a1bcf9f5dfe480b4f519bb63ea56`, termasuk regression test isi halaman, SEO, alur QR dan tata letak.
- [x] Deployment **READY** di Preview QA Vercel yang sama, `dpl_5owefDQAzfZbH9nnj5J9YWsuVq3E` (Mumbai `bom1`), commit `72deca8`. Alias QA menuju deployment baru; alias Preview `main` tetap menunjuk deployment sebelumnya.
- [ ] Lakukan review tampilan dan verifikasi faktual oleh pemilik.
- [ ] Main dan situs produksi tetap tidak diubah.

## Validasi akhir
- [x] GitHub Actions 7/7 PASS pada SHA sumber yang dipasang.
- [x] Preview QA terlindungi, READY di region Mumbai (`bom1`).
- [x] Alias QA: `https://mas-git-feature-admin-operat-e444d5-m8traders-projects-081d9dc2.vercel.app`.
- [x] Alias Preview `main` tetap pada `dpl_3qF3NBniMjH9ka1LCY9jAFuJyM2z`. GitHub `main` tetap `f742b8a`.
- [ ] Persetujuan akhir copy di HP oleh pemilik; revisi bahasa adalah preferensi editorial, bukan sesuatu yang bisa dijamin lewat tes otomatis.
- [ ] PR #12 belum di-merge, SQL pelanggan dan production tidak diubah.
