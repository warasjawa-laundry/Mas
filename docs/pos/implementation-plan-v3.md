# POS V3: kuantitas, kas otomatis, laporan dan cetak

5 November 2026, baseline main02ce813. Acuan: rencana V3 Owner. Satu paket integrasi, tanpa PR30, penghapusan histori atau aktivasi transaksi riil. Antislop diterapkan selama kerja, identitas Argon MasJawa dipertahankan. ENERGY2/RHYTHM2/MOTION1.

1. Audit kontrak existing: uang/kuantitas berskala1000, snapshot item, receipt RPC, ledger, identitas actor, report dan authorization. Pertahankan perhitungan serta idempotency yang sudah benar.
2. Kuantitas: koma/titik maksimal3 desimal, pcs bulat; langkah1/10/100/1000 milli, default100 untuk kg/m,1000 pcs. UI besar, unit jelas, preferensi browser non-sensitif. Uji nilai tidak sejajar langkah, kosong, negatif, batas dan input sementara.
3. Kas: sesi teknis dibuat otomatis dalam command terotorisasi, dengan lock outlet dan carry saldo historis. Hilangkan pembukaan/penutupan manual; Cocokkan Kas Owner mencatat selisih tanpa membuat uang atau menghapus jurnal. Pertahankan pilot/finance gates dan actor server.
4. Sumber baca: cash overview menghubungkan order_id, invoice, customer, actor dan payment ke snapshot item; tidak menyalin kuantitas per payment. Report read-only memisahkan invoice/item/payment dan membatasi93 hari/jumlah baris.
5. Excel: empat sheet Ringkasan/Daftar Nota/Rincian Layanan/Mutasi Kas, angka numerik, tanggal WIB, kategori/satuan terpisah, filter/header, proteksi formula injection. CSV tetap ada. Uji DP/pelunasan beda hari dan anti join multiplication.
6. Receipt: komponen thermal58/80 memakai receipt RPC yang sama dengan WhatsApp; qty3 desimal dan unit snapshot, nominal kanan, wrap, print-only. Refund tidak menghasilkan tagihan baru. Uji print emulation, cetak ulang/WhatsApp tetap read-only.
7. QA sintetis rollback, auth/ACL, retry/concurrency, build/TypeScript, browser phone/desktop dan independent review; satu commit/CI setelah seluruh koreksi. Rutin V3 yang secara khusus diminta Owner dipasang additive setelah QA/CI dalam Mode Uji. Tidak ada backfill/migrasi pelanggan atau aktivasi transaksi riil; cutover tersebut tetap memerlukan persetujuan terpisah. Deploy hanya exact SHA terverifikasi di proyek mas existing.

UAT printer fisik/driver, auto-cut, Android, real Auth, rekonsiliasi uang dan sign-off G8 tetap eksternal. Tidak boleh dicatat PASS tanpa bukti. Detail hasil dan blocker diperbarui setelah eksekusi.

## Hasil implementasi lokal dan QA

| Tahap | Status teknis dan bukti |
| --- | --- |
| A kuantitas | IMPLEMENTED_QA: koma/titik,3desimal, pcs bulat, langkah1/10/100/1000milli, default100kg/m dan1000pcs. Nilai tidak sejajar langkah dan input sementara invalid diuji. Input90px/unit jelas, preferensi lokal non-sensitif. |
| B nota/pembayaran | IMPLEMENTED_QA: empat tahap V3 dipertahankan. DP/pelunasan pada nota sama tanpa shift manual. Transfer/QRIS disimpan di metadata immutable, core tetap CASH/NONCASH. Kontak diverifikasi pada nota tersimpan melalui UI existing, tidak ditebak dari hasil member lookup. |
| C kas | IMPLEMENTED_QA: command V3 terotorisasi menyiapkan sesi teknis dengan lock outlet, GET/login tidak menciptakan uang. Opening merupakan carry book balance; constraint diperluas untuk defisit historis. Core lama, actor, idempotency dan pilot/finance gates tetap. |
| C rincian/audit | IMPLEMENTED_QA: mutasi→detail nota/snapshot item, pembuat/penerima/refund terpisah. Cashier tanpa order_view tidak mendapat customer/link. Cocokkan Kas Owner menyimpan expected/count/difference/time/reason/actor, UUID idempotent, history30 terbaru. Hitungan pilot diberi is_test, bukan rekonsiliasi riil. Tidak mengubah ledger. |
| D thermal/WA | IMPLEMENTED_QA: satu shared backend receipt core, print membutuhkan receipt_print+order_view, WhatsApp tetap whatsapp_draft.58/80mm, nominal kanan, wrap, qty3desimal, marker uji/poin; print portal meniadakan sidebar/tombol. Refund sisa0 tanpa mengubah snapshot accounting. |
| E Excel | IMPLEMENTED_QA:4sheet numeric/filter/freeze/WIB, formula sebagai literal. Gross tagihan/qty nota dibuat dalam periode dipisah dari cash-event periode; saldo CURRENT dilabeli. Nota lama dibayar periode ikut daftar tanpa menggandakan tagihan/qty. CSV tetap. SQL cap1000nota/5000cash/30000item; exporter10000baris per array/20MiB;422 meminta periode lebih kecil. Mode Uji ditandai. |
| F regresi |333 Node,140 browser, build/typecheck lokal PASS; V3 dan5 suite legacy SQL QA rollback PASS. SQL→XLSX aplikasi→zipfile/openpyxl membuktikan4sheet, qty numerik1.25/2.35/3 dan6 cash events independen. CI dua-koneksi wajib sebelum rilis. |
| UAT/go-live | PHYSICAL_UAT_REQUIRED: printer58/80, driver/paper cut, Android/TalkBack, real Auth, rekonsiliasi uang dan approval Owner. G8 real NO_GO. |

