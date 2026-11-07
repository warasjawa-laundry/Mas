# POS V3.1: nota pelanggan dan audit transaksi

Pelaporan enam sheet, periode inklusif dan rekonsiliasi kini dilanjutkan di [V3.2](implementation-plan-v3.2.md). Dokumen ini mempertahankan bukti baseline V3.1; perubahan laporan tidak mengaktifkan G8 uang nyata.

Tanggal mulai: 6 November 2026 (WIB). Baseline `47f517c`. Spesifikasi V3.1 dari Owner menjadi otoritas; desain Argon dipertahankan. Antislop selama pengerjaan, ENERGY2/RHYTHM2/MOTION1, cetak monokrom.

| Tahap | Lingkup dan bukti yang diperlukan | Status |
| --- | --- | --- |
| A | Snapshot Supabase tervalidasi, versi order/pembayaran, identitas pembuat/penerima, izin print/WA/audit terpisah | IMPLEMENTED_QA_PASS |
| B | Renderer thermal mandiri 58/80 mm, baca ulang sebelum print, profil per perangkat, PDF/screenshot | AUTOMATED_PASS; PHYSICAL_UAT_REQUIRED |
| C | Formatter WhatsApp mandiri, tiga jenis pesan, penerima terverifikasi, tidak ada klaim terkirim | IMPLEMENTED_QA_PASS |
| D | Audit internal dan referensi pembayaran, kontak saat pembuatan nota dan prefill verifikasi | IMPLEMENTED_QA_PASS |
| E | Kategori kas terstruktur, ringkasan kuantitas dari snapshot item, Excel empat sheet tanpa duplikasi | IMPLEMENTED_QA_PASS |
| F | Unit/integrasi/browser, SQL rollback QA, CI exact SHA, deploy proyek mas dan smoke | LOCAL_QA_PASS; CI_RELEASE_RECEIPT_REQUIRED |
| F fisik | Owner/kasir menguji login nyata dan printer/driver 58/80 mm; bukti bertanggal dan model perangkat | PHYSICAL_UAT_REQUIRED |

Ruling: spesifikasi telah menentukan satu sumber data dan tiga renderer; implementasi tidak memerlukan perancangan ulang POS. Fungsi inti pembayaran tetap dipakai, migrasi hanya additive.

Ruling: input kontak saat membuat nota disimpan sebagai draf yang belum diverifikasi. Kontak member dapat mengisi draf pada nota yang telah diotorisasi, tidak ditambahkan ke pencarian publik/nama. WhatsApp tetap memerlukan konfirmasi penerima. Draf bukan izin promosi.

Ruling: identitas pelanggan memakai nama petugas yang terbaca; UUID dan referensi internal hanya tampil pada audit yang berizin. Uang nyata, saldo member, dan jurnal lama tidak diubah untuk pengujian.

G8 uang nyata tetap **NO_GO**. Uji browser/PDF tidak menggantikan bukti cetak fisik, restore Production, rekonsiliasi dan persetujuan cutover.

## Implementasi dan bukti

`ReceiptData` divalidasi terpusat: kg/m/pcs, integer milli, pembulatan IDR, subtotal/biaya/diskon, transaksi terkonfirmasi, status dan versi. `buildWhatsAppReceipt` mandiri, alias `buildReceipt` dipertahankan. Thermal merender objek langsung, bukan memecah teks. `SystemOrderDetail` menyajikan pembuat, penerima pembayaran, waktu dan referensi audit; referensi internal tidak masuk struk pelanggan.

Migrasi berurutan: `20261106010000_pos_v31_receipt_snapshot.sql`, `20261106020000_pos_v31_cash_categories.sql`, `20261106030000_pos_v31_order_contacts.sql`. Core keuangan dan jurnal lama tidak ditulis ulang. RPC V3.1 print/WA menggunakan saldo yang dapat ditagih; RPC lama mempertahankan persamaan saldo akuntansi untuk rollback aplikasi. Private metadata RLS/default-deny, SECURITY DEFINER search_path kosong, explicit grant. Fungsi baca tidak menulis pembayaran, kas atau poin.

Kontak tersimpan atomik bersama nota melalui wrapper create-order existing. Request retry mengikat kontak asli dan menolak perubahan tanpa nota lain. Draf kontak pada nota berizin mengisi formulir WhatsApp; perubahan input membatalkan konfirmasi/draf lama. Pencarian member tetap tidak mengembalikan kontak. Nomor penerima harus dikonfirmasi sebelum WhatsApp dibuka; tidak ada pengiriman pesan oleh agen.

