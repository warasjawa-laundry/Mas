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
- [ ] CI dan pengujian copy hingga PASS.
- [ ] Deploy commit lulus CI ke Preview QA yang sama.
- [ ] Lakukan review tampilan dan verifikasi faktual oleh pemilik.
- [ ] Main dan situs produksi tetap tidak diubah.