Ruling: API lama pembukaan/penutupan kas dipertahankan untuk kompatibilitas, tombolnya dihapus dari UI aktif. Rutin baru/table private V3 tidak melakukan backfill, penghapusan histori, perubahan poin/katalog atau flag. Pemasangan teknis Mode Uji bukan izin transaksi riil dan tidak otomatis berubah saat2027.

QA menemukan status pembayaran bukan kolom orders dan enum refund FULLY_REFUNDED; report sekarang menghitungnya dari penerimaan/snapshot. Review menutup dua P2: report-limit422 dan history Cocokkan Kas Owner. Tes lama yang mewajibkan tombol shift/menolak TRANSFER diperbarui sesuai V3; validasi nominal, izin dan idempotency tetap. Case lintas periode SQL memakai cutoff server di antara DP/lunas; fixture Excel menggunakan tanggal berbeda, bukan klaim memajukan jam RPC. Fixture rollback seluruhnya; tidak menyalin PII Production ke QA.

## Rilis dan rollback

Perbaikan filter laporan (5 November 2026): formulir tanggal Owner/Kasir memakai `next/form` agar GET dilakukan melalui router. Formulir HTML sebelumnya memuat dokumen baru dan memicu aturan reauthentication Owner, sehingga sesi dicabut saat menekan Tampilkan laporan. Proxy, batas sesi, backend role/grant, dan validasi periode tetap berlaku. Regresi memeriksa kedua tanggal dan role, serta membuktikan router internal tidak mencabut sesi sementara refresh dokumen tetap meminta login. Gejala kasir di akun nyata belum dikonfirmasi; pemeriksaan grant/session kasir tetap di backend.

Verifikasi perbaikan filter: tes baru mula-mula gagal pada kedua formulir native, lalu lulus setelah perubahan. Focused18/18, seluruh Node336/336, browser141/141, build+TypeScript lulus. Tidak ada migrasi atau perubahan data. Perjalanan login akun nyata tetap memerlukan UAT; tes ini memakai identitas/session sintetis.

Migrasi46:20261105010000_pos_v3_automatic_cash_reports.sql. Private helper/tables RLS+ACL tertutup, shared receipt search_path kosong. Cached command tetap memeriksa actor/digest, beda channel UUID ditolak dan legacy NONCASH tidak diberi label transfer/QRIS tanpa bukti. Final SHA/CI/deployment/integrity dicatat pada receipt rilis setelah benar-benar ada.

Rollback aplikasi ke deployment terverifikasi sebelumnya; biarkan schema additive untuk menjaga histori baru. Jangan drop metadata pembayaran/reconciliation atau mempersempit opening constraint jika carried balance sudah dipakai. Core lama tidak diganti; tidak ada rollback dengan menghapus transaksi.

## Antislop delivery gate

Scope PASS adalah otomatis/lokal, bukan sign-off fisik. Design Read: POS laundry existing Argon violet-blue, karyawan operasional, ENERGY2/RHYTHM2/MOTION1. Brand/sidebar/type existing dipertahankan; input besar untuk timbangan, unit berdekatan; print monokrom demi keterbacaan dan kertas. Tidak membuat aset atau angka bisnis baru.