Thermal memakai area konten50/70mm sebagai titik awal kalibrasi, portal print-only dan footer singkat dari ketentuan resmi. Profil58/80 per perangkat. Sebelum dialog, snapshot dibaca ulang; perubahan isi/versi memerlukan konfirmasi ulang. Hanya timestamp snapshot/perhitungan yang diabaikan, bukan nominal atau aturan poin. PDF/screenshot sintetis ada pada `artifacts/`, bukan bukti printer asli.

Mutasi menampilkan jumlah layanan dan agregasi kg/m/pcs terpisah. Delapan kategori EXPENSE hanya OUT; modal EQUITY dan transfer TRANSFER dipisahkan dari beban operasional. Riwayat lama tetap belum diklasifikasi tanpa bukti. Excel empat sheet dan CSV tersedia. Unduhan memakai fetch berizin dan blob agar tidak memicu reset dokumen Owner; HTML login/403/422 tidak diunduh sebagai laporan berhasil.

Hasil lokal: **360 Node**, **164 browser**, build+TypeScript lulus; termasuk20 thermal, dua alur kontak/retry Owner/Kasir dan empat viewport audit. Delapan suite rollback QA lulus: receipt/cash/contact V3.1, V3, WhatsApp, simulasi poin, G5 pembayaran, operasi Owner. Fixture tidak menyisakan transaksi/member QA. CI menambahkan race dua koneksi untuk order/kontak dan kategori kas; PASS baru boleh dicatat setelah run exact SHA selesai.

Review menutup timestamp simulasi yang membuat print tak pernah selesai dan refund setelah pengambilan yang ditolak validator. Keduanya punya red→green regression. Tes V3 lama mengharapkan username; kini memeriksa nama petugas yang terbaca, tanpa mengendurkan referensi nota/actor/nominal. Tidak menghapus data, membuat bukti restore Production atau mengaktifkan uang nyata. Final SHA/CI/deployment/integrity dicatat pada receipt rilis setelah benar-benar ada.

## Antislop delivery gate

PASS berikut terbatas pada source/otomatis; printer dan login fisik tetap pending. Design Read: Argon MasJawa, operator laundry, ENERGY2/RHYTHM2/MOTION1. Trace: kontak→layanan→save gagal→retry payload sama; print58/80→reread→ubah pembayaran→konfirmasi lagi; offline→tanpa print; verifikasi→draf WA→persetujuan manual; kategori kas→jurnal→nota; unduh→blob/403/422 tanpa logout; audit pembuat/penerima→anchor ledger.

