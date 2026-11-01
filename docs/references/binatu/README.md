# Referensi UI/UX Binatu — Mas Jawa Laundry POS

**Tujuan:** bahan referensi visual untuk redesign total bagian `/admin` di website Mas Jawa Laundry; bukan aset produksi dan bukan implementasi Binatu.

**Asal:** 25 screenshot yang diberikan pemilik pada 1 November 2026. Disimpan dalam urutan kirim (01–25). **Semua screenshot adalah salinan tersanitasi**: identitas pelanggan, telepon, sebagian identitas pegawai, dan identitas nota disamarkan. Gambar contoh WhatsApp 18/20 disusun ulang untuk menghindari publikasi isi percakapan pribadi. Ini bukan salinan piksel identik pada area yang disamarkan.

**Batas penggunaan:** ikuti hirarki layar, posisi tombol utama, urutan form, affordance +/−, modal, dan navigasi supaya kasir tidak perlu beradaptasi jauh. Gunakan merek, ikon, dan kode milik Mas Jawa Laundry sendiri; jangan menyalin logo/aset pihak ketiga ke produk akhir.

## Peta screenshot

| No | Referensi | Target fungsi |
|---|---|---|
| 01 | [01-pesanan-belum-bayar](screenshots/01-pesanan-belum-bayar.jpg) | pesanan belum bayar |
| 02 | [02-menu-kasir](screenshots/02-menu-kasir.jpg) | menu kasir |
| 03 | [03-pilih-pelanggan](screenshots/03-pilih-pelanggan.jpg) | pilih pelanggan |
| 04 | [04-modal-pilih-durasi](screenshots/04-modal-pilih-durasi.jpg) | modal pilih durasi |
| 05 | [05-katalog-layanan-atas](screenshots/05-katalog-layanan-atas.jpg) | katalog layanan atas |
| 06 | [06-katalog-layanan-satuan-kiloan](screenshots/06-katalog-layanan-satuan-kiloan.jpg) | katalog layanan satuan kiloan |
| 07 | [07-katalog-layanan-kiloan-meteran](screenshots/07-katalog-layanan-kiloan-meteran.jpg) | katalog layanan kiloan meteran |
| 08 | [08-katalog-layanan-lanjutan](screenshots/08-katalog-layanan-lanjutan.jpg) | katalog layanan lanjutan |
| 09 | [09-kuantitas-kiloan](screenshots/09-kuantitas-kiloan.jpg) | kuantitas kiloan |
| 10 | [10-kuantitas-meteran](screenshots/10-kuantitas-meteran.jpg) | kuantitas meteran |
| 11 | [11-keranjang-multi-layanan](screenshots/11-keranjang-multi-layanan.jpg) | keranjang multi layanan |
| 12 | [12-atur-pesanan-parfum](screenshots/12-atur-pesanan-parfum.jpg) | atur pesanan parfum |
| 13 | [13-atur-pesanan-antar-jemput](screenshots/13-atur-pesanan-antar-jemput.jpg) | atur pesanan antar jemput |
| 14 | [14-atur-pesanan-diskon](screenshots/14-atur-pesanan-diskon.jpg) | atur pesanan diskon |
| 15 | [15-rincian-pesanan-atas](screenshots/15-rincian-pesanan-atas.jpg) | rincian pesanan atas |
| 16 | [16-rincian-pesanan-pembayaran](screenshots/16-rincian-pesanan-pembayaran.jpg) | rincian pesanan pembayaran |
| 17 | [17-konfirmasi-siap-ambil](screenshots/17-konfirmasi-siap-ambil.jpg) | konfirmasi siap ambil |
| 18 | [18-whatsapp-notifikasi-siap](screenshots/18-whatsapp-notifikasi-siap.jpg) | whatsapp notifikasi siap |
| 19 | [19-konfirmasi-pembayaran](screenshots/19-konfirmasi-pembayaran.jpg) | konfirmasi pembayaran |
| 20 | [20-whatsapp-notifikasi-lunas](screenshots/20-whatsapp-notifikasi-lunas.jpg) | whatsapp notifikasi lunas |
| 21 | [21-pilih-periode-mutasi](screenshots/21-pilih-periode-mutasi.jpg) | pilih periode mutasi |
| 22 | [22-daftar-mutasi-kas](screenshots/22-daftar-mutasi-kas.jpg) | daftar mutasi kas |
| 23 | [23-login-manajer](screenshots/23-login-manajer.jpg) | login manajer |
| 24 | [24-login-kasir](screenshots/24-login-kasir.jpg) | login kasir |
| 25 | [25-manajemen-akun-kasir](screenshots/25-manajemen-akun-kasir.jpg) | manajemen akun kasir |

## Alur kasir yang harus tetap familiar

1. Masuk Kasir → Menu → Tambah Pesanan / Pesanan.
2. Pilih pelanggan (tambahan tombol **Scan QR Member** tanpa memindahkan tombol cari/tambah).
3. Pilih durasi Reguler/Ekspres/Kilat.
4. Pilih layanan, ubah kuantitas menggunakan +/- atau angka, ringkasan terpasang di bawah, lanjut.
5. Atur parfum, antar-jemput, diskon, catatan, buat nota.
6. Rincian: status pengerjaan **terpisah** dari status pembayaran, aksi siap ambil, pesan WhatsApp.
7. Pembayaran (tunai/non-tunai) → lunas; secara atomik hubungkan sekali ke ledger poin membership Supabase yang sudah ada.
8. Mutasi kas / laporan per outlet dan periode.

## Tambahan Mas Jawa Laundry yang tidak ada di referensi

- Satu ID member `laundry_members.id` untuk semua outlet; bukan ID pelanggan terpisah.
- QR kartu lama berlaku; scan petugas **read-only** memilih member, tidak otomatis menambah poin.
- Halaman pelanggan `/k/[token]` tetap menunjukkan saldo poin per tahun, riwayat dan promo; perlu link nota saat POS terintegrasi.
- Poin dicatat tepat sekali saat pelunasan 100%, dengan rollback/koreksi dan idempotensi.
- Peran owner/manajer/kasir diperiksa di database, bukan hanya disembunyikan pada UI.
- Ekspor/impor Excel terkontrol, tidak langsung memberi poin dari nama yang sekadar cocok.

## Kriteria UI acceptance

- Setiap layar implementasi dibandingkan dengan screenshot bernomor terkait di viewport Android yang setara.
- Hierarki menu, tombol, urutan modal, label status, area total dan aksi Lanjut tetap familier.
- Fitur baru masuk secara aditif; tidak menghilangkan kartu QR, transaksi historis, aturan poin, promo, atau pengaturan owner.
- Uji riil kasir, keyboard input desimal kg/meter, skenario kosong/gagal/memuat dan aksesibilitas sentuh minimal 44px.
- Gambar ini **referensi**, tidak otomatis menyatakan semua perilaku Binatu telah diketahui; skenario yang tidak tergambar harus ditentukan eksplisit.
- Jangan unggah screenshot asli yang mengandung data pribadi ke repository publik.

**Isolasi:** branch ini hanya menyimpan referensi; tidak mengubah kode, schema atau production deployment.
