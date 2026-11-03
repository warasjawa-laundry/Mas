# UAT G7 — Mas Jawa Laundry POS (2 Nov 2026)

> **Aktivasi konfigurasi Production — 3 November 2026, 15:47 WIB.** Atas instruksi eksplisit pengguna, outlet MJL sekarang write_enabled=true dan finance_enabled=true. Ini perubahan konfigurasi, bukan bukti G8 lulus. Package workflow masih false, paket/keluarga layanan aktif 0 dan kasir aktif 0; UI buat nota tetap memerlukan konfigurasi paket Owner melalui Pengaturan Layanan & Harga. Tidak menetapkan durasi/tarif rekaan atau mengubah izin kasir. Verifikasi sesudah aktivasi: orders/payments/cash/point-links 0, direct app DML grants 0. Histori Binatu/backfill tetap tidak dijalankan. Status readiness tetap NO_GO karena bukti UAT/identitas/restore belum lengkap; checker preflight tidak dilonggarkan. Lihat [receipt aktivasi](./financial-activation-20261103.md). Checkpoint OFF sebelumnya adalah histori sebelum aktivasi ini.


> **Production schema migrated — 3 November 2026.** Seluruh 21 migrasi POS source17430c0 telah diterapkan melalui konektor Supabase pada hncfyfvqtlnvqyfrydzb setelah izin schema eksplisit Owner. Production kini22/22 tabel POS ber-RLS,1 outlet; write_enabled=false, finance_enabled=false, package_workflow_enabled=false; orders/payments/cash/point-links 0 dan direct app DML grants 0. Seluruh1.546 fingerprint schema yang dibandingkan identik dengan QA, dan13 tabel lama pada kolom asalnya memiliki jumlah/hash identik. Backup logis13 tabel publik aplikasi dibuat terenkripsi DPAPI lokal sesudah3 migrasi pertama dan sebelum18 sisanya; decrypt/readback PASS, bukan full PostgreSQL restore/Auth/Storage backup. **G8 NO-GO untuk aktivasi finansial** sampai bukti keamanan/UAT/restore yang tersisa terpenuhi. Histori Binatu/backfill tidak diperlukan pada scope awal keputusan Owner; member/poin lama dipakai langsung. Checkpoint lama yang menyebut Production0tabel atau migrasi menunggu izin adalah histori yang telah digantikan receipt ini. Lihat [receipt migrasi](./production-migration-20261103.md).


