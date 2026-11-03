# POS Mas Jawa Laundry Implementation Plan V2 — revisi eksekusi 1 Nov 2026

> **Bukti terkini — 3 November 2026:** source `a502c0bce9638990d314db0f033a48df464b2e9f` lulus [release CI](https://github.com/warasjawa-laundry/Mas/actions/runs/41595889142) dan [database CI](https://github.com/warasjawa-laundry/Mas/actions/runs/41595889081): 284 Node, TypeScript, build, 93 browser; replay semua migrasi, SQL rollback, race dua koneksi dan restore sintetis PASS. Seluruh 1.546 fingerprint schema/RLS/hak efektif aplikasi QA identik dengan replay CI. Deployment existing Production `mas`, `dpl_9RVoM9zYWJT4dg1a8PMF2oeyDbFA`, READY pada SHA tersebut dan domain masjawalaundry.web.id. Production POS **0 tabel**, baseline legacy tetap sama; QA **22/22 RLS**, write/finance/package-mode OFF dan tidak ada transaksi/customer sintetis tersisa. **G8 NO-GO**, external evidence dan approval Production belum ada. Koreksi preflight terakhir mengubah kontrak 20 menjadi 22 tabel, dengan tes regresi red→green; tidak mengubah flag atau bukti bisnis. Paragraf checkpoint sebelumnya adalah histori, bukan status terkini. Lihat [receipt rilis](./release-20261103.md).


> **Checkpoint 3 November 2026 sebelum CI integrasi:** lima migrasi canonical baru diterapkan QA saja (190000, 193000, 210000, 213000, 214000). Seluruh fixture SQL rollback terkait lulus; 280 tes Node, TypeScript, build Next.js dan 14 tes browser fixture lulus. Recovery UUID bertahan setelah refresh, dibatasi aktor/operasi, tanpa menyimpan payload pelanggan. Pembatalan owner/kasir dan pemulihan status terhubung UI/backend. Synthetic restore dan race dua koneksi menunggu CI; belum dinyatakan PASS. Production tidak dimigrasi; kedua switch QA OFF; G8 NO-GO. Tambahan rencana layanan/paket/WhatsApp diterima 3 November: audit ulang setelah integrasi ini stabil; perubahan flow empat tahap dan satu paket per nota menggantikan permintaan tiga tahap untuk fase tambahan.

> **Status superseding 2 November 2026:** [Master audit G0–G8](./master-audit-20261102.md) adalah matriks scope, wiring nyata, acceptance, masalah, dependensi dan bukti penutupan terkini. Paragraf/status paket lama di bawah adalah histori checkpoint bila bertentangan dengan master audit atau keputusan owner terbaru. Teks pairing wajib, multi-outlet, wizard durasi terpisah, “G5 belum dibangun”, owner selalu read-only, atau PASS checkpoint lama tidak menyatakan kondisi tree final. **Master audit PROVISIONAL / final validation pending; G8 NO-GO, production POS 0 tabel, finance OFF.** Implementasi source/QA tidak mengotorisasi migrasi produksi atau cutover.

> **For agentic workers:** implementasikan per task memakai skill executing-plans; gunakan subagent-driven-development hanya bila delegasi dipilih. Dokumen ini adalah masterplan review, bukan izin migrasi atau release. Setiap paket implementasi harus menyertakan subplan kode dan tes sebelum dikerjakan.

**Goal:** mengembangkan area `/admin` yang ada menjadi kasir laundry, dengan nota, pembayaran, mutasi dan poin yang konsisten, tanpa kehilangan member, QR atau riwayat lama.

**Architecture:** Next.js tetap satu aplikasi/domain/repo. Command bisnis diproses atomik di PostgreSQL melalui RPC terotorisasi, dengan order lock, idempotency dan audit. Ledger poin lama tetap menjadi satu-satunya sumber saldo; tabel POS menautkan nota ke event lama.

**Tech Stack:** baseline dokumen V1 adalah Next.js 16.4.2, React 19.3.1, TypeScript 5.9.3, Node 24.x dan Supabase. Versi aktual dan kompatibilitas diverifikasi pada G0; tidak ada upgrade otomatis akibat rencana ini.

**Spec:** [rencana V1](./implementation-plan-v1.md), disempurnakan oleh [review V1](./review-v1.md). V2 menggantikan kontrak V1 yang ambigu. Tanggal revisi: 1 November 2026 WIB. Keputusan D01–D11 kemudian disahkan untuk implementasi; status eksekusinya ada pada [decision register](./decision-register.md).

### Koreksi login karyawan final — 2 November 2026 (menggantikan pairing perangkat)

- **Format ID kasir:** `MAS-XXXX`, empat angka persis; sistem owner menomori `MAS-0001` sampai `MAS-9999` (nomor `MAS-0000` dicadangkan). Nomor karyawan lama tidak berubah, bersifat unik dan tidak dipakai ulang.
- **Owner** tetap masuk dengan ID dan password lama untuk menambah/menonaktifkan pegawai, mengatur hak akses masing-masing, dan mencabut sesi.
- **Kasir** langsung membuka `/kasir`, mengetik **hanya ID kasir** tanpa password maupun aktivasi/pairing perangkat. Form login selalu tampil bila belum ada sesi. Tidak ada akses owner otomatis.
- Database membuat dua token sesi acak 256-bit (HttpOnly, SameSite Strict; maks. 12 jam) setelah berhasil memeriksa karyawan aktif dan izin. Setiap RPC bisnis tetap memeriksa token, izin, status kasir/outlet, dan write switch.
- ID empat angka **bukan autentikasi kuat**. Sebagai mitigasi terbatas, throttle global 10 percobaan/menit dan lock 5 menit termasuk ID tidak dikenal, maksimal lima sesi aktif/karyawan, owner bisa mencabut sesi. Throttle global rentan denial-of-service dan tidak mencegah penyalahgunaan ID yang sudah diketahui.
- **G8 tetap NO-GO**: penjualan/pembayaran/poin live tidak boleh dibuka hanya karena ID berhasil login. Security review risiko impersonasi, pengujian perangkat nyata, dan persetujuan owner terhadap kontrol akses wajib sebelum aktivasi finansial.
- Migrasi **QA saja**: `20261102093000_pos_cashier_direct_id_login.sql`; regresi `pos-cashier-direct-id-login.sql`. Kode source dapat di-merge ke `main` tanpa menjalankan migrasi ke Supabase produksi (saat ini belum ada skema POS). Legacy pairing backend hanya dipertahankan untuk kompatibilitas sesi lama; bukan langkah wajib di UI.

## Keputusan owner terbaru: alur source dan deployment (mengikat)

**Revisi operasional kasir/outlet (1 November 2026):** hanya **owner** yang login dengan ID/password; pegawai kasir tidak membuat akun login. Owner mengelola nama, izin, penghapusan/nonaktivasi, dan pencabutan sesi kasir melalui `/admin/pos/kasir`. Karyawan login langsung dengan ID MAS empat angka tanpa aktivasi perangkat; token sesi tetap terpisah dari cookie owner. **Outlet hanya satu:** Mas Jawa Laundry, Jl. Raya Kandang Jati Kulon RT.06 RW.01, Kandang Jati Kulon, Probolinggo (sesuai `lib/site.ts`). Tidak ada fitur menambah, memilih, atau menghapus outlet. Perubahan ini mengesampingkan kontrak staff individual Supabase Auth dan beberapa outlet pada versi terdahulu. Lihat [laporan G3 owner-managed cashier](./g3-single-outlet-cashiers.md).

1. **Satu repository kode utama:** `warasjawa-laundry/Mas`; setiap task memakai branch sementara dari `main`, lulus tes/review PR, lalu **langsung merge ke `main`**. Hindari branch kerja jangka panjang.
2. **Satu proyek deployment:** Vercel `mas`, domain `masjawalaundry.web.id`, dan koneksi Git Vercel ke `unyilhm1-hue/mas` **tetap**, tidak di-reconnect. **Tidak membuat Vercel Preview/staging/proyek baru.** Setelah merge verifikasi commit SHA dan domain pada deployment Production aktual; koneksi Git berbeda artinya auto-deploy dari repository kode tidak boleh diasumsikan.
3. **Deploy kode bertahap ke Production yang sama**, namun POS belum lengkap **tidak boleh diaktifkan**. Simpan `/admin/pos` dan terutama pembayaran/poin dalam keadaan tidak dapat diakses/ditulis sampai gate relevan dan persetujuan cutover. Flag database tetap wajib, bukan sekadar menyembunyikan tombol.
4. **QA tetap terpisah pada tingkat database**, memakai Supabase `cwxsbgfjynwxqalwonae` untuk migrasi, concurrency, dan tes sintetis; tidak membuat staging website. Pelanggan dan kartu produksi tidak disalin ke QA. Guard fail-closed Preview/CI tetap dipertahankan walau tidak ada Preview aktif.
5. **Referensi visual wajib:** [25 screenshot Binatu tersanitasi](./evidence-manifest.md) pada branch `reference/binatu-ui-ux`, commit `c17b043`. Alur dan tata letak kasir familier, perubahan hanya aditif untuk QR/member/poin; aset pihak ketiga tidak disalin.
6. **Keputusan D01–D11 disetujui untuk implementasi** sebagaimana [decision register](./decision-register.md). Persetujuan coding dan merge `main` **bukan** persetujuan pembayaran/poin live atau cutover.
7. **Baseline 1 Nov:** PR #17 pada `main` commit `92fbf5e` sudah memasukkan fondasi QA/kalkulator, **bukan** POS operasional; catat SHA HEAD baru tiap task. QA aktif `cwxsbgfjynwxqalwonae`; QA lama `tnadzytuamdxfypoeggy` tetap inactive.

Ketentuan terbaru di atas **menggantikan** syarat Preview/reconnect serta status "keputusan belum disahkan" yang masih tersisa sebagai catatan historis dalam dokumen V2, tanpa menghapus gate keselamatan lain.


### Perubahan owner: username otomatis MAS-XXXX dan login kasir (1 November 2026)

- Saat owner menambahkan kasir dengan nama, database mengalokasikan **username unik berurutan**: `MAS-0001`, `MAS-0002`, ... `MAS-9999`. Nomor berasal dari counter terkunci pada outlet tunggal, bukan dari jumlah kasir aktif; tidak dipakai ulang setelah penghapusan/rename. `MAS-0000` tidak digunakan.
- **Koreksi 2 November:** Kasir cukup memasukkan ID `MAS-XXXX` tanpa password atau pairing perangkat. Setelah valid, server mengeluarkan dua token sesi acak (maks. 12 jam). Throttle global 10 percobaan/menit, kunci lima menit. ID empat angka lemah untuk otorisasi keuangan; G8 tetap NO-GO.
- Setelah memasukkan username yang benar, server menerbitkan **cookie sesi kasir terpisah (maks. 12 jam)**. Seluruh modul kasir dan command finansial yang kelak dibangun harus memverifikasi **dua token** di database pada setiap akses. Logout kasir mencabut sesi, owner dapat mencabut semua sesi atau menonaktifkan kasir kapan pun.
- Owner tetap satu-satunya akun dengan ID/password. Tidak ada penambahan outlet. Halaman owner menampilkan nama+username+hak akses. QA migration `20261101172500_pos_cashier_sequential_username_login.sql` dan SQL regression `pos-cashier-sequential-username-login.sql` telah lulus di database QA **tanpa mengubah produksi**.
- **Batas:** skema transaksi lama masih menyimpan FK pelaku ke `auth.users`; kasir sekarang hanya memiliki `staff_id`. Sebelum G4/G5 diaktifkan harus disediakan jembatan audit pelaku tanpa memalsukan owner. POS financial write tetap nonaktif sampai gate dan izin migrasi produksi.

## 0. Status, lingkup dan aturan tetap

- **Status:** implementasi fondasi G0/G1 sebagian telah di-merge lewat PR #17; pekerjaan POS operasional belum diimplementasi/diaktifkan. PR per task boleh di-merge setelah tes, sedangkan activation/cutover masih memerlukan gate tersendiri.
- **Tidak membuat website, domain, atau repository baru.** Aplikasi tetap `warasjawa-laundry/Mas`; area kasir berada pada `/admin/pos` sebelum navigasi lama diganti bertahap.
- **Pertahankan identitas/data lama:** `laundry_members`, `laundry_member_cards`, `laundry_point_rules`, `laundry_amount_transactions`, `laundry_checklist_events`, `laundry_member_promotions`, nomor MJL dan URL QR lama.
- **Satu outlet tetap dan satu keanggotaan:** `laundry_members.id` tetap FK kanonis semua nota; tidak membuat nomor member atau cabang baru. Nama/HP yang sama tidak otomatis digabung.
- **Scan QR tidak pernah menghasilkan poin atau transaksi.** Kasir memilih member; pelanggan membaca catatan.
- Poin POS diterbitkan sekali pada pelunasan terkonfirmasi, dari total final nota; status pekerjaan tidak memicu poin. Definisi refund/koreksi mengikuti keputusan di bagian 10.
- Tidak ada write uji coba ke produksi. QA menggunakan data sintetis; QA lama tidak dipulihkan, dikosongkan atau dipakai tanpa pemeriksaan dan otorisasi tersendiri.
- Owner requirement lama tidak dilemahkan agar kasir dapat mengaksesnya. Semua command dan pembacaan sensitif diperiksa ulang pada server/DB.
- Fitur lama tetap tersedia sesuai hak: daftar/edit member, scan kamera/galeri, kartu cetak/reissue, promo/consent/WA, riwayat/VOID, katalog dan program tahunan. Penulisan transaksi nominal manual dibatasi saat outlet cutover, bukan dihapus historinya.
- Tidak membuat aset atau menyalin kode/aset proprietary Binatu. Identitas Mas Jawa Laundry dipertahankan; referensi UI dipakai hanya jika inventaris buktinya tersedia.

## 1. Evidence dan baseline yang wajib dibedakan

| Informasi | Status pada review ini | Tindakan G0 |
| --- | --- | --- |
| Production Supabase `hncfyfvqtlnvqyfrydzb`, Mumbai | Identitas historis dari pekerjaan sebelumnya/V1; health saat ini belum dibaca ulang | Verifikasi org, region, health dan credential scope secara read-only |
| QA lama `tnadzytuamdxfypoeggy` | Historis pernah berisi data nyata dan dipause | Pertahankan arsip; bukan tempat tes sintetis otomatis |
| QA POS baru `cwxsbgfjynwxqalwonae` | ACTIVE_HEALTHY; 17 migrasi lama direplay pada PR #17 | Khusus data/tes sintetis SQL; tanpa Vercel Preview baru |
| `main` 1 November 2026 (PR #17) | HEAD terverifikasi `92fbf5e` (saat baseline), produksi Vercel READY | Pin SHA aktual baru sebelum tiap perubahan |
| 785 member, 17 kartu aktif dan rekonsiliasi poin | Checkpoint 27 Oktober, bukan baseline 1 November | Snapshot konsisten baru; jangan mengharapkan jumlah tetap bila usaha berjalan |
| Tier poin V1: 10k/25k/50k/100k/200k | Input dokumen; bukan hasil query baru dalam review ini | Baca tiers/revision aktual per tahun; runtime dilarang hardcode contoh |
| 25 screenshot Binatu | 25 JPG **tersanitasi**, tersedia di branch `reference/binatu-ui-ux` commit `c17b043`; tidak termasuk `main` | [Manifest dan layar](./evidence-manifest.md); bandingkan UX per layar, jangan publikasikan PII Excel |
| Guard QA dan reauth admin | Dibaca dari salinan lokal `work/fix-ui-flows` | Cocokkan dengan SHA remote dan deployment sebelum menyimpulkan perilaku live |

Baseline produksi harus memuat schema, fungsi, grants, RLS, migration history, counts, snapshot ledger dan saldo per member/tahun. Ambil snapshot dalam satu transaksi read-only consistent snapshot; hasil beberapa query di waktu berbeda tidak dianggap satu baseline. Perbandingan sesudah migrasi menggunakan snapshot baru dan daftar write bisnis sah di antara kedua waktu; alternatifnya gunakan maintenance window yang disetujui. Checksum disimpan privat, bukan PII/token di PR. Backup/restorability dibuktikan terpisah; checksum bukan backup.

## 2. Batas rilis pertama dan jalur lanjutan

**Pilot yang diusulkan:** satu outlet, akun pegawai individual, katalog multiunit, pembuatan nota, DP/pelunasan bila disahkan, pencatatan tunai dan non-tunai manual terverifikasi, jurnal kas, poin otomatis, full refund terotorisasi, laporan operasional, draf WA manual, print HTML. QR/member/promo lama tetap berfungsi.

**Paket lanjutan terpisah:** import historis dengan posting, refund parsial/repricing nota lunas, re-award setelah koreksi, gateway pembayaran/webhook, WA otomatis, printer thermal khusus, operasi offline. Import preview dan ekspor tetap dibangun sebelum cutover; posting historis bukan syarat menyalakan transaksi baru bila saldo awal/piutang sudah direkonsiliasi.

Keterbatasan tersebut harus disetujui, bukan dianggap keputusan owner yang sudah diberikan. Jika refund parsial atau thermal wajib saat pilot, perluas kontrak dan UAT sebelum G2 ditutup; jangan menyalakan tombol yang belum punya semantik ledger.

## 3. Kontrak nominal, waktu dan status

### 3.1 Nominal dan katalog

- IDR disimpan `bigint`; API mengirim uang sebagai string bilangan bulat, misalnya `"93000"`. Kuantitas sebagai string desimal dengan maksimum tiga digit pecahan. Tolak exponent, NaN, tanda negatif, pemisah ribuan ambigu dan nilai di luar batas kontrak.
- Usulan batas pilot: setiap nota dan setiap pembayaran paling banyak Rp1.000.000.000 agar sesuai batas jalur poin lama; agregat laporan tetap bigint/string. Batas disahkan di G2.
- Normalisasi **satuan katalog lama** harus eksplisit: produksi memiliki `kg`, `meter`, dan `M` (karpet); kalkulator hanya `kg`, `m`, `pcs`. Adapter katalog mengubah `kg`→`kg`, `meter`/`M`→`m`, `pcs`/`satuan`→`pcs` untuk katalog masa depan; nilai tidak dikenal ditolak, tanpa migrasi data harga lama.
- kg/m: kelipatan 0,001; pcs: bilangan bulat positif. Harga Rp/unit berupa integer non-negatif. Qty item harus positif; layanan gratis dimodelkan sebagai harga nol dengan alasan/izin.
- Usulan rounding: `line_total = floor((price_idr * qty_milli + 500) / 1000)` untuk nilai non-negatif. Contoh Rp6.000 × 1,255 kg = Rp7.530; Rp3.500 × 0,001 m = Rp4. Jangan gunakan float JS untuk uang.
- Jumlahkan line totals, tambahkan biaya, terapkan satu diskon nominal atau basis points persen menurut urutan yang disahkan. Usulan diskon persen dihitung atas subtotal layanan, tidak atas ongkir; round half-up per nota. Total tidak boleh negatif, diskon melebihi basis ditolak, tidak di-clamp diam-diam.
- Katalog tetap memanfaatkan `laundry_services`. Tambahkan aturan layanan/durasi/unit secara aditif bila dibutuhkan; jangan membuat dua editor harga tanpa otoritas yang jelas. Quote menyertakan `catalog_revision`; server menghitung ulang sebelum create, perubahan harga menghasilkan konflik dan review ulang, bukan biaya baru tersembunyi.
- Snapshot nama, harga, unit, durasi, diskon, parfum/ongkir tersimpan pada nota. Setelah finalisasi tidak dapat diedit melalui katalog. Semua total server/DB authoritative.
- Jangan tampilkan jumlah kg+pcs+meter sebagai satu angka. Tampilkan ringkasan per satuan. Durasi menyimpan `due_at` UTC dan label WIB; usulan berbasis elapsed hours, tidak mengasumsikan hari kerja/libur tanpa jadwal yang disahkan.

### 3.2 State terpisah

| Axis | State dan aturan |
| --- | --- |
| Lifecycle | `DRAFT -> CONFIRMED -> CANCELLED`; nota final tidak dihapus. Order cancelled tidak menerima pembayaran baru |
| Pekerjaan | `QUEUED -> READY -> COLLECTED`; koreksi mundur hanya oleh peran berizin + alasan. Tidak mengubah lunas atau poin |
| Pembayaran | `UNPAID`, `PARTIAL`, `PAID`, `ZERO_TOTAL`; dihitung dari posting terkonfirmasi dan total tagihan, bukan input klien |
| Refund | `NONE`, `PENDING`, `FULLY_REFUNDED`; rencana refund bukan uang keluar. Full refund selesai menutup finansial nota dan meniadakan award aktif |
| Status command | `COMMITTED` dapat diputar ulang; timeout klien berarti `UNKNOWN`, bukan otomatis gagal |

`paid_total = sum(confirmed receipts)`; `refund_total = sum(confirmed refund entries)`; `net_received = paid_total - refund_total`. Pending transfer tidak termasuk receipt. Piutang hanya untuk order aktif tanpa refund terminal: `max(total_due - net_received, 0)`. Order fully refunded/cancelled tidak muncul sebagai piutang tertagih. Laporan refund dan pembatalan terpisah dari pesanan aktif.

Pembayaran tidak boleh melampaui sisa tagihan. Untuk uang tunai, pisahkan uang diterima kasir dan kembalian dari nominal yang diterapkan ke nota; hanya nominal bersih diterapkan menjadi ledger receipt. Non-tunai dicatat sebagai penerimaan metode non-tunai setelah pegawai berizin mengonfirmasi bukti; bukan klaim settlement bank otomatis.

Nota nol memiliki status ZERO_TOTAL, tidak membuat receipt Rp0, tidak memanggil RPC lama yang mensyaratkan Rp1, dan tidak memberi poin/transaksi kunjungan baru. Kebijakan lain harus disahkan sebelum diubah.

### 3.3 Tahun dan aturan poin

- Usulan: waktu pelunasan diambil DB setelah memperoleh order lock dan sebelum posting; timestamp disimpan UTC, tahun dihitung dengan `Asia/Jakarta`. Hindari `now()` transaction-start yang dapat melewati batas tahun saat menunggu lock; ambil satu timestamp kejadian dan gunakan konsisten.
- Client tidak mengirim `paid_at` authoritative untuk command live. Backdate hanya proses historis terpisah yang disetujui.
- Simpan `program_year`, `rule_revision`, tier snapshot yang diperlukan untuk rekonstruksi, `basis_amount`, `awarded_points`, dan event asal. Rule dibaca dengan lock yang konsisten terhadap edit revisi; urutan lock sama pada semua command.
- Tahun belum memiliki aturan: usulan menolak seluruh posting pelunasan member dan memberi pesan `POINT_RULE_MISSING`, bukan menyimpan bayar lalu diam-diam kehilangan poin. Ini risiko operasional yang perlu persetujuan; aturan tahun berikut harus siap sebelum pergantian tahun. Alternatif deferred-award memerlukan desain rekonsiliasi terpisah.
- Member tidak aktif: jangan diam-diam menghilangkan hak poin setelah uang diterima. Usulan blok pelunasan sampai owner memulihkan identitas atau mengonfirmasi perlakuan guest dengan alasan. Guest yang memang dibuat tanpa member tetap boleh membayar tanpa poin.

## 4. Atomic command dan integrasi poin

### 4.1 Kontrak request/result

Command minimal:

| RPC | Input bisnis | Hasil |
| --- | --- | --- |
| `pos_create_order` | request UUID, outlet, customer ref, item qty, adjustment IDs/values, catalog revision | order ID, invoice no, version, totals |
| `pos_post_payment_and_award` | request UUID, order ID, expected version, applied amount string, method, evidence reference opsional | payment ID, applied amount, remaining, version, payment state, award summary |
| `pos_set_work_status` | request UUID, order ID, expected version, target, reason | work status, version, event ID |
| `pos_cancel_order` | request UUID, order ID, expected version, reason | cancelled order atau `REFUND_REQUIRED` |
| `pos_refund_order_full` | request UUID, order ID, expected version, alokasi refund per receipt, reason | refund IDs, terminal state, VOID event ID jika ada |
| `pos_command_result` | request UUID | hasil committed yang boleh dilihat actor/outlet, atau `NOT_FOUND` |
| `pos_resolve_member_card` | raw token hanya pada request terlindungi | ID member, nomor MJL, nama/status minimal; tidak mutasi |

Semua memakai identity dari sesi, bukan actor/role dari client. `outlet_id` input diverifikasi. Envelope hasil: `{request_id, replayed, order_id, version, result}`. Error stabil: `FORBIDDEN`, `VALIDATION`, `VERSION_CONFLICT`, `CATALOG_CHANGED`, `IDEMPOTENCY_CONFLICT`, `POINT_RULE_MISSING`, `MEMBER_INACTIVE`, `REFUND_REQUIRED`, `WRITES_DISABLED`. Tidak membocorkan SQL, HP atau token pada error/log.

### 4.2 Urutan transaksi

1. Validasi sesi aktif, staff/outlet capability dan DB write switch. Retry hasil committed boleh dibaca saat switch off bila masih berhak.
2. Reservasi `request_id` dalam registry command dengan actor, operation, target/outlet, payload kanonis/hash. Request ID sama + payload berbeda adalah konflik. Unique key menangani dua request bersamaan; request yang kalah menunggu lalu membaca hasil committed yang sama. Baris reservasi dan hasil berada dalam transaksi bisnis yang sama.
3. Bila sudah committed dan payload/otorisasi cocok, kembalikan hasil asli **sebelum** memeriksa `expected_version` terhadap versi order sekarang. Versi lama pada retry tidak membatalkan replay yang sah.
4. Lock order `FOR UPDATE`; validasi versi, lifecycle, sisa bayar dan metode. Semua jalur perubahan finansial/koreksi menggunakan order lock yang sama. Lock dependency lain dengan urutan terdokumentasi; tangani deadlock/serialization failure dengan retry request ID yang sama.
5. Hitung timestamp dan totals authoritative. Untuk pelunasan member, validasi status member dan snapshot aturan tahun dengan lock yang kompatibel. Buat receipt, ledger dan audit.
6. Bila pertama kali lunas: tulis satu ADD, satu amount transaction, satu link award dalam transaksi DB yang sama. Gunakan helper POS terotorisasi yang mempertahankan semantik ledger lama; jangan menghapus owner check lama atau mengirim poin dari client.
7. Simpan result command dan version baru, lalu commit. Error sebelum commit merollback seluruh efek; jangan catch error lalu mengembalikan sukses sebagian.
8. Bila respons hilang sesudah commit, UI mempertahankan request ID, memanggil result lookup atau retry payload identik. Jangan membuat UUID baru untuk “coba lagi”. `NOT_FOUND` dapat berarti transaksi pertama belum commit; retry yang sama tetap aman.

Tidak melakukan HTTP bank/WA/printer di dalam transaksi DB. Yang dijamin tepat satu adalah posting DB per command/award, bukan klaim exactly-once jaringan. Rollback DB tidak mengembalikan uang fisik atau transfer yang sudah masuk. UI memeriksa kesiapan nota/member/aturan sebelum kasir menerima uang; bila uang sudah diterima tetapi posting belum diketahui, tunjukkan rekonsiliasi dan bukti penerimaan, jangan menyuruh pelanggan membayar lagi. Jika gateway kelak dipakai, idempotency provider dan inbox webhook menjadi paket desain tambahan.

Review lock graph harus mencakup helper legacy yang masih hidup, bukan hanya RPC POS. Hindari urutan member/rule/order yang berlawanan; uji interleaving edit rule, VOID legacy, payment dan deactivation. Penanganan deadlock tidak boleh membuat request ID baru atau menulis audit sukses sebelum commit.

### 4.3 Award, refund dan jalur lama

- Link berisi order, award cycle, member, event ID, rule revision dan basis amount. Unique `(order_id, cycle)` serta satu active award per order; indeks pada child saja tidak dapat menjamin seluruh status ledger, sehingga semua transisi melalui RPC yang sama.
- Full refund: alokasikan terhadap receipt/metode asal; jumlah refund kumulatif tidak melebihi receipt. Ledger refund dan VOID award asal atomik, memakai tahun asal meskipun refund dilakukan tahun berikutnya. Nota ditutup; tidak menerima pembayaran/re-award otomatis.
- Cancellation order yang sudah memiliki DP mengembalikan `REFUND_REQUIRED`; lakukan full refund seluruh uang yang sudah diterima sebelum terminal cancellation. Tidak menghasilkan VOID bila belum ada award.
- Salah member setelah pembayaran dimulai tidak boleh diperbaiki lewat edit nama/member biasa. Koreksi khusus owner harus mengunci order dan menautkan VOID/replacement secara eksplisit; tidak ada backfill otomatis untuk guest atau import.
- Legacy amount rows tetap menjadi riwayat, bukan dianggap otomatis receipt POS. Link nota memakai event existing hanya pada rekonsiliasi owner yang telah diperiksa; jangan menyalin nominalnya menjadi pendapatan baru.
- Sebelum pilot, buat registry rekonsiliasi event historis ke outlet/sumber dan cutoff per outlet. Guard DB menolak award manual **baru** untuk jalur POS-enabled yang tercakup, termasuk pemanggilan langsung RPC lama. Karena RPC lama tidak membawa outlet, global-member mapping yang ambigu harus menolak dan meminta rekonsiliasi, bukan memilih outlet dari client. Bila mapping belum aman, rilis pilot ditahan atau penulisan manual lama dihentikan global setelah persetujuan operasional.
- Tetap izinkan pemeriksaan/VOID historis sesuai hak dan audit; jangan menonaktifkan seluruh fungsi koreksi hanya karena input manual ditutup. UI dan DB sama-sama memeriksa cutoff.

## 5. Model data dan invariants

**G2/G3 update 1 Nov 2026:** [laporan fondasi G2](./g2-verification.md) dan [paket satu outlet/kasir G3](./g3-single-outlet-cashiers.md). 17 tabel awal + 2 tabel perangkat/audit baru di QA, semuanya RLS default deny. Outlet MJL tunggal seeded dengan `write_enabled=false`; staff tidak lagi FK ke akun Auth. **Belum ada migrasi POS produksi dan pembayaran tetap nonaktif.** Migrasi yang nanti diterapkan ke produksi harus melalui review dan backup/restore gate tersendiri.


Nama berikut adalah kontrak V2. Struktur awal sudah direalisasikan di QA; pengendalian lintas tabel melalui RPC pembayaran, refund, point award dan cutover masih belum diimplementasikan.

| Tabel POS | Kunci/isi utama | Invariant |
| --- | --- | --- |
| `laundry_pos_outlets` | code `MJL`, nama/alamat tetap dari `lib/site.ts`, singleton_key, write_enabled | **Tepat satu outlet tetap**; tidak ada RPC tambah cabang; transaksi off sampai gate finansial |
| `laundry_pos_staff` | staff_id UUID, username `MAS-0001` dst, display_name, active | Username counter DB immutable dan unik, bukan akun Auth/password; soft-delete tidak recycle |
| `laundry_pos_staff_outlets` | staff_id, satu outlet MJL, role cashier, izin JSON boolean | whitelist eksplisit, owner-only mutate; bukan fitur multioutlet atau manajer login |
| `laundry_pos_cashier_devices` | staff_id, token_digest, expiry, revoked_at, login_origin | Sesi login langsung `DIRECT_ID` tidak mengaku diterbitkan owner; pasangan legacy tetap didukung, token mentah tidak disimpan |
| `laundry_pos_cashier_logins` | device_id, staff_id, login token SHA256, expiry, revoked_at | Token kedua, session max 12 jam, per-request check bersama token perangkat |
| `laundry_pos_cashier_audit` | staff, owner, create/update/disable/pair/revoke, changes | jejak administrasi tidak hilang saat kasir dinonaktifkan |
| `laundry_pos_guest_customers` | nama, kontak opsional, linked_member | tanpa nomor MJL baru; link tidak award retroaktif |
| `laundry_pos_orders` | outlet, sequence, invoice_no, customer ref/snapshot, three states, totals, version | unik outlet+sequence/invoice; customer member atau guest konsisten; immutable sesudah final kecuali command koreksi |
| `laundry_pos_order_items` | service ref, price/unit/duration snapshot, qty | qty positif, pcs integer, line rounding deterministik |
| `laundry_pos_order_adjustments` | type, basis, value, approval, reason | diskon/biaya terbatas dan diaudit |
| `laundry_pos_commands` | request UUID, actor, operation, payload hash, result | request unik; result committed hanya setelah semua efek berhasil |
| `laundry_pos_payments` | order, request, receipt/refund type, original receipt, amount, method, timestamp | jurnal immutable; refund reference wajib; direct UPDATE/DELETE ditolak |
| `laundry_pos_cash_ledger` | receipt/refund atau non-sale source, shift, outlet, method, direction, amount | satu posting per sumber dan alokasi; cash/noncash tidak dicampur |
| `laundry_pos_cash_shifts` | outlet, register code, opening, actor, closed_at, counted, expected, discrepancy | satu shift terbuka per register; close idempoten |
| `laundry_pos_order_events` | actor, order, event, sanitized payload, reason, timestamp | append-only; tidak menyimpan token/password/PII berlebih |
| `laundry_pos_point_links` | order/cycle, ADD/VOID refs, member/year/revision/basis | event refs unik; satu award aktif; FK ke ledger lama |
| `laundry_pos_import_batches/rows` | source, outlet, file hash, external invoice, row hash, validation/match | source+outlet+external invoice unik pada record identitas historis; revisi source append-only |
| `laundry_pos_legacy_reconciliation` | legacy event, outlet/sumber, reviewed_by, cutoff relation | tidak menggandakan event/receipt; keputusan mapping diaudit |

FK historis ke member/service memakai restriction atau soft deactivate, bukan cascade delete jurnal. Index wajib pada FK dan pola outlet+created_at, outlet+work state, order+payment time, staff+outlet; verifikasi query plan dengan data sintetis yang realistis.

Nomor nota: counter/sequence DB pada **satu outlet `MJL`**, contoh `MJL-000001`; tidak memakai `max()+1`, tidak mengulang nomor batal, boleh ada gap. Tahun/tanggal tampilan WIB bukan sumber uniqueness. Tidak ada prefix cabang lain.

## 6. Hak akses, sesi dan isolasi (revisi owner-only login)

| Capability | Kasir dengan ID empat angka tanpa password/pairing (sesi langsung) | Owner login |
| --- | --- | --- |
| Lihat/buat nota, ubah status, cari member / QR | Hanya jika izin `order_view`, `order_create`, `order_work`, `member_lookup` diberikan | Ya |
| Terima pembayaran dan cetak nota | Hanya jika `payment_collect`, `receipt_print` diberikan **dan** G5/G8 aktif | Ya, setelah gate |
| Lihat/catat kas, laporan | `cash_view`, `cash_entry`, `reports_view` berdasarkan izin | Ya |
| Refund penuh | `refund_full` hanya bila owner mengizinkan, wajib reason dan mekanisme G5 | Ya |
| Ubah aturan poin, reissue kartu, edit global member, promo | Tidak dapat diberikan melalui izin kasir | Owner saja |
| Tambah/edit/hapus kasir, aktifkan/cabut perangkat | Tidak dapat diberikan | Owner saja |
| Tambah outlet atau ganti cabang | **Tidak ada fitur** | **Tidak ada fitur** |

**Login 2 November 2026:** Owner memakai ID/password lama. Karyawan masuk langsung memakai ID `MAS-XXXX` melalui `/kasir`, tanpa pairing perangkat. Server/DB mengeluarkan dua token 256-bit selama maksimal 12 jam setelah pengecekan ID aktif, dengan rate limit global. Perubahan ini menggantikan alur owner-pairing yang tercatat pada paragraf historis sebelumnya. ID empat digit lemah: izin finansial tidak boleh diaktifkan tanpa penilaian risiko dan persetujuan G8.

Kebijakan izin dicek dari database pada **setiap tindakan yang nanti dibangun**, bukan hanya disabled tombol: whitelist boolean `order_view`, `order_create`, `order_work`, `member_lookup`, `payment_collect`, `receipt_print`, `whatsapp_draft`, `cash_view`, `cash_entry`, `reports_view`, `refund_full`. Server tidak menganggap token valid sebagai izin finansial. Fungsi finansial harus memeriksa izin eksplisit dan `write_enabled=true` di DB pada setiap command; transaksi/poin saat ini tetap OFF.

**Bridge actor wajib sebelum G5:** event lama memiliki `actor_id` FK `auth.users`, sedangkan profil kasir tidak menjadi `auth.users`. RPC nota/pembayaran/VOID kelak harus mengaitkan pencatat ke `staff_id` nyata secara terpisah dari owner Auth, tanpa mengisi actor sebagai owner palsu atau menjalankan owner-only RPC atas nama kasir. Perlu migrasi additive, fallback historis dan concurrency audit yang diuji lebih dulu; **G5 BLOCKED** sampai aman.

Membership tetap satu `laundry_members`; kasir hanya boleh melihat DTO minimal setelah izin `member_lookup` dan pengujian akses; pelanggan tidak otomatis mendapat poin saat QR discan.

Setiap table exposed memiliki RLS/grants sesuai kebutuhan; default deny untuk anon dan direct financial writes. Public wrapper minimal SECURITY INVOKER bila memungkinkan; helper elevated di private schema dengan search_path kosong, schema-qualified names, auth/capability check eksplisit. Uji juga owner fungsi, views, grants EXECUTE bawaan dan service-role bypass. Jangan mengirim key server ke client.

Guard sesi saat ini memaksa reauth pada document entry tertentu. Tetapkan kebijakan sebelum shell POS: mempertahankan kebijakan lama dengan draft recoverable, atau mengubah lewat review auth tersendiri. Refresh, dua tab, return WA dan timeout harus mempertahankan payload/request ID secara aman atau memungkinkan lookup server sesudah login. Draft finansial final berada di server; hindari raw QR, credential dan PII di localStorage.

**Tidak ada deployment Vercel Preview/staging menurut keputusan owner.** Guard existing tetap fail-closed terhadap Preview, CI, URL/key salah dan prod DB pada runner. QA SQL/RLS ditest pada Supabase QA independen, dan regression owner/member pada kode lokal/CI serta UAT terkontrol. G1 Preview lama ditandai **N/A oleh keputusan owner, bukan PASS**. Tes autentikasi/perangkat yang tadinya direncanakan di Preview tetap pending; jangan menyubstitusinya dengan write finansial produksi. Periksa SHA deployed pada Production setelah merge karena Git Vercel tetap terhubung ke repository berbeda. Jangan mengubah koneksi maupun env global.

## 7. UX, rute dan kompatibilitas

| Rute | Deliverable |
| --- | --- |
| `/admin/login` | **Owner saja** memakai login lama; tidak ada username/password kasir |
| `/admin/pos` | Ringkasan outlet/kasir, Tambah Pesanan, Cari Pesanan, Member, Kas |
| `/admin/pos/orders` | Antrian/Siap Ambil/Belum Bayar; search nota/nama; pagination server |
| `/admin/pos/orders/new` | Pelanggan/QR -> durasi -> kategori/layanan/qty -> parfum/antar/diskon/catatan -> review -> nota |
| `/admin/pos/orders/[id]` | Detail nota, kerja dan bayar terpisah, pembayaran terkonfirmasi, draf WA, print, audit |
| `/admin/pos/cash` | Shift, saldo awal, kas masuk/keluar non-sale, expected/count/discrepancy, close |
| `/admin/pos/reports` | Pesanan, penerimaan/refund/piutang, poin; filters dan ekspor |
| `/admin/pos/import` | Owner preview, mapping, quarantine, rekonsiliasi; posting terpisah |
| `/admin/pos/kasir` | Owner menambah/mengubah/menghapus kasir, pilih izin, aktifkan/cabut perangkat; **bukan** user Auth |
| `/kasir` | Form ID MAS-XXXX tanpa password/pairing langsung, hak akses DB per staff; dua cookie sesi acak, transaksi produksi masih OFF |
| Multi-outlet / tambah outlet | **Ditiadakan**; satu alamat Mas Jawa Laundry dari `lib/site.ts` |
| Route member/scan/rules lama | Tetap kompatibel, owner requirement tidak diperluas; link lama diuji |
| `/membership`, `/k/[token]` | Tetap publik/read-only; token, consent, noindex/no-store/no-referrer dipertahankan |

**Pemetaan layar 25 screenshot:** 01–02 daftar/menu kasir; 03–04 pilih pelanggan/durasi; 05–11 katalog layanan, +/- qty dan sticky total; 12–14 parfum/antar/diskon; 15–17 rincian/status/siap ambil; 18–20 draf WhatsApp/pembayaran; 21–22 mutasi kas; 23–25 login owner, status perangkat kasir tanpa password, manajemen kasir milik owner (adaptasi dari referensi Binatu). Lihat [manifest](./evidence-manifest.md) untuk link gambar satu per satu. Lakukan perbandingan side-by-side viewport Android, navigasi dan posisi aksi utama, uji alur pegawai, dan catat pengecualian yang disetujui owner.

Satu aksi utama per tahap; bottom sheet durasi punya keyboard/focus trap/Escape. Sticky total menunjukkan qty per unit, total dan Lanjut tanpa menutupi input/keyboard. Promo tidak otomatis menjadi diskon nota: penggunaan promo/discount benefit perlu linkage dan izin eksplisit; jangan menandai promo dipakai saat sekadar melihat QR.

State wajib: loading, empty, failed fetch, offline, pending, unknown payment result, retry/reconcile, success, stale catalog/version, duplicate customer choices, revoked card, unauthorized outlet. Form error mempertahankan isian dan request ID; sukses tampil hanya setelah hasil DB.

Portal awal mempertahankan DTO publik yang ada; tidak menambah HP/alamat/catatan internal/daftar nota lintas outlet. Jika status nota ditambahkan, gunakan DTO allowlist dan review privasi khusus. Tombol bantuan WA dari kartu dan preview pelanggan dari kartu cetak adalah peningkatan terpisah yang bisa disertakan dengan approval desain.

Viewport QA: 320/360/390/768/1024/1440, zoom 200%, keyboard/tab/Enter/Escape, focus/contrast AA dan touch target minimal 44px. Android Chrome fisik tetap UAT terpisah dari emulasi desktop. Print HTML bukan jaminan thermal; ukuran 58/80 mm dan perangkat perlu profil serta hasil uji sendiri.

## 8. Kas, laporan, impor dan WA

**Kas:** opening balance bukan penjualan. Saldo harapan cash = saldo awal + receipts cash + cash-in non-sale - refunds cash - cash-out non-sale. Usulan pilot mewajibkan register/shift terbuka untuk setiap posting kasir, termasuk non-tunai untuk atribusi petugas; saldo cash tetap hanya menghitung metode cash. Payment dan close mengunci shift dengan urutan lock yang sama, sehingga posting tidak bisa masuk diam-diam ke shift yang sudah ditutup. Shift ditutup dengan counted cash, selisih dan alasan; close memakai lock+request ID, tidak memindahkan receipt ke hari lain. Timestamp payment/recording/shift disimpan terpisah. Koreksi shift tertutup append-only oleh owner; tidak edit jurnal lama. Pengeluaran memerlukan kategori, alasan dan permission.

**Laporan:** pisahkan nilai order per created_at, penerimaan/refund per kejadian posting, piutang as-of, kas per metode/shift dan poin per program_year. Ini laporan operasional; jangan menyebut semuanya laba/revenue akuntansi. Rentang WIB memakai `[start, end)` dengan konversi UTC, bukan menganggap semua hari 23:59:59. Ekspor memakai snapshot/as_of konsisten, schema_version, filter/outlet, count, subtotal, exported_at dan timezone. Batasi akses dan cegah formula injection pada cell teks; pertahankan nomor MJL/nota sebagai teks.

**Impor:** validasi XLSX dan batas parser (ukuran terkompresi/hasil ekstrak, sheet, row, cell, timeout), file hash, header yang dipetakan dari contoh asli, formula/external links/macro tidak dieksekusi. Area batal dan masuk dipisah, footer bukan row bisnis. Nominal dan footer yang tidak cocok dikarantina. Exact duplicate aman; status source berbeda adalah revision/conflict, bukan overwrite otomatis.

Import historis default ke arsip non-operasional dengan `source_system`, external invoice/outlet dan status audit. Tanpa tanggal bayar valid, paid_at tetap null dan record tidak masuk laporan penerimaan live. Tidak memberi poin atau membuat receipt/ledger live otomatis. Piutang terbuka di-cutover hanya lewat batch opening receivable disetujui dengan nominal/outlet/date_cutoff dan pencegahan pencatatan dua kali. Rekonsiliasi terhadap event manual lama wajib sebelum linking; nama sama tidak cukup sebagai identity match. Posting historis mempunyai approval dan PR/gate sendiri.

**WA:** V1 hanya menyusun draf setelah user memilih kontak/consent yang sesuai; tidak mengirim otomatis dan tidak menganggap membuka WA sebagai delivery sukses. Draf mencantumkan nota/nominal/status yang benar tanpa membocorkan raw QR. Paket otomatis kelak memakai outbox setelah commit dan deduplication, bukan HTTP di transaksi pembayaran.

## 9. Paket implementasi dan acceptance

Setiap task: buat tes perilaku yang gagal -> jalankan dan simpan bukti gagal -> implementasi minimal -> jalankan tes lulus -> review diff -> commit/PR beserta bukti. Tidak membuat seluruh skema/pembayaran dalam satu PR besar. Subplan tiap paket harus menentukan SQL signature/error, fixture dan perintah tes yang benar setelah G0 memverifikasi toolchain.

| Task | Files/output target | Urutan dan gate penerimaan |
| --- | --- | --- |
| G0 Baseline | `docs/pos/baseline.md`, `docs/pos/evidence-manifest.md`, `docs/pos/decision-register.md` | [ ] Freeze remote SHA/tree; [ ] verifikasi local vs remote; [ ] snapshot read-only konsisten; [ ] daftar seluruh routes/RPC; [ ] inventaris screenshot/Excel; [ ] sahkan keputusan G2. Tidak write produksi |
| G1 Isolasi | `lib/supabase/qa-preview-isolation.ts`, `tests/pos-environment-isolation.test.mjs`, `docs/pos/environments.md` | [x] guard dan QA DB baru PR #17; [ ] restore rehearsal, credential-negative, RLS/concurrency dan UAT yang dibutuhkan. **Tidak membuat Preview** (N/A keputusan owner, bukan bukti pengujian lengkap). Tidak write produksi |
| G2 Kontrak/DB | `supabase/migrations/20261101142000_pos_g2_foundation_roles_orders_financial_schema.sql`, `supabase/tests/pos-g2-schema-contract.sql`, `docs/pos/g2-verification.md` | [x] 17 tabel POS di QA, default-deny RLS dan grants, index/constraint, 5 immutable journal triggers, outlet read RPC, actor FK dilebarkan ke `auth.users`, SQL rollback test lulus; [ ] authenticated owner/cashier UAT, release migrasi produksi, transaction/point RPC, concurrent writes/restore rehearsal. **Hanya QA; uang/poin produksi belum aktif.** |
| G3 Owner & kasir | migrasi G3 + `20261102093000_pos_cashier_direct_id_login.sql`, UI owner/kasir, `tests/pos-cashier-username.test.mjs`, SQL rollback | [x] satu outlet, owner CRUD izin, ID unik empat angka MAS-XXXX, form langsung tanpa pairing/password, dua token sesi acak, throttle global, revoke, QA SQL+Node; [ ] uji login owner/karyawan perangkat nyata, audit risiko brute-force/DoS, persetujuan migrasi produksi. **G8 NO-GO; financial write OFF** |
| G4 Order | `20261101190000_pos_g4_order_creation.sql`, `/kasir/pesanan/**`, `lib/pos/g4-*`, `tests/pos-g4-*.test.mjs`, `supabase/tests/pos-g4-orders-rollback.sql` | [x] QA-only DB create nota member-number/guest, snapshot harga/qty/revisi, stale catalog, idempotent UUID, aktor kasir asli, invoice `MJL-000001` dst, status QUEUED→READY→COLLECTED, daftar/detail, HTML print, UI 3 langkah dan SQL rollback regression; [ ] QR scanner kasir, ETA/durasi, ongkir/diskon preset, 2-connection race, UAT fisik, migrasi produksi. **Flag write OFF; pembayaran/poin belum dibangun.** |
| G5 Payment/points | `supabase/migrations/20261101233000_pos_g5_payment_points_refund.sql`, `supabase/tests/pos-g5-payment-rollback.sql`, `app/kasir/pesanan/payment-actions.ts`, `docs/pos/g5-payment-verification.md` | [x] QA: DP/full pay, shift open, immutable receipt/cash, member ADD+amount+point link once on full payment, full refund/VOID, legacy ADD cutoff, cashier roles, replay, guest/zero total; SQL/Node pass. [ ] Race dua koneksi, UAT fisik, backups, migrasi/cutover produksi. Flag OFF; produksi tidak berubah. |
| G6 Kas/report/export | `supabase/migrations/20261102010000_pos_g6_cash_reports.sql`, `supabase/tests/pos-g6-g6b-rollback.sql`, `/kasir/kas`, `/kasir/laporan` + CSV, WhatsApp draft | [x] QA: permission-scoped cash IN/OUT non-sale, shift MAIN close/reopen + counted cash/discrepancy, exact UUID replay, report WIB [start,end), method separation, receivable as-of, point summary, CSV injection guard, manual WA copy only, SQL rollback test. [ ] G6 full GO: real two-connection race, physical shift cash count, QA Auth/Android UAT, actual reconciliation and production migration approval. Write flag OFF. |
| G6b Import preview | `supabase/migrations/20261102011000_pos_g6b_import_review.sql`, `/admin/pos/import`, `lib/pos/g6-import.ts`, `docs/pos/import-reconciliation.md` | [x] QA: Binatu 23-column XLSX/CSV schema verified; limit 1.5MB/200 rows, formula/external ZIP ban, hash idempotency, invoice conflicts, PAID-only per-row confirmation with member name/phone/address, owner-only review; no receipt/award posting, SQL rollback + 6 Node parser tests. [ ] Actual owner review and large-file/adversarial UAT, cutover opening receivable decision, production migration approval. |
| G7 UAT | G7 QR, `20261102074500_pos_g7_member_name_search.sql`, `/kasir/pesanan/baru`, `tests/pos-g7-catalog-ux.test.mjs`, `docs/pos/{uat.md,ui-parity-audit.md}` | [x] QA read-only QR dan pencarian prefix member (min 3, max 8, nama+nomor saja), pilihan durasi katalog bottom-sheet accessible, katalog terfilter harga asli, pilihan parfum, tab Antrian/Ready/Unpaid berfungsi, 2-connection PostgreSQL race CI PR #25 PASS. [ ] Fisik Android/QR & pixel 25 screenshot, bottom-nav final, ongkir/diskon tarif dan izin owner, ETA, opening balance & cash count UAT, real QA Auth, backup/restore, owner sign-off. **G7 partial, tidak boleh klaim selesai.** |
| G8 Pilot/release | `docs/pos/{cutover.md,rollback.md,monitoring.md,g8-readiness.json}`, `scripts/pos-g8-preflight.mjs` | [x] preflight bukti dengan default NO-GO, stop/rollback/reconciliation runbook, baseline read-only prod 785 member/18 kartu/21 event/19 amount dan 0 tabel POS. [ ] backup+restore rehearsal, full schema production migration approval, authenticated owner/cashier/hardware UAT, 25 screens approval, live reconciliation, explicit cutover GO, pilot+shift monitoring. **Tidak menjalankan migrasi atau menyalakan transaksi produksi; G8 BLOCKED.** |

Commands awal mengikuti repo: `npm test`, `npm run typecheck`, `npm run build`, `npm run test:ui`. SQL/RLS dijalankan di DB sintetis melalui runner yang diverifikasi G1. Tes concurrency harus memakai minimal dua koneksi dan commit nyata pada QA ephemeral; tidak bisa dibuktikan oleh satu transaksi rollback saja.

### Acceptance examples wajib

1. Order Rp93.000 member aktif, DP Rp30.000 -> nol award; Rp63.000 sisanya -> satu award sesuai revision DB saat lunas. Angka poin contoh hanya dihitung dari fixture yang mendefinisikan tier 50k->5.
2. Request pelunasan sama diulang setelah order version naik -> replay payment/event lama; payload amount/member/order/method berbeda dengan UUID sama -> konflik tanpa write.
3. Dua kasir memakai UUID berbeda untuk sisa penuh yang sama -> hanya satu diterima; yang lain version/sisa conflict, tidak receipt/poin kedua. Dua DP berbeda yang totalnya sah diuji dengan refresh version eksplisit.
4. Timeout sebelum commit dan sesudah commit -> UI menampilkan reconcile; retry UUID sama menghasilkan maksimal satu posting. Error injeksi sesudah setiap tahap receipt/ledger/ADD/link -> tidak ada efek parsial.
5. Edit rule bersamaan dengan pembayaran -> hasil seluruhnya satu revision; 31 Des/1 Jan WIB sesudah menunggu lock -> timestamp kejadian konsisten; tahun tanpa rule -> seluruh command ditolak sesuai kebijakan yang disahkan.
6. Full refund di tahun berikut -> refund per metode asal, VOID pada award tahun asal, nol active award dan tidak membuka piutang baru; replay refund tidak menggandakan cash-out.
7. Cashier mencoba direct table insert, owner RPC, order outlet lain, mengubah role/outlet, mengakses kontak global, dan token setelah akun dinonaktifkan -> ditolak tanpa mutasi.
8. QR lama/reissue/revoked, member duplicate name, guest, disabled member, promo tanpa consent, public year/history -> regression; scan/reload saldo tidak menambah row ledger.
9. Qty 0/negatif/fraction pcs/3+ pecahan, rounding half, discount overbasis, stale catalog, nol total, cash change dan pending bank transfer -> hasil sesuai kontrak.
10. Dua close shift bersamaan, opening cash, expenses, refund ke metode berbeda yang ditolak, hari WIB lintas UTC, imported paid_at null, file duplicate/formula/bomb/row limit -> ledger dan reports tetap reconcile.

## 10. Keputusan owner sebelum implementasi terkait

**Owner telah menyetujui D01–D11 untuk implementasi pada 1 November 2026**, tercatat di decision register. Penetapan outlet pilot, cutoff, data awal, dan kesiapan perangkat masih wajib dikonfirmasi pada gate terkait. Persetujuan ini tidak menyalakan POS di Production.

| ID | Usulan konkret | Gate |
| --- | --- | --- |
| D01 | Poin dari total final setelah diskon termasuk biaya yang ditagihkan, saat 100% lunas | G2/G5 |
| D02 | DP didukung; guest tanpa poin; nol total tanpa event poin/transaksi baru | G2 |
| D03 | Tahun WIB saat pelunasan DB; missing rule menolak posting pelunasan member; member nonaktif memerlukan penyelesaian owner | G2/G5 |
| D04 | Tidak ada backfill guest/member/import atau re-award otomatis | G2/G6b |
| D05 | Pilot hanya full refund; partial refund/repricing dan koreksi salah member setelah bayar lewat paket khusus sebelum diaktifkan | G2/G5 |
| D06 | Owner menentukan hak diskon dan refund kasir secara granular; refund_full harus diberi izin eksplisit dan reason wajib, tidak ada login manajer terpisah | G2/G4/G5 |
| D07 | Qty .001 kg/m dan integer pcs; half-up item; diskon atas subtotal layanan; batas nota Rp1 miliar | G2/G4 |
| D08 | **Satu outlet `MJL` tetap**; nomor nota counter tunggal, tanpa fitur cabang; layanan/durasi/parfum/ongkir berdasarkan katalog nyata | G2/G4 |
| D09 | Owner login ID/password; kasir login langsung hanya ID `MAS-XXXX` 4 angka tanpa password/pairing; nomor unik tidak dipakai ulang; sesi 12 jam, throttle dan revoke; keamanan finansial wajib review G8 | G3/G8 |
| D10 | WA manual, online-only, HTML print; thermal/offline/gateway/WA otomatis paket lanjutan | G4/G7 |
| D11 | Pilot pada outlet Mas Jawa Laundry tetap saja; register/shift, saldo awal/piutang, sumber kebenaran dan waktu cutoff manual/Binatu | G8 |

G0 dan review dokumen boleh berlangsung tanpa menunggu semua keputusan. Task yang bergantung pada keputusan belum disahkan berhenti pada artefak desain/tes sintetis, tidak mengubah bisnis produksi.

## 11. Release, rollback dan Definition of Done

- **Alur release terbaru:** setiap task dari branch singkat → PR + tes + review → merge ke `main` → produksi melalui proyek Vercel `mas` yang sekarang. Tidak membuat deployment Preview/staging lain, tidak mengganti Git connection. Setelah merge cocokkan SHA Vercel Production + alias domain terhadap GitHub `main`, dan laporkan jika sinkronisasi tidak otomatis.
- **Gate GO khusus aktivasi POS finansial:** seluruh tests/CI hijau, DB migration/RLS review, UAT authenticated/fisik, restore rehearsal, env QA aman, baseline ledger historis terjaga dan keputusan bisnis/release tertulis. Merge kode parsial ke `main` **bukan** izin mengaktifkan POS; DB write flag default off. Monitoring punya penerima tindakan, query rekonsiliasi dan owner on-call; jangan sekadar menulis “monitor”.
- Urutan: deploy schema additive yang kompatibel dengan app lama -> deploy app flag-off -> verifikasi read-only -> tetapkan outlet/source of truth/cutoff -> enable DB-scoped write flag -> pilot -> reconcile shift. Semua alat pembayaran POS tetap disabled sampai G5/G7 lengkap.
- `POS_WRITE_DISABLED` harus diperiksa di DB command, bukan hanya menu/env client. Simpan flags per outlet dan capability agar bisa menghentikan create/payment/refund secara terkontrol; lookup committed/read/receipt print tetap tersedia bagi yang berhak. Command yang sudah commit tidak dibatalkan oleh switch.
- NO-GO/stop pilot segera untuk duplicate receipt/award, mismatch kas/piutang, data historis/token hilang, privilege leak, unidentified payment result yang tidak bisa direkonsiliasi, atau QA/runner dapat menulis produksi.
- Saat insiden: stop command baru pada outlet, reconcile receipt/poin committed, pertahankan akses baca dan hasil command, forward-fix. Jangan otomatis kembali ke input nominal lama atau menyalakan Binatu bersamaan karena itu bisa menduplikasi penjualan/poin. Pengalihan operasional memerlukan owner, cutoff, register nota sementara unik dan rekonsiliasi sebelum posting ulang.
- Jangan drop/revert destructive additive schema setelah transaksi nyata. App rollback hanya ke build yang memahami data/cutoff POS atau read-only safe mode; pastikan guard DB tetap berlaku walau UI lama kembali.
- Pilot lulus setelah minimal dua shift tertutup berturut-turut tanpa selisih tak terjelaskan dan tanpa P0/P1, dengan volume uji sintetis concurrency sudah lulus; owner dapat menetapkan masa lebih panjang. Tidak ada auto rollout lintas outlet.

Selesai berarti pegawai berizin dapat membuat nota dan menerima pembayaran, pelunasan memberi poin satu kali sesuai aturan DB, refund yang didukung menjaga ledger, kas/laporan reconcile, dan pelanggan menggunakan QR lama dengan saldo konsisten. Seluruh fitur pilot, batas scope dan bukti diterima owner. Dokumen ini tidak membuktikan fitur sudah dibangun atau data/cloud telah diubah.

## 12. Referensi review

- [G3 — Kasir tanpa password dan outlet tunggal](./g3-single-outlet-cashiers.md). Owner tetap satu-satunya login; pembayaran POS belum diaktifkan.

- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [Supabase database functions](https://supabase.com/docs/guides/database/functions)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Next.js data security](https://nextjs.org/docs/app/guides/data-security)

Referensi tersebut mendukung mekanisme teknis; keputusan tier, refund, tahun, kas dan lingkup pilot adalah usulan desain bisnis Mas Jawa Laundry, bukan aturan yang diklaim berasal dari vendor.

## 14. Receipt pekerjaan G4 — 1 November 2026

Dokumentasi rinci: [G4 Nota Laundry](./g4-order-verification.md). Dalam satu paket, G4 menambah kolom staff attribution yang kompatibel dengan data owner lama, membuat nota dan item memakai harga katalog DB, membatasi akses via dua token kasir MAS-XXXX, menyimpan hasil idempotent request UUID, menampilkan daftar/detail, cetak HTML dan dua transisi status cucian. SQL QA dan test rollback sudah lulus. Jalur keuangan tidak disentuh: **tidak ada posting pembayaran, kas, atau poin**, tidak ada migrasi G2–G4 ke produksi dan **satu outlet tetap write_enabled=false**. QA fisik, QR scan, durasi/ETA, ongkir/diskon dan bukti race dua koneksi masih TODO; jangan mengklaim G4 full GO.

**Alur developer wajib:** satu modul lengkap + tes + update dokumen dalam **satu PR konsolidasi** untuk menghemat CI, lalu merge ke `main` hanya jika seluruh checks lulus. Deployment menggunakan project Vercel Production `mas` yang sama; Git connection `unyilhm1-hue/mas` tetap, tanpa Preview/staging baru. Deploy source tidak mengizinkan migrasi database produksi atau mengaktifkan POS live.

## 15. Paket A — G5 pembayaran dan UI/UX rincian nota (1 November 2026)

**Implementasi satu PR:** lihat [bukti QA G5](./g5-payment-verification.md). SQL memisahkan pencatat owner Auth dan kasir `staff_id` dengan constraint XOR; tidak memasukkan kasir sebagai owner. RPC pembayaran mengunci outlet → nota → shift → aturan poin, mencatat receipt, jurnal kas, dan satu award member **hanya saat 100% lunas**, dalam satu transaksi. Full refund mengembalikan setiap receipt sesuai metode asal dan membuat VOID poin. Request UUID aman untuk replay setelah versi nota berubah; payload berbeda ditolak. Kasir harus berizin dan perangkat sudah dipasangkan oleh owner. Ketika POS single-outlet diaktifkan, input manual ADD dari owner lama ditolak untuk mencegah duplikasi kunjungan dan poin.

**UI/UX sesuai keputusan owner:** sedekat mungkin dengan alur Binatu pada screenshot 15–20: rincian nota, total, status pembayaran, tunai/non-tunai, daftar pembayaran, refund berizin, serta status cucian yang terpisah. **Identitas, logo, dan warna tetap Mas Jawa Laundry; jangan gunakan aset proprietary Binatu.** Referensi 25 screenshot berada pada [evidence manifest](./evidence-manifest.md). Implementasi Paket A menghadirkan panel pembayaran mobile-first di `/kasir/pesanan/[id]`, jumlah DP/sisa, buka kas, riwayat, dan refund. Penyempurnaan G4 (QR petugas, ongkir, diskon, ETA, daftar parfum) dan paritas UI keseluruhan masih menjadi pekerjaan berikut/G7.

**Status verifikasi:** migrasi G5 berhasil di Supabase QA `cwxsbgfjynwxqalwonae`; tes SQL rollback membuktikan transaksi/poin/refund/idempotensi dan kontrol izin, tes parser Node lokal lulus. 20/20 tabel POS tetap menggunakan RLS; seluruh uang, nota, shift, dan event sintetik setelah rollback kosong; `write_enabled=false`. Tidak ada migrasi ke Supabase produksi dan tombol G5 di production tetap nonaktif. CI lengkap perlu PASS sebelum PR merge; belum ada UAT perangkat nyata atau race dua koneksi pembayaran. Setelah merge verifikasi SHA Vercel Production yang sudah ada tanpa membuat deployment baru atau mengubah koneksi `unyilhm1-hue/mas`.

**Aturan kuota CI:** kode G5, SQL, UI, tes, dan pembaruan Implementation Plan berada **dalam satu PR** dengan satu push final setelah tes QA lokal; jangan mendorong perubahan parsial untuk memicu CI berkali-kali. Jika CI gagal, perbaiki dalam branch yang sama dan catat alasannya, lalu merge hanya saat seluruh gate hijau.

## 16. Paket B — G6 + G6b (2 November 2026)

**Satu PR konsolidasi** mencakup dua migrasi, satu SQL integration regression, enam unit test parser Node, navigasi owner/kasir, mutasi kas dan tutup shift, laporan periode/ekspor CSV, draf WhatsApp manual, serta pratinjau XLSX/CSV Binatu yang menampilkan **dialog satu per satu** untuk transaksi lunas. Status lengkap: [G6/G6b QA verification](./g6-g6b-verification.md), [rekonsiliasi impor Binatu](./import-reconciliation.md) dan 25 referensi visual dari [evidence manifest](./evidence-manifest.md). Tampilan sengaja mendekati hierarki Binatu sambil memakai identitas/warna/logo Mas Jawa Laundry, **bukan** menyalin aset Binatu.

**Hasil QA:** migrasi `pos_g6_cash_reports` dan `pos_g6b_import_review` berhasil diterapkan hanya di Supabase QA, setelah dry-run DDL dalam BEGIN/ROLLBACK. Tes `pos-g6-g6b-rollback.sql` PASS: flag-off, uang kas Rp25.000 + kas masuk Rp5.000 − kas keluar Rp1.000 = Rp29.000, close/refund-safe shift, replay UUID, laporan WIB, import owner-only, hash idempotensi, conflict nota dan review member **tanpa poin**. Tes parser XLSX/CSV 6/6 lokal lulus, semua fixtures tersimpan dalam rollback. Setelahnya 0 orders/payments/cash/points/import rows dan `write_enabled=false`; tabel POS RLS 20/20. CI Stage10 dan pengujian lainnya wajib hijau sebelum merge.

**Batasan yang tetap berlaku:** belum ada QR scanner kasir fisik, printer thermal, validasi kredit piutang pembukaan, penutupan shift pada dua koneksi paralel, QA real auth dan UAT pixel 25 screenshot. Import tidak pernah memposting receipt/point dan tidak menghapus data pelanggan. Data Binatu asli harus direkonsiliasi owner pada G7/G8 sebelum pilot. **Tidak melakukan migrasi DB produksi maupun membuka POS live.** Koneksi Git Vercel `unyilhm1-hue/mas` tetap dan tidak membuat staging.


## 17. Paket C — G7 automated hardening dan G8 readiness (2 November 2026)

**Batas pelaksanaan:** satu PR konsolidasi dari main, tidak membuat staging, tidak mengganti Vercel Git connection `unyilhm1-hue/mas`. Kode dapat di-merge/deploy Production `mas` hanya setelah CI lulus; **database produksi tidak dimigrasi, outlet write-off, dan G8 tidak boleh GO tanpa approval eksplisit**.

**G7 teknis:** lookup QR SHA256 dari token yang sudah divalidasi host+format, permission `member_lookup`/2-token device, hanya returns nomor member dan nama, serta menolak kartu revoked/inactive; scanner kamera/galeri lokal dengan fallback nomor member. Board kasir mempunyai tab aktif Antrian/Siap Ambil/Belum Bayar berdasarkan status DB, bukan elemen hiasan. POS memiliki aksen kuning/CTA sesuai layout Binatu dengan identitas Mas Jawa. SQL QA rollback untuk QA owner/cashier/revoked/missing permission PASS. Dua koneksi PostgreSQL 17 yang benar-benar concurrent (same-UUID dan different-UUID payment) ditambahkan ke Stage10: **baru boleh ditandai PASS saat CI selesai**. See [QA evidence](./g7-g8-verification.md) dan [25 screenshot audit](./ui-parity-audit.md).

**G7 yang masih terbuka:** Android real QR/camera/gallery, screenshot pixel parity 25/25 dengan owner, pencarian member berdasarkan nama, bottom sheet durasi, ongkir/diskon, parfum preset, jaringan putus saat uncertain commit, cash fisik dan thermal, owner+cashier live QA UAT. Jangan klaim seluruh UI sudah identik.

**G8 teknis:** [G8 read-only receipt](./g8-readiness.json) sengaja berstatus NO-GO dan [preflight checker](../../scripts/pos-g8-preflight.mjs) gagal jika schema 20 tabel flag-off, SHA domain, bukti restore, UAT fisik, rekonsiliasi, screenshot owner signoff atau approval cutover tidak ada. [Cutover](./cutover.md), [rollback](./rollback.md), [monitoring](./monitoring.md), [UAT](./uat.md). Baseline production read-only pada 2 November: 785 member, 18 kartu, 21 kunjungan historis, 19 amount snapshots, **0 POS table**. QA ada 20 tabel, `write_enabled=false`. Tidak ada backup/restore asli atau approval produksi dalam sesi ini: **G8 tetap BLOCKED**.

**Catatan histori QA:** satu migrasi metadata QA kosong bernama `pos_g7_readonly_qr_and_order_board` tercatat sebelum DDL aktual QA bernama `pos_g7_readonly_qr_and_order_board_ddl`. Migrasi canonical di repo hanya `20261102063000_pos_g7_cashier_qr_lookup.sql`. Rekonsiliasi histori QA ini pada gate migrasi; jangan gunakan metadata QA sebagai riwayat produksi.


## 18. Paket lanjutan G7 — paritas wizard pelanggan/durasi/layanan (2 November 2026)

**Owner requirement:** navigasi dan alur POS semirip mungkin Binatu 25 screenshot, tetapi warna, logo dan identitas tetap Mas Jawa Laundry. Semuanya dilakukan bersama pengujian dan pembaruan Implementation Plan V2 dalam **satu PR konsolidasi ke main**, tanpa staging/branch kerja panjang. G8 tetap NO-GO hingga bukti eksternal lengkap.

**Yang sudah ditambah:**
- Pencarian member berdasarkan prefix **minimal 3 karakter** dan hasil **maksimal 8** melalui SQL `laundry_pos_g7_member_name` yang menguji dua token kasir serta izin `member_lookup`; respon cuma nama+nomor member (tanpa alamat, WhatsApp, atau digest kartu). Nama kembar ditampilkan sebagai pilihan **manual berdasarkan nomor member**. QR dan ketik nomor langsung tetap tersedia.
- Wizard 4 tahap: Pelanggan → **Durasi bottom sheet** → Layanan → Konfirmasi. Keyboard/focus trap/Escape dan touch target diperhatikan. Durasi berasal dari `laundry_services.duration` dan merupakan **filter layanan berdasarkan harga katalog aktual**, bukan biaya ekspres yang direka. Semua pilihan baru mereset kuantitas agar tidak ada barang tersembunyi di total.
- Preset parfum adalah saran input opsional (`Tanpa parfum/Melati/Lavender/Mawar`) plus teks kustom. Tidak mengubah harga dan tidak menganggap consent.
- Bagian **antar/jemput dan diskon** hadir hanya sebagai penjelasan **belum tersedia**; tidak ada form nominal yang menipu pelanggan atau masuk ke invoice. Persetujuan kebijakan diskon, nominal ongkir, otorisasi owner, histori adjustment, dan SQL exact-IDR harus dibangun dan diuji sebelum tombol dipakai.
- Perhitungan final tetap dihitung ulang oleh PostgreSQL G4 dari service id, revision dan quantity saat membuat nota. QR scan/pencarian nama tidak pernah membuat kunjungan atau poin. Tidak ada migrasi/perubahan data produksi.

**Bukti QA:** migrasi `20261102074500_pos_g7_member_name_search.sql` dry-run dan applied **QA only**, regresi pencarian dua nama sama/nomor berbeda, member tidak aktif, prefix pendek, wildcard literal, perangkat tanpa pairing serta izin dicabut PASS dalam rollback. Tes Node duration pricing, bounded search dan UI source ditambahkan ke CI. Tidak ada QA fixture yang dipertahankan. Status visual tetap parsial; lihat [audit 25 layar](./ui-parity-audit.md). 2-connection race sebelumnya sudah PASS dalam PR #25; UAT Android fisik tetap belum dilakukan. 

**Penyimpangan dari Binatu yang masih sengaja diblokir:** pilihan durasi katalog tidak otomatis menghitung due date (beberapa durasi berupa rentang ambigu), fitur antar/jemput/ongkir dan diskon belum punya kontrak bisnis, dan pencarian nama tidak menunjukkan PII. Paket ini tidak memberikan izin menjalankan migrasi Supabase produksi, aktivasi outlet, atau menerima uang/poin.

## 19. Koreksi login kasir berbasis ID empat angka — 2 November 2026

- **Owner memilih format `MAS-0000` sebagai pola empat angka**; implementasi existing tetap alokasi `MAS-0001`, `MAS-0002`, dan seterusnya, dengan `MAS-0000` dicadangkan.
- Form `/kasir` menampilkan login langsung, bukan lagi layar “Perangkat belum diaktifkan”. Owner masih login ID/password dan menetapkan hak akses per karyawan; tombol aktivasi perangkat dihilangkan dari UI owner.
- Migrasi QA menambahkan sesi `DIRECT_ID` yang menjaga identitas staff asli, dua digest token dan revoke owner. Throttle login global dibatasi tetapi tidak setara autentikasi kuat; risiko brute-force/DoS tetap blocker G8.
- Tes rollback SQL, tes Node, audit security QA dan tes regresi CI dalam **satu PR**. Tidak ada migrasi produksi, aktivasi pembayaran/poin, proyek Vercel baru, atau perubahan koneksi Git.
- Receipt: [G3 direct ID verification](./g3-direct-id-login-verification.md).


## 20. Koreksi terpadu Argon POS + scan barcode (2 November 2026)
- Klarifikasi owner: area admin lama diubah menjadi shell POS; Owner dan Karyawan memakai bahasa visual yang sama seperti prototipe Argon dan 25 screenshot Binatu, dibedakan hak akses server/DB. Login terpadu di /admin/login dengan dua tab (Owner ID+password; Karyawan MAS-XXXX tanpa password). Route /kasir tetap login langsung kompatibel.
- Homepage owner memakai komponen PosBoard yang juga digunakan kasir; tidak menggunakan nota contoh fiktif. Owner tetap memiliki fungsi member, scan kartu, impor Binatu, pengaturan dan manajemen kasir. Kasir menggunakan order-board RPC dan flow nota existing yang dibatasi izinnya.
- Kamera menggunakan BrowserMultiFormatReader untuk QR dan barcode, galeri decode QR lama dengan fallback barcode lokal, server memverifikasi token QR melalui digest kartu dan nomor barcode MJL/angka lewat RPC member lookup scoped; scan tidak membuat visit/nota/pembayaran/poin.
- HTML Argon adalah referensi visual, bukan backend: data pelanggan, multiplier tarif dan durasi, demo login, pembayaran dan klaim WA terkirim tidak diimpor. Semua tarif dan ledger dari sistem asli.
- G8 tetap NO-GO: owner POS write, UAT 25 layar/perangkat, backup/restore, migrasi DB dan aktivasi produksi tetap memerlukan bukti dan persetujuan terpisah. Cek Vercel Production SHA karena koneksi Git masih berbeda dari source main.


## 21. Koreksi PR #29 — POS Owner terpadu & penempatan Argon (2 November 2026)

- **Batas:** sumber hanya `main` hasil merge PR #29 `c2d6d8e`. PR #30 tidak dicampur, tidak di-merge, dan tidak di-rebase. Hanya satu paket CI; produksi tidak dimigrasikan dan G8 tetap NO-GO.
- **Penempatan UI:** satu shell Argon/Binatu. Bottom navigation HP tetap Pesanan, Menu, Keluar. Menu Owner dikelompokkan **Operasional** (Tambah Pesanan, Scan Barcode/QR, Mutasi Kas, Laporan), **Data & pelanggan** (Data Pelanggan, Impor Binatu), dan **Pengaturan** (Layanan & Harga, Kelola Kasir, Pengaturan Akun). Sidebar desktop berfokus pada empat area utama; sisanya dari Menu.
- **Scan kontekstual:** komponen kamera+galeri ditampilkan pada tahap Pilih Pelanggan dalam wizard nota yang sama, bukan halaman dengan gaya berbeda. Owner scan standalone tetap dari Menu untuk membuka profil member. Owner QR lewat digest kartu aktif, barcode nomor MJL diverifikasi owner-only, pencarian nama dibatasi. Scan bukan kunjungan/poin/transaksi.
- **Flow P0:** Owner Tambah Pesanan menuju `/admin/pesanan/baru` dan detail menuju `/admin/pesanan/[id]`; tidak melewati login Kasir maupun sesi MAS-XXXX. Owner memakai `requireOwner`, transaksi Owner tetap *mode pratinjau read-only* karena G8 dan owner-attributed financial RPC belum disetujui. Jangan pura-pura tombol Bayar bekerja.
- **Board Owner:** RPC `laundry_pos_owner_order_board` dan `laundry_pos_owner_order_detail` read-only, memverifikasi owner di fungsi private. Migrasi disertakan untuk QA, **tidak diterapkan ke Supabase Production**. Saat DB POS tidak tersedia, tampilkan unavailable, bukan angka nota atau saldo palsu. Katalog dari `laundry_services` eksisting.
- **Paritas visual:** Scan, Impor Binatu, Layanan & Harga semuanya berada pada `PosWorkspace` dengan pattern/header/warna/card milik POS aktif. Tidak ada UI Admin baru atau aset Binatu proprietari; formulir impor dan edit katalog tetap mempertahankan logika existing. Hak akses menu Kasir mengikuti izin server; menu masih bisa dibuka tanpa `order_view`.
- **Masih tertahan:** uji nyata Android kamera/galeri dan 25 screenshot, akurasi impor dan harga, migrasi QA, owner commands untuk pembuatan nota/pembayaran, rekonsiliasi keuangan, serta G8 owner approval. Status akhir tetap **PARTIAL / G8 NO-GO** sampai bukti valid.


## 22. Owner approved: durasi sebagai kolom layanan, wizard 3 tahap (2 Nov 2026)
- Owner memilih **tanpa menu Durasi terpisah**. `/admin/settings/services` menampilkan durasi di tiap baris Layanan & Harga; form tambah/ubah layanan menggunakan satu field durasi dengan saran dari data katalog sendiri (tidak ada tabel, pilihan tarif, atau surcharge fiktif).
- Wizard Owner dan Karyawan bersama-sama memakai **Pelanggan → Layanan → Konfirmasi**. Setiap baris layanan menunjukkan paket, durasi, harga, dan satuan. Satu nota dapat memuat beberapa layanan dengan durasi yang berbeda; nominal dihitung dari harga per service ID/revisi seperti sebelumnya. Back/Next dan invalid quantity diverifikasi dengan test.
- Backend G4 sudah menyimpan item dan snapshot harga tetapi belum menyimpan estimasi due_at/per-item duration secara penuh; jangan mengklaim janji tanggal selesai otomatis, tambahkan sebagai G8 business/UAT gate.
- Schema dan Auth Production tetap tidak diubah. Keputusan untuk aktivasi finansial memerlukan UAT dan migrasi berizin yang terpisah dari release UI.


## 23. Matriks master audit dan urutan penutupan — 2 November 2026

Acuan terkini: [master-audit-20261102.md](./master-audit-20261102.md), termasuk per-gate lingkup, jalur source/UI/SQL, acceptance aktual, dependensi, masalah dan bukti yang dibutuhkan. Status bersifat **provisional**, final tree/CI belum disertifikasi.

| Gate | Status terkini | Penutupan berikut dan dependensi |
| --- | --- | --- |
| G0 | PARTIAL; baseline main/deployment 0fe995d terverifikasi root | Pin source/tree/deployment final dan snapshot konsisten; mendasari seluruh gate |
| G1 | PARTIAL; QA terpisah, restore BLOCKED | Restore nyata, credential-negative, real QA auth/card; bergantung G0 |
| G2 | IMPLEMENTED_QA / PARTIAL | Review migrasi shared core/private audit, ACL/lock graph, history, restore; bergantung G1 |
| G3 | PARTIAL / PHYSICAL_UAT_REQUIRED | Real Auth/revoke/expiry dan identity-risk owner approval; bergantung G2 |
| G4 | IMPLEMENTED_QA / PARTIAL | Owner create+duration snapshots QA, recovery/UI final pending; ETA policy/cancel/adjustments belum full; bergantung G3 |
| G5 | PARTIAL / FINANCE BLOCKED | Shared owner/staff core, independent finance gate OFF, timestamp/race/fault/network UAT; bergantung G4 dan identity review |
| G6 | PARTIAL / PHYSICAL_UAT_REQUIRED | Owner ops integration, opening/close/cash/report reconciliation; bergantung G5 |
| G6b | PARTIAL / NON-POSTING | Parser cancelled/footer+private audit final QA, real owner reconciliation; bergantung G1/G2 |
| G7 | PARTIAL / PHYSICAL_UAT_REQUIRED | Final automated suite lalu real Android/auth/cash/print dan 25 layar signoff; bergantung G3–G6b |
| G8 | BLOCKED / NO-GO | Restore, full reconciliation, fresh SHA-bound evidence dan approval migration/cutover; bergantung seluruh gate |

Prioritas pengerjaan: P1 recovery exact UUID/payload dan owner workflow → P1 finance core/actor/lock/timestamp QA → P2 import source/audit/cancellation/footer → P2 kontrak cancellation/ETA/adjustments/reporting → final Node/typecheck/build/Playwright/SQL/race/CI → bukti eksternal → keputusan release terpisah. Kriteria penutupan rinci dan enam temuan baseline terdapat pada master audit.

Checkpoint bukti root: produksi dan QA ACTIVE_HEALTHY; main dan Vercel READY SHA `0fe995d` domain benar. Produksi 785 member/18 kartu/21 event/19 amount dan **0 tabel POS**. QA 20 tabel POS publik RLS, zero direct write dan data legacy. Sembilan regresi POS existing PASS; owner-duration migration `20261102190000` applied QA dan fixture G4/G5/G6/catalog PASS. Node 268, baseline UI 78 dan build PASS hanya checkpoint. Migrasi owner ops/shared finance core aktual `20261102193000` serta import audit `20261102210000` sudah applied QA dengan fixture PASS; perubahan akhir menunggu receipt final root; jangan menganggap checkpoint ini sebagai PASS final tree/CI atau penerapan produksi.

Semua izin produksi, real Auth/hardware, restore aktual, rekonsiliasi finansial, risiko ID kasir, visual owner signoff dan cutover approval tetap BLOCKED / PHYSICAL_UAT_REQUIRED. Tidak ada mutasi produksi dari paket audit ini. PR #30 tetap di luar scope.


## Tambahan terverifikasi lokal — 3 November 2026

Keputusan Owner terbaru: wizard **Pelanggan → Durasi → Layanan → Konfirmasi**, satu paket per nota, **jam kalender**; durasi dan tarif resmi diisi Owner. Ini menggantikan kontrak tiga tahap/mixed-duration untuk katalog paket yang diaktifkan. Snapshot nota lama tidak dibackfill atau diubah.

Lima migrasi tambahan 20261103070000–074000 telah diterapkan QA saja. Keluarga layanan satu record + tarif per paket; pemetaan opsional record lama mempertahankan service ID; paket default nonaktif/tanpa durasi/tanpa tarif contoh. Tombol aktivasi katalog tidak mengubah write_enabled atau finance_enabled.

Nota memakai harga/revisi otoritatif; backend menolak campuran paket pada mode paket. Diproses, ready_at, collected_at, histori aktor, tab Sudah Diambil dan detail pembatalan tersedia. Trigger database menolak serah terima Belum Bayar, DP, refund dan tagihan nol; tidak ada override.

Template WA asli Owner tersimpan sebagai konfigurasi berotorisasi dan berversi. Nota/Siap/Sudah Diambil membaca ulang receipt dan ledger periode aktual, menyembunyikan poin untuk guest, membedakan perkiraan dengan saldo aktif. Kontak diverifikasi untuk nota dengan audit aktor; link wa.me hanya sesudah pemeriksaan penerima. Tidak ada pengiriman otomatis atau status SENT. Sumber URL: https://faq.whatsapp.com/5913398998672934.

23 fixture SQL regresi QA lulus secara kolektif; satu pemeriksaan jumlah tabel G5 awal gagal karena 20 menjadi 22 dan diperbarui ke 22 tanpa mengurangi RLS/ACL. Tambahan uji menolak unpaid/DP/refund/zero handover, menguji posting poin/lunas, ID kontak idempotent, revoke izin WA dan histori aktor. 284 tes Node dan TypeScript lulus; build dan suite browser final dijalankan kembali pada tree akhir. Fixture browser bukan real Auth atau uji Android/print fisik.

CI main c262a7f lulus: Audit Release Gate dan Stage 10 PostgreSQL Concurrency QA (run 41590525471 / 41590525640). CI/deployment **paket tambahan** harus diverifikasi pada SHA berikutnya; belum dinyatakan PASS di checkpoint ini. Production belum dimigrasi. G8 tetap NO-GO.

Advisor QA: default-deny RLS INFO disengaja; 3 anonymous dan 9 authenticated SECURITY DEFINER RPC exposure warnings pada tambahan awal ditinjau sebagai endpoint yang berotorisasi, bukan akses publik tanpa pemeriksaan. Negative auth/revoke fixtures lulus; kontrol identitas ID-only kasir tetap blocker sebelum finance. Tidak menyatakan advisor bersih. Raw ACL provider berbeda dari CI; fingerprint membandingkan definisi, RLS dan hak efektif anon/authenticated/kolom. Perbedaan semantic tersisa harus dijelaskan sesudah artefak CI final tersedia.


Checkpoint lokal final: 284/284 Node, TypeScript, build Next.js dan 93/93 browser PASS. Browser menguji komponen/route dan fixture sintetis; bukan bukti sesi bisnis nyata, WhatsApp terkirim atau physical UAT. Dua CI paket tambahan dan deployment SHA final masih harus diperiksa. Bukti aktual final disimpan pada release receipt terpisah setelah CI/deployment, tanpa mengubah persyaratan G8.
