# Stage 0 — Audit Baseline Mas Jawa Laundry
Tanggal: 2026-10-16 (WIB)
Status: AUDIT KODE SELESAI; QA LIVE, VALIDASI FAKTA BISNIS, DAN PERANGKAT MASIH TERBUKA
Scope: warasjawa-laundry/Mas (main) dan warasjawa-laundry/Web-asset (main).
Ini dokumen audit, tidak mengubah website produksi.

## 1. Bukti yang diperiksa
- Repo: https://github.com/warasjawa-laundry/Mas; baseline main commit/tree SHA `46dcafb5f9a2f2c69b591e5e7c4a6c6e848ba1ef` (HEAD perlu direkonfirmasi tepat sebelum implementasi).
- File tracked pada main: `.nojekyll`, `README.md`, `_redirects`, `index.html` (34.061 byte), `robots.txt`, `script.js` (5.429 byte), `sitemap.xml`, `style.css` (2.213 byte).
- Aset dalam repo `warasjawa-laundry/Web-asset`: `IMG-20251228-WA0005.jpg` (689.295 B), `IMG-20251228-WA0007.jpg` (660.271 B), `IMG-20251228-WA0010.jpg` (34.900 B, dipakai sebagai logo), `IMG-20251228-WA0011.jpg` (32.954 B, dipakai pada bagian tas member), `file_0000000026e471fa90d1cf491899dd50.png` (1.691.805 B, dipakai sebagai gambar hero). Kode menunjuk ke commit aset tertentu via `wsrv.nl` dan GitHub, sehingga pergantian URL harus diuji, tidak ditulis ulang asal.
- Pemeriksaan langsung `https://masjawalaundry.web.id/` dari lingkungan audit tidak dapat dilakukan (URL gagal diakses oleh alat penelusuran saat itu). Klaim seperti LCP/performa, keterbacaan aktual mobile, fidelity foto, status SSL/DNS/hosting aktual belum tervalidasi. Jangan menulis "QA visual PASS".
- Belum terkonfirmasi siapa pemilik domain, penyedia DNS/hosting produksi saat ini, serta apakah redirect Netlify benar-benar aktif.

## 2. Inventaris konten yang ditemukan (belum dianggap fakta mutakhir sampai owner menyetujui)
### Navigasi dan struktur
Beranda `#home`, Keunggulan `#keunggulan`, Info Member `#promo`, Testimoni `#testimoni`, Harga `#layanan`, Kontak `#kontak`. Hero copy lama: "Laundry Level Up." dan deskripsi "Mas Jawa Laundry hadir dengan standar baru..."; redesign harus menggantinya dengan copy layanan yang lebih spesifik dan sederhana, bukan tagline kosong.

### Keunggulan yang diklaim pada homepage
- "1 Mesin = 1 Pelanggan"
- "Garansi Waktu"
- "Filter Air Ganda"
- "Parfum Grade A+"
Ini klaim operasional, bukan fakta independen. Hanya pertahankan setelah dikonfirmasi owner.

### Harga tertulis pada kode (PASTIKAN ulang sebelum publikasi)
- Reguler (1–3 hari): Cuci Lipat 3K/kg; Cuci Setrika 5K/kg.
- Express (1–2 hari): Cuci Lipat 5K/kg; Cuci Setrika 7K/kg.
- Kilat (6 jam): Cuci Lipat 7K/kg; Cuci Setrika 10K/kg.
- Gorden Tebal: Rp4.500/meter; Gorden Tipis: Rp3.500/meter.
Jangan menebak harga layanan lain. Label durasi/harga harus kembali disetujui agar tidak menjanjikan layanan salah.

### Promosi existing
Bagian `#promo` saat ini berjudul "Gratis Tas Eksklusif", CTA "Klaim Tas Sekarang", dengan deskripsi tas member. Program fisik itu tidak sama dengan checklist/reward baru; jangan otomatis menggabungkan ketentuan atau menghapus penawaran lama tanpa izin owner.

### Kontak dan SEO
- Domain/canonical `https://masjawalaundry.web.id/`; sitemap hanya homepage; `robots.txt` `Allow: /` + sitemap.
- WhatsApp di kode: `6282313359989`; lokasi dalam footer dan schema: Jl. Raya Kandang Jati Kulon RT.06 RW.01 (Depan Masjid Al-Hidayah), Kandang Jati Kulon, wilayah Probolinggo; jam 07.00–20.00 WIB.
- Open Graph dan `LaundryService` JSON-LD sudah ada. Validasi fakta kontak, wilayah layanan, harga, jam serta `sameAs` sebelum mempertahankan schema.
- Tiga testimonial atas nama Ibu Sari, Dimas Anggara, Mbak Rini dalam kode, belum ada bukti izin/asal; jangan klaim asli sebelum diverifikasi.

