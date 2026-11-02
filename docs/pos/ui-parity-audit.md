# G7 audit UI source vs 25 screenshot Binatu — 2 Nov 2026

**Kesimpulan sementara: PARTIAL PARITY, bukan 25/25 PASS.** Referensi 25 screenshot telah diperiksa sebagai kumpulan layar. Belum dilakukan perbandingan screenshot live Android viewport sama atau sign-off owner.

**Implementasi tambahan G7:** picker QR kamera/galeri pada form member, hanya membaca kartu dengan token SHA256 + izin DB `member_lookup`. Pesanan menggunakan tab Antrian/Siap Ambil/Belum Bayar yang benar-benar memfilter status kerja dan pembayaran (bukan span hiasan). Aksen POS kuning dan tombol sentuh 44–48px mendekati Binatu, tetapi logo serta data tetap Mas Jawa.

| Referensi | Status source | Gap / bukti yang harus dikumpulkan |
|---|---|---|
| 01–02 menu & daftar | Parsial | Bottom nav benar-benar setara dan empty-state belum discreenshot |
| 03 pelanggan | Implementasi kode: QR + nomor member + pencarian nama prefix min 3 dan pilihan hasil nama kembar | Verifikasi fisik HP dan owner belum ditandatangani |
| 04 durasi | Bottom sheet pilihan ​**durasi katalog aktual** tersedia (6 jam/1–2 hari/1–3 hari dll); tidak menciptakan tarif Ekspres/Kilat | Durasi beberapa layanan ambigu/blank, due date belum dihitung; uji 320–1440px dan fokus fisik pending |
| 05–11 kartu layanan | Parsial | Susunan kartu & sticky total butuh perbandingan nyata |
| 12–14 opsi | Preset parfum dan kustom ada; penanda antar/jemput/diskon belum dapat digunakan | Ongkir dan diskon tidak berwenang/bertarif tetap menunggu keputusan bisnis+RPC SQL |
| 15–17 nota dan siap ambil | Parsial | Rincian & konfirmasi harus diuji viewport Android nyata |
| 18–20 WA dan pembayaran | Parsial | WA hanya draf manual; provider/gateway tidak diintegrasikan |
| 21–22 mutasi & laporan | Parsial | Sudah ada, cek periode modal, kas dan CSV di HP |
| 23–25 akses owner/kasir | Parsial | Username MAS-XXXX dan owner pairing sudah ada; UAT nyata belum |

**G8 visual gate:** owner/perwakilan kasir membandingkan semua 25 layar pada viewport setara, mencatat screenshot privat dan tanda tangan; tidak boleh mengklaim siap hanya karena TypeScript/CI hijau. Aset Binatu asli tidak ditanam di produk.

**Update G7 lanjutan:** wizard 4 tahap + bottom sheet durasi service-backed, pencarian nama yang membatasi PII dan pilihan manual bila member senama, preset parfum dan label belum tersedia untuk diskon/ongkir. Tidak ada klaim 25/25 PASS ataupun pengukuran pixel nyata. QR tetap read-only, PII tidak dibuka untuk kasir tanpa izin; biaya hanya dari harga layanan katalog. Semua gap tertinggal dibawa ke G8 sebagai blocker sesuai UAT.


### Audit koreksi navigasi PR #29 (2 November 2026)
- Owner tetap dalam namespace /admin untuk daftar/tambah/rincian; tidak dilempar ke login Kasir. Penulisan nota dan pembayaran Owner tetap dikunci G8 sampai command owner-attributed ditinjau.
- Scan Barcode/QR dipasang dalam Pilih Pelanggan dan tersedia pada Menu Owner Operasional. Impor Binatu berada di Data & pelanggan; Layanan & Harga pada Pengaturan. Semua halaman reuse shell Argon POS, bukan UI admin terpisah.
- Menu Kasir mengikuti izin, pembacaan owner POS memakai read-only RPC pada QA; Android/UAT fisik 25 screenshot tetap pending.


### Keputusan Owner terbaru (2 November 2026)
- Screenshot langkah Durasi terpisah diganti menjadi durasi yang melekat pada tiap layanan karena permintaan eksplisit Owner, bukan ketidaksesuaian desain. Wizard menjadi 3 tahap: Pelanggan/Layanan/Konfirmasi.
- `Layanan & Harga` memperlihatkan kolom Durasi di tiap baris; Owner dapat mengeditnya lewat form layanan yang sama. Referensi screenshot Binatu harus dibaca dengan perubahan flow yang disetujui Owner, sementara UAT visual yang lain tetap menunggu pemeriksaan fisik.
