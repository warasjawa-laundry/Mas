# Brand palette POS, 4 November 2026

**Owner request:** hapus aksen kuning warisan Binatu di halaman Owner dan Kasir, mengikuti warna ungu dan biru logo MasJawa Laundry tanpa membuat semua permukaan berwarna gelap.

## Token dan status
| Purpose | Background | Foreground | WCAG contrast |
| --- | --- | --- | --- |
| primary button | #5B3F8C | #FFFFFF | 8.29:1 |
| hover button | #49316F | #FFFFFF | 10.76:1 |
| selected menu | #F3EEFA | #4B3677 | 8.8:1 |
| unpaid badge | #F7EAF2 | #7B3258 | 7.38:1 |
| information | #EAF2FB | #355D83 | 6.11:1 |
| warning | #F9EBF2 | #79324E | 7.65:1 |

- Primary actions (Masuk, Tambah Pesanan, konfirmasi transaksi) ungu tua dengan teks putih; hover lebih gelap.
- Sidebar/menu/tab active, icon-box, selected order dan duration: lavender lembut dengan indikator tepi/fokus ungu.
- Mode Uji / info transaksi / poin simulasi: biru lembut, tidak menyerupai pendapatan nyata.
- Belum Bayar dan warning: rose yang lebih lembut daripada merah error; Lunas tetap hijau, destructive refund tetap merah.
- Motif SVG background dan logo MasJawa tetap terpisah dari panel putih sejak commit branding sebelumnya.

## File dan batas
CSS: `app/pos-ui.css`, `app/admin/admin.css`, `app/kasir/pesanan/baru/wizard.module.css`, `app/kasir/pesanan/orders.module.css`, dan `app/globals.css` (notice program). Test kontrak `tests/pos-brand-palette.test.mjs` memastikan nilai token, pembagian status, tidak ada kuning aktif, dan kontras minimum 4.5:1 untuk kombinasi teks utama. Efek visual nyata memerlukan pemeriksaan HP/desktop.

Tidak melakukan perubahan login Owner/Kasir satu halaman, hak akses, endpoint, jurnal, poin, customer data, harga, skema DB, flag pilot atau readiness G8. **G8 tetap NO_GO**. Aset SVG kuning lama dipertahankan sebagai arsip kompatibilitas tetapi tidak lagi dipakai oleh selector UI aktif.
