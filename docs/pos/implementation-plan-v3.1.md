# POS V3.1: nota pelanggan dan audit transaksi

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
