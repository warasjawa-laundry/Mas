# Master audit POS G0–G8

Status diperbarui 3 November 2026 terhadap baseline main `fe04ef7` dan perubahan teruji pada paket ini. **Pilot dummy aktif; G8 untuk transaksi pelanggan nyata tetap NO_GO.** Ini menggantikan checkpoint lama pada dokumen yang sama. Riwayat sebelum rekonsiliasi tersedia pada [versi fe04ef7](https://github.com/warasjawa-laundry/Mas/blob/fe04ef7f1a9f7d65baece7373a708e730586d058/docs/pos/master-audit-20261102.md).

## Kondisi yang benar-benar diperiksa

- Repo `warasjawa-laundry/Mas`, branch main; proyek Vercel existing `mas` dan domain `masjawalaundry.web.id`. PR #30 tidak digunakan atau diubah.
- Production `hncfyfvqtlnvqyfrydzb` dan QA `cwxsbgfjynwxqalwonae` ACTIVE_HEALTHY. Keduanya mempunyai 22 tabel POS publik dengan RLS dan tanpa direct app DML grant. Metadata 1.594 entri yang dibandingkan sama, termasuk fungsi/konfigurasi, kolom/constraint, RLS flags dan hak efektif anon/authenticated. Scope ini tidak mencakup seluruh objek provider/Auth/Storage.
- Production: write, finance, package-workflow dan pilot-test-only ON. Tiga paket, 14 keluarga layanan dan 31 tarif aktif telah tersedia. Kasir aktif 0. Pada snapshot verifikasi terakhir ada 1 nota berpenanda uji, 1 pembayaran dan 1 cash row; POS point-links 0. Nota/pembayaran ini sudah ada sebelum migrasi pengaman pada review ini, dipertahankan tanpa penghapusan atau posting ulang.
- QA: flags write/finance/package/pilot OFF, data pelanggan Production tidak disalin; fixture rollback selesai tanpa nota/payment/cash/point-link tersisa. Katalog non-PII tersedia untuk QA.
- Production mempertahankan 785 member, 18 kartu, 21 event dan 19 catatan nominal lama. Hash member/kartu/event/nominal sebelum dan sesudah migrasi pengaman sama. Review ini tidak mengubah flag, tarif, member, ledger atau izin kasir.
- Backup lokal 13 tabel publik aplikasi terenkripsi DPAPI masih dapat didekripsi dan diverifikasi. Backup tersebut bergantung pada profil Windows pengguna; Auth, Storage dan arsip private tidak termasuk. Full PostgreSQL restore/RPO/RTO belum dibuktikan.

## Scope yang berlaku

Wizard Pelanggan → Durasi → Layanan → Konfirmasi memakai satu paket per nota dan jam kalender. Owner mengatur paket/tarif; harga, ongkir, revisi dan estimasi final disahkan database. UI Argon tetap digunakan. Histori Binatu/backfill bukan kebutuhan rilis awal; database member dan ledger poin lama digunakan langsung. Impor preview tetap tersedia tanpa posting uang/poin otomatis.

Pilot sekarang hanya untuk guest dummy bernama `UJI - ...`, bukan pelanggan/member nyata atau uang nyata. Penanda `is_test_order` berasal dari DB dan immutable. Menonaktifkan pilot, menghapus data uji atau membuka cutover riil bukan bagian dari review ini.

## Matriks gate dan sisa acceptance

| Gate | Implementasi/bukti yang sudah ada | Status aktual | Sisa yang relevan |
| --- | --- | --- | --- |
| G0 | Baseline source, proyek, domain dan snapshot aggregate direkonsiliasi | DONE untuk baseline review ini | SHA hasil integrasi/CI/deployment diperiksa pada penutupan paket |
| G1 | Isolasi QA, negative environment tests, restore sintetis CI | PARTIAL | Restore backup aktual pada target sah, RPO/RTO dan real-session isolation UAT |
| G2 | Schema sudah di Production/QA; RLS, ACL, actor, immutable journal, lock/idempotency dan SQL rollback/race tersedia | PARTIAL | Real Auth acceptance lintas role dan bukti restore penuh; schema tidak perlu dipasang ulang |
| G3 | Owner ID/password, MAS-XXXX, Owner kelola izin dan revoke; katalog paket aktif | PARTIAL | Mitigasi known-ID impersonation/DoS dan UAT sesi/perangkat; throttle bukan autentikasi kuat |
| G4 | Wizard empat tahap, lookup/scan/member QA, snapshot/ETA, ongkir otoritatif, cancel/status/handover | PARTIAL | Real Auth/network-loss dan scanner/print fisik; member sengaja tidak dipakai dalam pilot Production |
| G5 | DP/lunas/full refund, cash dan points once pada QA, two-connection races | PARTIAL | Real financial reconciliation/signoff; pembayaran pilot bukan penerimaan uang nyata |
| G6 | Shift/kas/report/export, receipt/WA dan actor timeline | PARTIAL | Hitung kas/printer/WA fisik, opening balance dan penutupan shift; identifikasi seluruh jurnal simulasi |
| G6b | Parser/preview/review audit impor tersedia | Tidak menjadi gate rilis awal | Rekonsiliasi Binatu diperlukan hanya bila impor/open receivable dipilih kemudian |
| G7 | Regresi browser, mobile/keyboard/print emulation, Argon dipertahankan | PARTIAL / PHYSICAL_UAT_REQUIRED | Android camera/gallery, printer, WA dan 25-screen Owner signoff |
| G8 | Schema terpasang, pilot terbatas dan checker fail-closed | NO_GO untuk live riil | Semua acceptance eksternal di bawah serta penghentian/pembersihan pilot yang disetujui |

## Temuan lama: pekerjaan yang tidak diulang

| ID | Status koreksi source | Batas bukti |
| --- | --- | --- |
| A01–A03 | Recovery mempertahankan UUID, form dan lookup terotorisasi; payload berbeda ditolak sebagai conflict | Network-loss/re-auth fisik tetap UAT; tidak mengklaim semua input tidak bisa diedit |
| A04 | Cancelled/unknown import tidak MATCHED; footer mismatch ditolak; review append-only | Format subtotal yang tidak didukung ditolak; histori Binatu di luar scope awal |
| A05 | Tombol print kasir mengikuti capability | Browser tetap dapat mencetak data sah yang sudah terlihat |
| A06 | Shared core memakai occurrence yang konsisten untuk receipt/amount/point/report | Boundary waktu dan rekonsiliasi operasional tetap diperiksa dalam UAT |
| A07–A10 | Owner actor sendiri, snapshot harga/durasi, family/package dan handover guard sudah terhubung | Tidak perlu membangun ulang order/payment/catalog |
| A11–A12 | Receipt membaca ledger terkini, kontak berotorisasi dan settings berversi | Batas nota pilot diperkuat pada B02–B03 di bawah |
| A13–A16 | Canonical replay, semantic metadata, comparator ACL restore, router fixture dan kontrak 22 tabel diperbaiki | History timestamp provider bukan source of truth; jangan copy history QA |
| A17–A18 | Risiko ID-only dan evidence eksternal tetap terbuka | Tidak ditutup oleh aktivasi flags, SQL set_config atau hasil sintetis |

## Koreksi yang dikerjakan pada review ini

| ID | Temuan terverifikasi | Penyelesaian |
| --- | --- | --- |
| B01 | Empat dokumen mengulang checkpoint yang saling bertentangan: Production 0 tabel, katalog belum aktif, wizard tiga tahap | Dokumen yang sama direkonsiliasi; receipt migrasi/aktivasi dan Git history tetap menjadi riwayat |
| B02 | Preflight dapat menerima kandidat dengan pilot aktif atau test orders tersisa | Harus explicit pilot=false dan test-order-count=0; unknown/string/null ditolak, evidence finansial tetap wajib |
| B03 | DTO receipt tidak membawa marker uji; penanda halaman bergantung pada prefix nama dan warning kasir tersembunyi saat print | Marker DB diteruskan ke Owner/Kasir/receipt; notice tetap tercetak; receipt uji diberi watermark, tanpa bank/payment notice nyata; kontak uji ditolak DB dan tautan WA tidak ditawarkan |
| B04 | Ongkir sudah masuk total DB tetapi tidak diteruskan ke detail nota | DTO dan kedua halaman menampilkan subtotal, snapshot ongkir serta total; rumus harga tidak diubah. Owner juga melihat parfum/catatan tersimpan |

Migrasi additive `20261103210501_pos_pilot_receipt_boundary.sql` hanya mengubah metadata pembaca dan menolak insert kontak pada nota uji. Sudah diuji di QA lalu diterapkan Production; flags serta nilai existing tidak berubah. Tidak ada tes pembayaran Production yang dijalankan oleh review ini.

## Bukti otomatis dan batasnya

297 tes Node, TypeScript, build dan 96 browser lokal PASS. SQL QA baru membuktikan marker Owner/Kasir, snapshot ongkir, pembayaran simulasi, penolakan kontak test dan receipt normal tanpa false-positive prefix. Fixture receipt/points/revoke yang sudah ada juga PASS. RED marker/ongkir sebelum perbaikan direproduksi; satu setup awal parfum `Tidak` ditolak sebagaimana kontrak (opsi tanpa parfum mengirim null), lalu fixture memakai Sakura. Tidak menurunkan validasi untuk membuat test hijau.

CI menjalankan replay canonical seluruh migrasi, fixture SQL, restore sintetis dan race dua koneksi. Fixture baru juga dijalankan sesudah restore. Hasil lokal/CI tidak menggantikan login manusia, physical UAT, backup restore penuh atau rekonsiliasi kas nyata. Bukti final CI dan SHA tersedia pada commit integrasi, bukan dikarang dari checkpoint lama.

## Tindakan eksternal wajib dan pemilik bukti

| Tindakan | Pemilik | Bukti penutupan |
| --- | --- | --- |
| Kendalikan risiko MAS-XXXX | Owner + reviewer/operator keamanan | Kontrol yang benar-benar diterapkan dan negative test known-ID impersonation, revoke/expiry/DoS; bukan persetujuan risiko saja |
| Backup/restore penuh | DBA/operator + Owner | Target restore sah, Auth/Storage scope, execution log, checksums, RPO/RTO dan reviewer; jangan menyalin PII ke QA sembarangan |
| Real Auth dan perangkat | Owner/kasir/tester | Login→nota→DP/lunas/refund, lost response/retry, izin/revoke, QR/barcode/gallery, printer/WA dan signoff 25 layar |
| Rekonsiliasi dan akhir pilot | Owner + pemeriksa keuangan/operator | Klasifikasi/arsip seluruh nota/jurnal simulasi, shift/kas/poin/opening balance dan cutoff. Jangan DELETE/TRUNCATE ledger; pertahankan member/kartu |
| Cutover riil | Owner + operator release | Pilot OFF, test orders dibereskan, evidence SHA-bound diterima dan approval peluncuran; tidak otomatis karena flags sudah ON |

Keputusan pilot pada main menyebut target operasional Januari 2027 dan riwayat kas/poin lama sebagai data dummy yang perlu ditinjau sebelum peluncuran. Ini tidak mengizinkan review ini menghapusnya. Sisa di tabel ini tidak dapat diberi PASS oleh agen tanpa tindakan/bukti nyata.
