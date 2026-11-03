# G7 audit UI source vs 25 screenshot Binatu — 2 Nov 2026

> **Checkpoint terkini sebelum final CI (2 Nov 2026): PROVISIONAL / G8 NO-GO.** Root mengonfirmasi ketiga migrasi canonical telah diterapkan **QA saja**: `20261102190000_pos_owner_creation_duration_snapshots.sql`, `20261102193000_pos_owner_operations_shared_cores.sql`, `20261102210000_pos_import_review_audit.sql`. Fixture owner duration, owner operations, import audit dan regresi existing G5/G6/G2 PASS setelah apply. `write_enabled=false` dan `finance_enabled=false`. Lima browser test wizard sintetis PASS pada 320/390/1440px memakai mocks; ini bukan real Auth atau PHYSICAL_UAT. Synthetic restore dan race tambahan menunggu CI yang akan datang, **belum PASS**. Final tree/CI dan deployment paket baru belum disertifikasi. Produksi tetap 0 tabel POS; tidak ada mutasi produksi. Lihat [master audit](./master-audit-20261102.md) untuk dependensi dan bukti penutupan.

**Kesimpulan sementara: PARTIAL PARITY, bukan 25/25 PASS.** Referensi 25 screenshot telah diperiksa sebagai kumpulan layar. Belum dilakukan perbandingan screenshot live Android viewport sama atau sign-off owner.

**Implementasi tambahan G7:** picker QR kamera/galeri pada form member, hanya membaca kartu dengan token SHA256 + izin DB `member_lookup`. Pesanan menggunakan tab Antrian/Siap Ambil/Belum Bayar yang benar-benar memfilter status kerja dan pembayaran (bukan span hiasan). Aksen POS kuning dan tombol sentuh 44–48px mendekati Binatu, tetapi logo serta data tetap Mas Jawa.

| Referensi | Status source | Gap / bukti yang harus dikumpulkan |
|---|---|---|
| 01–02 menu & daftar | Parsial | Bottom nav benar-benar setara dan empty-state belum discreenshot |
| 03 pelanggan | Implementasi kode: QR + nomor member + pencarian nama prefix min 3 dan pilihan hasil nama kembar | Verifikasi fisik HP dan owner belum ditandatangani |
| 04 durasi | Durasi melekat per layanan; wizard Pelanggan/Layanan/Konfirmasi disetujui Owner | Snapshot/known-only ETA QA; range/blank PENDING; real viewport/focus dan policy signoff pending |
| 05–11 kartu layanan | Parsial | Susunan kartu & sticky total butuh perbandingan nyata |
| 12–14 opsi | Preset parfum dan kustom ada; penanda antar/jemput/diskon belum dapat digunakan | Ongkir dan diskon tidak berwenang/bertarif tetap menunggu keputusan bisnis+RPC SQL |
| 15–17 nota dan siap ambil | Parsial | Rincian & konfirmasi harus diuji viewport Android nyata |
| 18–20 WA dan pembayaran | Parsial | WA hanya draf manual; provider/gateway tidak diintegrasikan |
| 21–22 mutasi & laporan | Parsial | Sudah ada, cek periode modal, kas dan CSV di HP |
| 23–25 akses owner/kasir | Parsial | Login langsung MAS-XXXX tanpa pairing wajib dan owner ID/password tersedia; UAT nyata belum |

**G8 visual gate:** owner/perwakilan kasir membandingkan semua 25 layar pada viewport setara, mencatat screenshot privat dan tanda tangan; tidak boleh mengklaim siap hanya karena TypeScript/CI hijau. Aset Binatu asli tidak ditanam di produk.

**Histori G7 (disupersede keputusan Owner):** wizard 4 tahap + bottom sheet pernah dibuat; kondisi terkini wizard 3 tahap dengan durasi per layanan, pencarian nama yang membatasi PII dan pilihan manual bila member senama, preset parfum dan label belum tersedia untuk diskon/ongkir. Tidak ada klaim 25/25 PASS ataupun pengukuran pixel nyata. QR tetap read-only, PII tidak dibuka untuk kasir tanpa izin; biaya hanya dari harga layanan katalog. Semua gap tertinggal dibawa ke G8 sebagai blocker sesuai UAT.


### Audit koreksi navigasi PR #29 (2 November 2026)
- Owner tetap dalam namespace /admin untuk daftar/tambah/rincian; tidak dilempar ke login Kasir. Command owner-attributed sudah diimplementasi dan diterapkan QA; penulisan produksi tetap dikunci G8 dan kedua switch OFF.
- Scan Barcode/QR dipasang dalam Pilih Pelanggan dan tersedia pada Menu Owner Operasional. Impor Binatu berada di Data & pelanggan; Layanan & Harga pada Pengaturan. Semua halaman reuse shell Argon POS, bukan UI admin terpisah.
- Menu Kasir mengikuti izin, pembacaan dan owner operations memakai RPC actor Owner pada QA, kedua switch OFF; Android/UAT fisik 25 screenshot tetap pending.


### Keputusan Owner terbaru (2 November 2026)
- Screenshot langkah Durasi terpisah diganti menjadi durasi yang melekat pada tiap layanan karena permintaan eksplisit Owner, bukan ketidaksesuaian desain. Wizard menjadi 3 tahap: Pelanggan/Layanan/Konfirmasi.
- `Layanan & Harga` memperlihatkan kolom Durasi di tiap baris; Owner dapat mengeditnya lewat form layanan yang sama. Referensi screenshot Binatu harus dibaca dengan perubahan flow yang disetujui Owner, sementara UAT visual yang lain tetap menunggu pemeriksaan fisik.


### Tambahan 3 November 2026

Tambahan mempertahankan shell Argon MasJawa. Empat tahap dan paket global berasal dari revisi Owner terbaru; layanan lama tetap dapat dipetakan. Browser fixture menguji 320/390/1440 dan draf WA; screenshot diperiksa lokal. Ini bukan persetujuan visual 25 layar oleh Owner atau PHYSICAL_UAT.
