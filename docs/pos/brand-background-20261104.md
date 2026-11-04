# Visual branding — background POS Manajer dan Kasir

Tanggal: 4 November 2026. Permintaan Owner mengganti background kuning berpola Binatu dengan warna logo asli MasJawa Laundry ungu–magenta–cyan, termasuk seluruh area Kasir yang menggunakan background tersebut.

## Desain dan file
- `public/pos/masjawa-laundry-pattern.svg`: SVG transparan tiga motif washer, shirt dan hanger, garis konsisten stroke 3.2, tanpa efek 3D atau dekorasi berlebihan. Dipakai sebagai lapisan pola di atas gradien navy/ungu pada seluruh `.binatu-pattern` shared.
- `public/pos/masjawa-login-banner.svg`: banner SVG mandiri berlatar navy/ungu, bidang biru samping dan pattern ikon yang sama untuk login dua peran, termasuk fallback Kasir.
- `app/pos-ui.css`: pola shared, banner login keduanya, pembingkaian gambar profil outlet.
- `app/admin/admin.css`: bidang logo login warna netral, memisahkan panel putih dari banner SVG.
- Logo official `assets.logo` dari `lib/site.ts` (digunakan juga di homepage) menggantikan icon washer/storefront generik di login, header board Owner/Kasir, workspace dan sidebar.

## Batas pekerjaan
Halaman login Owner dan Kasir **tetap satu** `/admin/login` (tab Manajer/Kasir). Route fallback `/kasir` yang sudah ada hanya menampilkan tema visual sama, tidak membuat sistem autentikasi lain. Form, hak akses, sesi, harga, pembayaran, ledger, poin, data member, flag pilot dan G8 tidak diubah.

Selector `.binatu-pattern` merupakan source bersama untuk page cap dan sidebar Owner/Kasir, sehingga tidak ada patch warna berbeda antar halaman. Marker `storefront.svg`/logo lama hanya diganti pada tampilan yang menggunakan `assets.logo`, tanpa menghapus aset lama dari repo agar kompatibilitas tidak terganggu. **Kontrol/tombol kuning warisan POS tidak diubah** dalam pekerjaan ini, karena scope yang disetujui adalah background dan ikon profil.

## Verifikasi
- Tes sumber: `tests/pos-brand-background.test.mjs` memeriksa asset, kedua login, board dan sidebar.
- Jalankan Node unit, typecheck, build, dan Playwright terkait untuk memverifikasi tidak ada regresi login/peran/navigasi.
- UAT fisik Android/desktop setelah deploy diperlukan untuk cropping banner, ketajaman line art, cakupan sidebar dan kontras. Jangan klaim physical UAT atau G8 lulus tanpa bukti.