## 3. Temuan teknis dan UX
| ID | Temuan yang dibuktikan dari kode | Risiko | Rekomendasi/pemeriksaan |
|---|---|---|---|
| S0-01 | `body` memiliki class `invisible`; baru dilepas oleh JS setelah inisialisasi Lenis/GSAP | Critical: blank page jika CDN JS gagal | Default terlihat, progressive enhancement; JS gagal tidak menyembunyikan konten |
| S0-02 | Tailwind runtime CDN + Lenis dan GSAP dari CDN | Jaringan lemah dan dependency blocking | Build CSS statis, kurangi dependency animasi |
| S0-03 | Lenis, hero timeline, ScrollTrigger dan parallax bergantung JS | UX mobile/gawai hemat data | Batasi motion; no scroll hijacking; dukung reduced motion |
| S0-04 | Tidak ditemukan `prefers-reduced-motion` di CSS/JS | Accessibility | Tambahkan aturan dan verifikasi gerak berkurang |
| S0-05 | Ada `<link rel="manifest" href="manifest.json">`, tidak ada file manifest pada main | PWA incomplete | Implementasikan manifest benar saat PWA benar-benar diperlukan |
| S0-06 | Instagram footer berisi `href="#"` | Link buntu | Tampilkan hanya jika tautan sudah diverifikasi |
| S0-07 | Tahun copyright `2024` hardcoded | Informasi basi | Tahun dinamis dari build/render tanpa klaim tanggal pendirian |
| S0-08 | Nav kategori `Info Member` saat ini masuk ke promosi tas | Bingung saat fitur member ditambahkan | Pisahkan edukasi kartu QR dan program tas jika masih berlaku |
| S0-09 | Tidak ada halaman admin maupun database/roles/checklist | Fitur membership belum diimplementasikan | Rancang route proteksi & data model terpisah dari konten publik |
| S0-10 | Foto/asset diproksi lewat wsrv.nl/GitHub commit pin | Gagal gambar jika proxy/aset tak tersedia; layout shift | Audit visual aset dan izin penggunaan; optimasi asset pipeline |
| S0-11 | `_redirects` berisi rule Netlify -> domain custom | Aturan belum tentu dibaca hosting baru | Inventaris provider aktif lalu migrasikan redirect setara |
| S0-12 | Harga ditulis di HTML, sebagian tak punya informasi layanan lengkap | Risiko data usang | Owner memvalidasi matriks layanan dan harga sebelum rilis |

## 4. Keputusan pengalaman pengguna yang terkunci
- Owner login saja; tidak ada registrasi atau login member.
- Member menerima kartu fisik ber-QR, juga bisa cek progress via QR browser tanpa memasang aplikasi.
- Owner melakukan scan kamera HP -> sistem cari member -> owner konfirmasi checklist. Scan **tidak** langsung menambah.
- Member melihat total kunjungan/checklist sah dan promo manual miliknya saja.
- Promo dipilih dan ditulis bebas oleh owner tanpa auto-eligibility. Pesan WhatsApp dibuat dari promo tersimpan, bisa disalin atau membuka WA; tidak otomatis terkirim.
- Satu repo untuk homepage & membership, produksi tetap tidak disentuh sampai uji final.

## 5. Item terbuka sebelum code/launch
Owner perlu mengonfirmasi foto mana yang benar-benar mewakili fasilitas sekarang, daftar harga, status tas member, sumber testimonial, link sosial, cetak A4 vs PVC dan printer, consent WA promo, kemungkinan migrasi cap stempel lama, serta kebijakan penggantian kartu hilang. Tim harus mengidentifikasi platform production/DNS/backup dan menguji build asli pada browser/HP sungguhan.

## 6. Stage 0 exit checklist (jujur)
- [x] Snapshot struktur repo kode di main dan identitas sumber aset.
- [x] Daftar risiko JS blank page/manifest/animasi/link teridentifikasi.
- [x] Inventaris harga, label, CTA, SEO & kontak dari kode.
- [x] Ruang lingkup membership dan privasi member dirumuskan.
- [ ] Screenshot/render live desktop+Android dan audit aksesibilitas — belum tersedia dari alat.
- [ ] Konfirmasi fakta usaha, harga, foto, testimonial, tas — butuh persetujuan pemilik bisnis.
- [ ] Konfirmasi hosting, backup, DNS, printer, WhatsApp consent — belum dicek.
- [ ] Baseline Lighthouse/Web Vitals (nilai faktual) — belum diukur.

Status Stage 0: **AUDIT SOURCE COMPLETE; LIVE / BUSINESS VERIFICATION PENDING**. Jangan tandai FULL COMPLETE.