| Item | Hasil dan bukti |
| --- | --- |
| R-01 | PASS: palette existing, kertas monokrom. |
| R-02 | PASS: copy baru langsung; ketentuan/marker resmi dipertahankan. |
| R-03 | PASS: browser320/390/768/1440, paper58/80; nama/referensi panjang wrap. |
| R-04 | PASS: tanpa ikon generik baru. |
| R-05 | PASS: rincian/jurnal, tanpa bento dekoratif. |
| R-06 | PASS: type existing, angka tabular dan Arial thermal. |
| R-07 | PASS: tanpa pola dekoratif. |
| R-08 | PASS: kontrol berlabel, tanpa panah dekoratif baru. |
| R-09 | PASS: simulasi adalah penanda audit. |
| R-10 | PASS: tanpa glass. |
| R-11 | PASS: radius existing, kertas tanpa pill. |
| R-12 | PASS: tanpa shadow berlapis. |
| R-13 | PASS: tanpa glow/pulse. |
| R-14 | PASS: struk, komunikasi, audit berbeda sesuai tugas. |
| R-15 | PASS: CTA Cetak nota/Simpan kontak/Unduh laporan spesifik. |
| R-16 | PASS: bahasa operasional dan langkah pemulihan jelas. |
| R-17 | PASS: nominal snapshot, fixture diberi penanda sintetis. |
| R-18 | PASS: tanpa testimonial/avatar fiktif. |
| R-19 | PASS: MOTION1, tanpa loop. |
| R-20 | PASS: laundry, DP/refund dan ukuran kertas menentukan layout. |
| R-21 | PASS: tema existing konsisten, print hitam/putih. |
| R-22 | PASS: tanpa ilustrasi tambahan. |
| R-23 | PASS: aset dan navigasi existing dipertahankan. |
| R-24 | PASS: tautan nota/mutasi ke route dan anchor ledger nyata. |
| R-25 | PASS: checker CTA8.29:1, muted5.77:1, thermal21:1. |
| R-26 | PASS: handler/RPC nyata pada kontrol; trace di atas. |
| R-27 | PASS: empty/pending/error/offline/changed/retry diuji. |
| R-28 | PASS: tanpa FAQ generik. |
| R-29 | PASS: tidak menambah warna. |
| R-30 | PASS: Argon dipertahankan, tidak meniru produk lain. |
| R-31 | PASS: konten50/70mm demi printable area, referensi wrap demi HP. |
| R-32 | PASS: native label/keyboard/fokus, target44px dan role alert. |
| R-33 | PASS: UI/CSS lewat apply_patch; script hanya fixture/verifikasi. |
| R-34 | PASS: tanpa theme toggle parsial. |
| R-35 | PASS: build,360Node/164browser,SQLQA dan trace kontrol tercatat. |
| R-36 | PASS: tidak memalsukan printer/login/G8 sebagai PASS. |
| R-37 | PASS: direction/dials ditetapkan sebelum UI. |
| R-38 | PASS: fixture terpisah, tanpa angka bisnis karangan. |
| Dials/levers | PASS: input/nota/tindakan menjadi fokus, whitespace mengelompokkan transaksi. |
| C-1 | PASS: type/layout/wrap untuk operator dan kertas. |
| C-2 | PASS: tanpa dead action atau sukses unduh/pesan palsu. |
| C-3 | PASS: tanpa section dekoratif tambahan. |
| C-4 | PASS: pending/offline/changed/refund/cancel dan teks panjang diuji. |
| C-5 | PASS: otomatis dan perangkat fisik dibedakan. |

Supplement UI/copy/human/mobile: PASS untuk lingkup otomatis; label/fokus native, kontras terukur, reflow, copy spesifik tanpa klaim bisnis baru. Printer, TalkBack dan login akun nyata tetap PHYSICAL_UAT_REQUIRED.

## Penutupan review V3.1, 6 November 2026

Baseline review `bcf6947`; bagian ini melanjutkan dokumen yang sama. Tidak ada audit G8 baru atau perubahan keputusan NO_GO.

| Temuan | Perbaikan dan batasnya | Bukti |
| --- | --- | --- |
| Perpindahan dana satu sisi | Label menjadi Perpindahan uang laci (satu sisi); sumber untuk IN/tujuan untuk OUT wajib. Tidak membuat saldo rekening atau pasangan jurnal bank. Label jurnal/CSV baru juga eksplisit. | QA rollback: arah/prefix, label jurnal, retry lama, konflik nominal/arah dan histori tetap. |
| Modal/perpindahan dana oleh kasir | Kedua kategori hanya Owner. Kasir tidak mendapat opsi UI dan forged API ditolak backend sebelum menulis. | SQL cash_entry-only cashier, forged CAPITAL/CASH_TRANSFER serta retry sensitif ditolak. |
| Ringkasan layanan tanpa izin nota | can_view_order=false menghapus item_count, quantities_milli dan quantity_summary pada backend; UI juga tidak merendernya. reports_view tetap izin laporan terpisah. | QA overview/detail tanpa order_view; owner/order_view positif; reports_view diuji tersendiri. |
| Tautan jurnal lebih lama dari80 entri | Tautan membawa ?entry=UUID; lookup primary-key memeriksa cash_view dan outlet, lalu menyertakan satu entri yang diminta tanpa memuat seluruh histori. | QA entri di luar80 terbaru, missing/wrong-outlet/anon/inactive ditolak; tes kedua halaman dan bounded81/no duplikasi. |

Migrasi function-only `20261106040000_pos_v31_cash_review_closure.sql`: tidak memperbarui nominal, alasan, atau metadata historis. Retry Owner yang identik mempertahankan alasan/digest transaksi lama; ketentuan sumber/tujuan berlaku untuk pencatatan baru. Ini membatasi fitur laci secara jujur, bukan implementasi transfer dua rekening. Rekonsiliasi bank tetap di luar cakupan dan sebelum uang nyata tetap perlu keputusan/prosedur Owner.