| Item | Status dan bukti |
| --- | --- |
| R-02 | PASS: copy baru langsung tanpa em dash/buzzword; marker kebijakan existing dipertahankan. |
| R-03 | PASS: layar320/390/768/1440, wrap qty/service, paper58/80. |
| R-17 | PASS: snapshot backend dan angka scaled; tanpa statistik fiktif. |
| R-18 | PASS: tanpa testimonial/avatar. |
| R-23 | PASS: aset dan navigasi existing. |
| R-24 | PASS: mutasi→nota dan endpoint laporan nyata. |
| R-25 | PASS: checker input14.13:1, kontrol11.00, border5.30, thermal21, CTA8.29. |
| R-26 | PASS: qty, retry, pembayaran, detail, Excel, hitungan dan print punya tindakan. |
| R-27 | PASS: cash unavailable/empty, receipt pending/error/retry/ready, export422/503. |
| R-28 | PASS: tanpa FAQ generik. |
| R-32 | PASS: native controls/labels/aria-invalid/keyboard/fokus. |
| R-33 | PASS: UI/CSS langsung apply_patch; scripts hanya fixture/verifikasi. |
| R-34 | PASS: tema existing; tidak menambah toggle parsial. |
| R-35 | PASS: build/Node/browser/SQL dan pembaca Excel independen; printer fisik pending. |
| R-36 | PASS: tidak mengklaim dana riil/printer/G8 atau sertifikasi palsu. |
| R-37 | PASS: direction/dials dicatat sebelum kerja. |
| R-38 | PASS: fixture sintetis terpisah, produk dari snapshot/rules. |
| R-01 | PASS: warna brand, tanpa gradient baru. |
| R-04 | PASS: tanpa ikon generik baru. |
| R-06 | PASS: font existing, angka tabular, thermal sederhana. |
| R-07 | PASS: tanpa pola baru. |
| R-08 | PASS: plus/minus bermakna, tidak menambah panah dekoratif. |
| R-09 | PASS: marker Mode Uji untuk audit, tanpa capsule promosi. |
| R-10 | PASS: tanpa glass. |
| R-12 | PASS: panel existing tanpa shadow berlapis. |
| R-13 | PASS: tanpa glow/pulse. |
| R-14 | PASS: qty/cash/report berbeda sesuai tugas. |
| R-19 | PASS: MOTION1, tanpa loop animasi. |
| R-22 | PASS: tanpa ilustrasi generik. |
| Dials | PASS: ENERGY2/RHYTHM2/MOTION1 sesuai POS existing. |
| Focal point | PASS: input, pembayaran atau print sesuai keputusan layar. |
| Whitespace | PASS: input/unit dekat, kelompok kas/laporan terpisah. |
| Accent | PASS: violet tindakan utama, print monokrom. |
| Motif | PASS: nota, unit laundry, Rupiah/WIB dan identitas MasJawa. |
| Design Read | PASS: direction dinyatakan sebelum implementasi. |
| C-1 | PASS: keputusan layout/type/spacing untuk input/audit/cetak. |
| C-2 | PASS: tidak ada dead control/success palsu. |
| C-3 | PASS: tanpa section template tambahan. |
| C-4 | PASS: error/pending/empty/retry, mobile, label panjang, print. |
| C-5 | PASS: otomatis dibedakan dari physical acceptance. |
| R-05 | PASS: workflow existing, tanpa bento/chart/card dekoratif. |
| R-11 | PASS: radius layar existing, kertas tanpa pill. |
| R-15 | PASS: Simpan mutasi/Cocokkan Kas/Unduh Excel/Cetak Nota spesifik. |
| R-16 | PASS: bahasa operasional sederhana. |
| R-20 | PASS: kg/m/pcs, DP/refund dan nota menentukan struktur. |
| R-21 | PASS: tema brand dan kertas putih existing. |
| R-29 | PASS: palette existing tanpa warna baru. |
| R-30 | PASS: tidak meniru produk lain. |
| R-31 | PASS: alasan utama dicatat di atas. |

Supplement UI/copy/human/mobile PASS untuk lingkup otomatis: CTA spesifik, tanpa data/aset/claim fiktif, target44px/fokus/kontras/reflow/states. TalkBack/perangkat/printer fisik belum PASS.

Trace: empat langkah qty→angka tepat;1.25 tambah/kurang→pecahan tetap; koma→quote/payload dot; pcs pecahan→invalid; Lanjut/Kembali→empat tahap; disclosure kas→form; rincian→route nota; Excel→workbook numerik/CSV tetap; baca print→58/80 preview; cetak→portal-only; gagal→retry; rereadrefund→sisa0. Financial actions diuji via SQL/action sintetis, bukan pembayaran Production; WhatsApp manual dan agen tidak mengirim pesan.