> **Bukti terkini — 3 November 2026:** source `a502c0bce9638990d314db0f033a48df464b2e9f` lulus [release CI](https://github.com/warasjawa-laundry/Mas/actions/runs/41595889142) dan [database CI](https://github.com/warasjawa-laundry/Mas/actions/runs/41595889081): 284 Node, TypeScript, build, 93 browser; replay semua migrasi, SQL rollback, race dua koneksi dan restore sintetis PASS. Seluruh 1.546 fingerprint schema/RLS/hak efektif aplikasi QA identik dengan replay CI. Deployment existing Production `mas`, `dpl_9RVoM9zYWJT4dg1a8PMF2oeyDbFA`, READY pada SHA tersebut dan domain masjawalaundry.web.id. Production POS **0 tabel**, baseline legacy tetap sama; QA **22/22 RLS**, write/finance/package-mode OFF dan tidak ada transaksi/customer sintetis tersisa. **G8 NO-GO**, external evidence dan approval Production belum ada. Koreksi preflight terakhir mengubah kontrak 20 menjadi 22 tabel, dengan tes regresi red→green; tidak mengubah flag atau bukti bisnis. Paragraf checkpoint sebelumnya adalah histori, bukan status terkini. Lihat [receipt rilis](./release-20261103.md).


> **Checkpoint terkini sebelum final CI (2 Nov 2026): PROVISIONAL / G8 NO-GO.** Root mengonfirmasi ketiga migrasi canonical telah diterapkan **QA saja**: `20261102190000_pos_owner_creation_duration_snapshots.sql`, `20261102193000_pos_owner_operations_shared_cores.sql`, `20261102210000_pos_import_review_audit.sql`. Fixture owner duration, owner operations, import audit dan regresi existing G5/G6/G2 PASS setelah apply. `write_enabled=false` dan `finance_enabled=false`. Lima browser test wizard sintetis PASS pada 320/390/1440px memakai mocks; ini bukan real Auth atau PHYSICAL_UAT. Synthetic restore dan race tambahan menunggu CI yang akan datang, **belum PASS**. Final tree/CI dan deployment paket baru belum disertifikasi. Produksi tetap 0 tabel POS; tidak ada mutasi produksi. Lihat [master audit](./master-audit-20261102.md) untuk dependensi dan bukti penutupan.

**STATUS: IN PROGRESS / NO-GO untuk transaksi produksi.** Dokumen ini adalah daftar uji manual, bukan klaim bahwa pemilik/pegawai atau HP Android sudah diuji. Gunakan perangkat milik outlet satu-satunya, data sintetis dan login ID kasir tanpa pairing; jangan gunakan data pelanggan sebenarnya untuk uji. **Jangan mencatat pembayaran pelanggan nyata sebelum G8 disetujui.**

## Peta 25 referensi Binatu (commit c17b043)
| Screenshot | Fungsi | Posisi di Mas Jawa / status |
|---|---|---|
| 01–02 | Pesanan & menu kasir | `/kasir`, `/kasir/pesanan`: tersedia secara kode; mobile bottom navigation/paritas piksel belum dibuktikan |
| 03 | Pilih pelanggan | Guest/member, nomor, QR/barcode dan pencarian nama prefix min 3; identitas dipilih manual, UAT fisik pending |
| 04 | Durasi per layanan (keputusan Owner) | Wizard tiga tahap; tidak ada langkah Durasi terpisah. Mixed service snapshots/known-only ETA tersedia QA; signoff policy/perangkat pending |
| 05–11 | Kartu layanan, +/- qty, sticky Lanjut | `/kasir/pesanan/baru` tersedia; G7 memperjelas warna kuning/tombol; belum screenshot-to-screenshot UAT |
| 12–14 | Parfum, antar-jemput, diskon | Parfum/catatan tersedia; **GAP:** antar-jemput/ongkir dan diskon belum terimplementasi |
| 15–17 | Rincian nota, status kerja, siap ambil | `/kasir/pesanan/[id]` tersedia; periksa di HP nyata |
| 18–20 | WA dan bayar | Draf WA salin manual, DP/lunas/refund kode QA; kirim otomatis tidak ada |
| 21–22 | Periode/mutasi kas | `/kasir/kas`, `/kasir/laporan`: kode QA; uji hitung uang fisik dan CSV |
| 23–25 | Manajer/kasir/akun petugas | Login owner ID/password dan kasir ID MAS-XXXX tanpa pairing/password; UAT rate-limit, izin/revoke belum dilakukan |

**Kriteria desain:** hierarki, lokasi CTA, tab, sheet, kartu, scrolling dan label seperti referensi; warna/identitas menggunakan Mas Jawa (aksen kuning untuk POS), tanpa logo/aset Binatu. Audit ini *source-based*, **bukan klaim 25/25 visual pass**. Rujukan: [README referensi](https://github.com/warasjawa-laundry/Mas/tree/c17b043d2a2480adbe0bcd05d39d961c398db603/docs/references/binatu).

## Pemeriksaan fisik wajib (belum ditandatangani)
| No | Skenario | Expected | Bukti / penanggung jawab |
|---|---|---|---|
| 1 | Android Chrome, keyboard angka/desimal, layar kecil & rotation | Tombol +/- 44px, sticky total tidak menutup input | Pending owner/staff |
| 2 | Login owner membuat ID kasir; karyawan langsung MAS-0001 tanpa pairing; revoke sesi di tengah transaksi | Kasir cabut/revoke ditolak pada RPC baru | Pending |
| 3 | Kamera QR aktif, kamera ditolak, screenshot dari galeri, URL QR palsu | Kartu valid memilih nomor; invalid/revoked gagal; tidak ada poin | Pending |
| 4 | Member sama nama, nomor member dan poin saat lunas | Identitas tidak otomatis ditebak; ADD sekali | Pending |
| 5 | DP, lunas, dua pembayaran bersamaan, jaringan putus setelah commit | Retry UUID sama; tak ada receipt/poin ganda | Pending fisik; race CI terpisah |
| 6 | Cash masuk/keluar, selisih tutup shift, beda metode | Kas tunai tidak termasuk noncash, selisih butuh alasan | Pending kasir + owner |
| 7 | XLSX asli 200 nota, duplikat, review lunas per baris | Identity manual, nota unik, tidak memposting poin | Pending owner |
| 8 | WhatsApp draf & consent, cetak HTML nota | Tidak auto-send; tidak mengungkap QR/token | Pending |
| 9 | Legacy owner scan, kartu, portal /k/[token], promo & history | Semua modul lama tetap berfungsi | Pending |
| 10 | Side-by-side 25 screenshot pada viewport yang sama | Owner tanda tangan setiap penyimpangan yang disetujui | Pending |

### Klasifikasi gate
- **Terverifikasi otomatis:** struktur SQL/ACL RLS, parser, regresi historis, build, dan tes race dua sesi CI (hanya bila job CI hijau).
- **Tidak terverifikasi:** kamera/QR fisik, perangkat Android nyata, terminal printer, uang tunai fisik, penilaian visual owner, portal live seusai posting, dan rekonsiliasi Binatu asli.
- Semua P0/P1, selisih rupiah, salah member atau poin ganda memblokir G8.


## Instruksi uji tambahan — wizard G7 durasi/member

- Bandingkan screenshot 03–04 dan 05–14: member nama sama harus bisa dipilih manual berdasarkan **nomor**, pencarian min 3 karakter, QR tidak membuat ADD. Pilih beberapa layanan berdurasi berbeda dalam satu nota: total harus memakai harga/revisi service masing-masing dan seluruh pilihan tetap terlihat.
- Uji Tab/Shift+Tab, Enter, Back/Next dan focus/error di wizard tiga tahap; tidak ada bottom sheet durasi. Periksa zoom 200% dan 320px HP.
- Bandingkan parfum preset/kustom; pastikan semua opsi harga non-layanan (ongkir/diskon) **tidak mempengaruhi total** dan tidak dikirim ke RPC G4 sebelum disahkan owner.
- Saat QA database belum terpasang, lihat pesan kesalahan yang jelas, tidak menyimpan transaksi diam-diam. Semua skenario ini **belum ditandatangani oleh kasir/owner nyata**.

### Gate keamanan login karyawan empat angka (perubahan 2 Nov 2026)

- [ ] Login kasir ID-only `MAS-XXXX` tanpa pairing pada Android nyata dan browser desktop, sementara admin tetap memakai ID/password.
- [ ] Salah ID, ID nonaktif, pencabutan semua sesi, dua token cookie hilang, 12 jam kedaluwarsa, dan max lima sesi teruji.
- [ ] Rate limit seluruh outlet 10 percobaan/menit / lock 5 menit; ukur denial-of-service dan dokumentasikan risiko penyamaran akibat ID empat angka mudah ditebak.
- [ ] Owner menyetujui kontrol identitas yang memadai sebelum POS finansial diaktifkan. Tanpa ini tetap G8 NO-GO.


## Update UAT dari keputusan Owner: wizard tiga tahap
- Uji Pelanggan → Layanan → Konfirmasi pada 320/360/390/768/1440px. Tidak boleh ada langkah Durasi terpisah atau filter durasi global yang menghilangkan layanan terpilih.
- Pilih dua variasi layanan dengan paket/durasi berbeda di nota sama. Verifikasi kedua item, label durasi, dan tarif katalog yang tepat di konfirmasi.
- Owner membuka Menu → Pengaturan → Layanan & Harga; ubah durasi pada layanan tertentu tanpa mengubah layanan lainnya. Uji datalist opsi hanya saran, input kustom tetap valid; harga historis tidak tertimpa.
- Snapshot durasi/revisi dan ETA elapsed known-only per item tersedia QA; order memakai ETA maksimum bila semua item known. Range/blank tetap PENDING/null. Sebelum G8 GO wajib signoff kebijakan dan hasil cetak, termasuk layanan campuran; jangan menjanjikan ETA untuk label ambigu.


## Gate identitas sebelum aktivasi finansial

ID MAS empat angka adalah pengenal publik yang dapat diketahui orang lain. Throttle global hanya membatasi tebakan dan dapat menyebabkan DoS; ia **tidak mencegah impersonation bila ID sudah diketahui**. Owner bersama reviewer keamanan/operator jaringan wajib memilih dan menguji kontrol yang memadai, misalnya akses dari trusted workplace network yang benar-benar dibatasi atau identitas yang lebih kuat. Simpan keputusan, batas ancaman, negative test akses tak berhak dan reviewer sebagai bukti privat sebelum finance. Tidak ada perubahan kontrol tersebut yang dianggap telah diterapkan dari dokumen ini. Daftar siapa/bukti penutupan ada pada [master audit](./master-audit-20261102.md#tindakan-eksternal-wajib-dan-pemilik-bukti).


### Tambahan 3 November 2026

Uji tambahan: empat tahap, satu paket dan konfirmasi ganti paket; edit durasi/harga tidak mengubah nota lama; DP→pelunasan→poin ledger→WA baru; unpaid/DP/refund/zero tidak dapat diserahkan; histori aktor dan nota Sudah Diambil tetap dapat dicetak. Android kamera/galeri, WA terpasang dan printer nyata: PHYSICAL_UAT_REQUIRED.


### Estimasi kalender otomatis
Uji paket dari waktu masuk 31/12/2026 23:30 WIB: durasi 6 jam harus menjadi 01/01/2027 05:30 WIB, dan 2 hari menjadi 02/01/2027 23:30 WIB. Uji 31 Januari, Februari kabisat/nonkabisat, pergantian paket, serta perangkat dengan timezone berbeda; tampilan tetap WIB. Pratinjau boleh maju sebelum simpan, nota tersimpan memakai waktu final database. Uji fisik tetap PHYSICAL_UAT_REQUIRED.