Verifikasi lokal: **370 Node**, **168 browser**, build+TypeScript lulus. Empat suite QA rollback terkait lulus: cash-review baru, cash V3.1, V3 dan receipt V3.1. Review independen kode tidak menemukan P0/P1/P2 tambahan. Tes baseline reproduksi menerima perpindahan tanpa tujuan; setelah perbaikan ditolak. Fixture lintas outlet sempat gagal karena pembuatan kasir dilakukan setelah menambah outlet sintetis; urutan fixture diperbaiki tanpa melonggarkan fungsi Production. Dua tes UI sempat memakai locator label yang keliru; locator role combobox dipakai dan tes kembali lulus. CI exact SHA dan rilis tetap wajib sebelum migrasi Production/deployment.

Antislop closure PASS pada lingkup otomatis: direction/dials dan warna tetap; R-03/R-32 kontrol dua peran320/1440, field sumber/tujuan required, target44px; R-24 lookup historis nyata; R-26/R-27 kategori/arah/invalid/denied/selected states diuji; R-35 build370Node/168browser dan SQL QA; R-36 tidak mengklaim bank/printer/login/G8 lulus. R-01..R-38/C-1..C-5 pada tabel di atas tetap berlaku untuk perubahan ini. UAT login dan printer fisik masih diperlukan.

### Bukti rilis awal yang dapat diakses reviewer

- [Manifest rilis bcf6947, termasuk fingerprint14 tabel sebelum/sesudah](evidence/v31-release-20261106.json).
- [Fingerprint17 fungsi dan ACL saat rilis](evidence/v31-functions-20261106.json).
- [Query baca pembanding](evidence/v31-fingerprint-query.sql).

Salinan ini berasal dari capture rilis asli pada6November03:32:50UTC, bukan rekonstruksi data sebelum migrasi. Tidak memuat baris pelanggan, nomor telepon, token, atau rahasia. Timestamp tersebut waktu pencatatan receipt; timestamp terpisah untuk tiap query capture tidak dicatat. Fingerprint MD5 membuktikan hasil perbandingan yang direkam, bukan backup, tanda tangan kriptografis atau attestasi auditor independen. Perubahan sah setelah waktu capture dapat membuat hash live berbeda. Live read saat tindak lanjut masih cocok dengan fingerprint sesudah pada manifest. CI/deployment awal dapat diperiksa dari ID/URL pada manifest.

## Validasi sumber/tujuan, 7 November 2026

Review `c2f98ee` menemukan bahwa `Tujuan: | Catatan: pembelian` dan bentuk Sumber yang sama diterima karena panjang catatan ikut dihitung. Baseline telah direproduksi melalui regresi Node dan SQL rollback QA. Migrasi function-only `20261107010000_pos_cash_counterparty_validation.sql` kini menghitung bagian setelah prefix sampai sebelum pemisah pertama `|`, lalu mewajibkan minimal3 karakter sesudah trim. Parser formulir melarang `|` dalam field sumber/tujuan karena karakter tersebut adalah pemisah catatan.

Contoh kosong, whitespace, atau dua karakter sebelum catatan ditolak; `Tujuan: Bank uji | Catatan: pembelian` serta bentuk Sumber valid tetap diterima. Retry identik transaksi historis tetap memakai metadata/alasan/digest asli, tanpa penulisan ulang jurnal. Perbandingan body fungsi terhadap migrasi sebelumnya memastikan hanya predicate validasi yang berubah; otorisasi Owner, lock, core, dan grant tidak berubah.

Lokal: **371 Node**, **168 browser**, build+TypeScript PASS. Tiga suite SQL QA PASS: cash-review, cash V3.1, V3. Kasus baru diuji RED sebelum fix dan GREEN sesudah fix untuk IN/OUT; suite tetap menguji konflik, retry, izin kasir, histori dan lookup lama. CI exact SHA wajib sebelum pemasangan Production/deploy; receipt final mencatat hasil sesungguhnya. Antislop tetap berlaku selama pengerjaan: tidak ada perubahan layout/aset/copy UI, validasi/form error existing dipertahankan. R-26/R-35 PASS untuk lingkup otomatis; UAT fisik, restore, rekonsiliasi dan G8 NO_GO tidak berubah.
