# G7 audit UI source vs 25 screenshot Binatu — 2 Nov 2026

> **Aktivasi konfigurasi Production — 3 November 2026, 15:47 WIB.** Atas instruksi eksplisit pengguna, outlet MJL sekarang write_enabled=true dan finance_enabled=true. Ini perubahan konfigurasi, bukan bukti G8 lulus. Package workflow masih false, paket/keluarga layanan aktif 0 dan kasir aktif 0; UI buat nota tetap memerlukan konfigurasi paket Owner melalui Pengaturan Layanan & Harga. Tidak menetapkan durasi/tarif rekaan atau mengubah izin kasir. Verifikasi sesudah aktivasi: orders/payments/cash/point-links 0, direct app DML grants 0. Histori Binatu/backfill tetap tidak dijalankan. Status readiness tetap NO_GO karena bukti UAT/identitas/restore belum lengkap; checker preflight tidak dilonggarkan. Lihat [receipt aktivasi](./financial-activation-20261103.md). Checkpoint OFF sebelumnya adalah histori sebelum aktivasi ini.


> **Production schema migrated — 3 November 2026.** Seluruh 21 migrasi POS source17430c0 telah diterapkan melalui konektor Supabase pada hncfyfvqtlnvqyfrydzb setelah izin schema eksplisit Owner. Production kini22/22 tabel POS ber-RLS,1 outlet; write_enabled=false, finance_enabled=false, package_workflow_enabled=false; orders/payments/cash/point-links 0 dan direct app DML grants 0. Seluruh1.546 fingerprint schema yang dibandingkan identik dengan QA, dan13 tabel lama pada kolom asalnya memiliki jumlah/hash identik. Backup logis13 tabel publik aplikasi dibuat terenkripsi DPAPI lokal sesudah3 migrasi pertama dan sebelum18 sisanya; decrypt/readback PASS, bukan full PostgreSQL restore/Auth/Storage backup. **G8 NO-GO untuk aktivasi finansial** sampai bukti keamanan/UAT/restore yang tersisa terpenuhi. Histori Binatu/backfill tidak diperlukan pada scope awal keputusan Owner; member/poin lama dipakai langsung. Checkpoint lama yang menyebut Production0tabel atau migrasi menunggu izin adalah histori yang telah digantikan receipt ini. Lihat [receipt migrasi](./production-migration-20261103.md).


> **Bukti terkini — 3 November 2026:** source `a502c0bce9638990d314db0f033a48df464b2e9f` lulus [release CI](https://github.com/warasjawa-laundry/Mas/actions/runs/41595889142) dan [database CI](https://github.com/warasjawa-laundry/Mas/actions/runs/41595889081): 284 Node, TypeScript, build, 93 browser; replay semua migrasi, SQL rollback, race dua koneksi dan restore sintetis PASS. Seluruh 1.546 fingerprint schema/RLS/hak efektif aplikasi QA identik dengan replay CI. Deployment existing Production `mas`, `dpl_9RVoM9zYWJT4dg1a8PMF2oeyDbFA`, READY pada SHA tersebut dan domain masjawalaundry.web.id. Production POS **0 tabel**, baseline legacy tetap sama; QA **22/22 RLS**, write/finance/package-mode OFF dan tidak ada transaksi/customer sintetis tersisa. **G8 NO-GO**, external evidence dan approval Production belum ada. Koreksi preflight terakhir mengubah kontrak 20 menjadi 22 tabel, dengan tes regresi red→green; tidak mengubah flag atau bukti bisnis. Paragraf checkpoint sebelumnya adalah histori, bukan status terkini. Lihat [receipt rilis](./release-20261103.md).


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

## Audit UI dan copywriting Karyawan/Kasir serta Manajer, 4 November 2026

Checkpoint audit sebelum implementasi: **PARTIAL; 23 temuan terbuka (6 P1, 17 P2)**. Status perbaikan ada pada penutupan di bawah; G7/G8 tidak dinyatakan selesai oleh audit ini. Bagian ini memperluas audit yang sama, bukan membuat dokumen audit G8 baru. Acuan source dan remote `main` yang diperiksa: `f2b79943dd43b4ed7276bbda87eaa56c31a34768`. Checkpoint tahun/tanggal dan konfigurasi pada bagian lama di atas adalah histori.

Antislop-ui, antislop-copywriting, antislop-layoutmobile dan antislop-human dipakai selama pemeriksaan. Arah desain tetap Argon MasJawa: kuning untuk tindakan utama, permukaan terang, navigasi berlabel. ENERGY 2 / RHYTHM 2 / MOTION 1 mengikuti aplikasi yang ada. Audit menilai kemudahan menemukan tindakan, membaca nominal, membedakan simulasi dan transaksi, serta menyelesaikan pekerjaan dengan sentuhan/keyboard; tidak mengusulkan desain pengganti.

### Cakupan dan batas bukti

- Inventaris source mencakup seluruh 7 route halaman `/kasir`, 18 route halaman `/admin`, kedua route ekspor, navigasi bersama, actions yang menjadi tujuan form, dan komponen pendukungnya. `/admin/points/rules` memang mengembalikan `notFound()`, bukan menu editor yang hilang. Keluar akun dan situs publik merupakan tindakan/tujuan navigasi, bukan halaman bisnis tambahan.
- Browser Chromium lokal merender **58 skenario × 6 lebar = 348 render** pada 320, 390, 768, 1024, 1280 dan 1440 CSS px, tinggi 900px. Ini mencakup source TSX/CSS asli dengan data, sesi, RPC, kartu dan identitas sintetis. Form server dalam harness statis diganti wadah tanpa action; efek submit tidak dijalankan. Panel `details` dibuka untuk mengaudit isi. Pemeriksaan ini bukan sesi login Production atau klaim semua kombinasi status sudah diuji.
- **40 tes browser existing PASS**: 32 wizard/WhatsApp/simulasi poin/pemulihan form dan 8 direktori pelanggan/review transaksi/kartu cetak. Tes wizard memalsukan scanner/member-search; karena itu scanner Kasir dan pencarian nama diperiksa terpisah, tidak dianggap tercakup oleh PASS wizard. Tes service-editor lama tidak digunakan sebagai bukti editor paket yang kini dipakai aplikasi.
- **35 pemeriksaan Enter pada summary PASS** pada fixture 390px. Ini membuktikan toggle native masih berfungsi, bukan bukti semua komponen lolos keyboard. Dialog Impor Binatu justru gagal pembatasan fokus dan Escape, lihat UIC-05.
- Pemeriksaan nominal/tautan/target sentuh/overflow memakai DOM browser, ditambah inspeksi screenshot representatif mobile dan desktop. Empat render gagal pemeriksaan overflow: scanner 320/390px serta unggah/review Binatu 320px. Render lain tidak menunjukkan overflow halaman pada data fixture yang digunakan. Tidak berarti semua isi nyata akan selalu muat.
- Kontrol terakhir dapat dijangkau setelah menggulir sampai bawah pada fixture yang diperiksa. Posisi bilah bawah di tengah screenshot panjang merupakan konsekuensi screenshot elemen fixed; bukan bukti tombol tidak dapat dijangkau. Tidak dicatat sebagai bug tumpang-tindih permanen.
- Probe server sintetis menunjukkan izin `order_create` saja diarahkan ke `/kasir`, sementara `order_view` saja dapat merender form baru. Probe input browser menunjukkan `000012` menonaktifkan pemeriksaan nomor, sedangkan `12` mengaktifkannya. Tidak ada pencarian member sungguhan atau submit nota.
- Route ekspor Kasir diuji dengan RPC/sesi sintetis: 200 valid, 403 tanpa izin, 400 tanggal salah, 503 RPC gagal, 422 hasil terpotong. Respons sukses memakai `private, no-store`. Ekspor Owner ditinjau melalui source `getVerifiedOwner()` dan route; autentikasi ekspor Owner tidak diuji lewat sesi nyata.
- Harness sempat gagal pada interop default dependency QRCode. Loader fixture diperbaiki; run final 348 render selesai. Ini kegagalan alat audit, bukan kegagalan kartu aplikasi. Kedua rangkaian tes existing di atas selesai tanpa tes gagal atau retry.
- Tidak ada login, perubahan izin, pencabutan sesi, upload impor, pembuatan member, penerbitan kartu, transaksi, pembayaran, refund, perubahan katalog, pengiriman WhatsApp, migrasi atau koneksi DB Production yang dilakukan untuk audit ini. Tidak ada PII Production di fixture.

### Matriks menu dan halaman

`S+B` berarti source ditinjau dan layout browser sintetis diperiksa. `S` berarti pemeriksaan source saja; efek eksternal tidak dijalankan. Semua baris diinventarisasi meskipun hanya terlihat untuk peran/izin/status tertentu.

| Menu/halaman | Karyawan/Kasir | Manajer | Bukti dan hasil utama |
|---|---|---|---|
| Login dan pemilihan peran | `/kasir`, `/admin/login?role=kasir` | `/admin/login?role=owner` | S+B; dua tampilan login, lokasi dan pending berbeda; UIC-18/23 |
| Navigasi desktop/mobile dan Menu | `/kasir/menu` | `/admin/menu` | S+B; tautan berlabel, menu Kasir utama tersaring izin; target keluar 320px kecil; UIC-09/12 |
| Pesanan | `/kasir` | `/admin` | S+B; source filter dan empat tab ditinjau; UIC-07/14 |
| Antrian, Siap Ambil, Belum Bayar, Sudah Diambil | query `tab` pada board dan daftar lama | query `tab` pada board | S+B; fixture Kasir mencakup tiap tab. Baris pembayaran sebagian masuk Belum Bayar; tidak mengubah data |
| Cari Pesanan/Daftar Pesanan | `/kasir/pesanan` | board Pesanan | S+B; halaman alternatif Kasir tidak memiliki input pencarian; UIC-09/10 |
| Tambah Pesanan | `/kasir/pesanan/baru` | `/admin/pesanan/baru` | S+B dan tes interaktif existing; kesalahan izin Kasir UIC-01 |
| Pelanggan umum/member, nomor dan pencarian nama | dalam Tambah Pesanan | dalam Tambah Pesanan | S+B; member diblokir saat pilot sesuai rancangan; UIC-02/22 untuk alur non-pilot |
| Barcode/QR, kamera/galeri | komponen dalam pelanggan member | komponen dalam pesanan dan `/admin/scan` | S+B untuk keadaan awal; UIC-03. Pembacaan fisik kamera tetap PHYSICAL_UAT_REQUIRED |
| Paket/durasi dan estimasi kalender | dalam Tambah Pesanan | dalam Tambah Pesanan | S+B + existing wizard tests; empat tahap paket adalah revisi Owner 3 November, tidak dinilai sebagai regresi ke rencana tiga tahap lama |
| Layanan, kategori, pencarian, kuantitas dan total | dalam Tambah Pesanan | dalam Tambah Pesanan | S+B + existing wizard tests; katalog sintetis/total/desimal/retry, bukan harga atau transaksi Production |
| Konfirmasi, parfum, antar-jemput, catatan, simulasi poin | dalam Tambah Pesanan | dalam Tambah Pesanan | S+B + existing wizard/point tests; label simulasi tetap ada; copy teknis UIC-16 |
| Detail nota dan harga/durasi tersimpan | `/kasir/pesanan/[id]` | `/admin/pesanan/[id]` | S+B; nominal membelah digit pada lebar sempit, UIC-11 |
| Buka kas, DP, pelunasan, refund | dalam detail sesuai izin | dalam detail | S+B; existing tes tampilan DP/lunas/refund, bukan transaksi finansial nyata; UIC-06/08/13 |
| Status pengerjaan, serah terima, pembatalan, histori | dalam detail sesuai izin | dalam detail | S+B; input pembatalan Kasir belum konsisten; UIC-13 |
| Cetak nota | dalam detail, `receipt_print` | dalam detail | S+B dan print-media fixture; printer fisik PHYSICAL_UAT_REQUIRED |
| WhatsApp, verifikasi kontak, baca/salin draf | dalam detail, `whatsapp_draft` | dalam detail | S+B + existing tes interaktif; tautan manual setelah persetujuan; UIC-08/13/16 |
| Mutasi Kas, kas masuk/keluar, buka/tutup shift | `/kasir/kas`, sesuai izin | `/admin/kas` | S+B; Owner memiliki buka kas langsung, Kasir diarahkan membuka dari nota; UIC-06/08/11 |
| Laporan, periode dan hasil kosong/gagal | `/kasir/laporan` | `/admin/laporan` | S+B; UIC-06/15 |
| Ekspor CSV | `/kasir/laporan/export` | `/admin/laporan/export` | Probe sintetis Kasir + S Owner; kontrak header CSV tidak diusulkan diubah, UIC-15 hanya bahasa UI |
| Data Pelanggan, pencarian dan pagination | tidak tersedia sebagai admin | `/admin/members` | S+B + existing direktori tests; Kartu Member ada pada setiap baris |
| Tambah Pelanggan | tidak tersedia | `/admin/members/new` | S+B; nama/WA opsional dan guard kesiapan kartu ditinjau, tidak menerbitkan data |
| Profil dan kontak pelanggan | tidak tersedia | `/admin/members/[id]` | S+B; tautan Kartu Member dan Ubah tersedia; akses fitur legacy UIC-17 |
| Ubah pelanggan, WA, status nonaktif, riwayat perubahan | tidak tersedia | `/admin/members/[id]/edit` | S+B untuk layout, S untuk konflik/nonaktif dan penyimpanan; nama/WA bisa diedit, alamat yang ada ditampilkan baca-saja |
| Kartu Member, cetak, belum punya kartu, ganti kartu | tidak tersedia | `/admin/members/[id]/card` | S+B + existing kartu tests; penerbitan/reissue mock pada fixture, tidak mengubah kartu nyata |
| Transaksi nominal/poin lama | tidak tersedia | `?view=transaction` pada detail member | S+B + existing review tests; fitur legacy, akses normal perlu keputusan UIC-17; tidak dicampur dengan pelunasan POS |
| Riwayat poin/transaksi dan pembatalan legacy | tidak tersedia | `?view=history` | S+B untuk catatan sintetis; tidak membatalkan transaksi nyata |
| Promo member, pemakaian, pembatalan dan draf WA | tidak tersedia | `?view=promo` dan komponen promos | S+B keadaan awal dan existing legacy controls tests; isi promo aktif/WA izin ditinjau source; tidak mengirim pesan |
| Impor Binatu: unggah, riwayat, preview, kandidat, konflik, skip | tidak tersedia | `/admin/pos/import` | S+B preview/calon member sintetis; upload tidak dilakukan; UIC-04/05/19 |
| Layanan & Harga: paket, kategori, tarif, satuan, aktif, urutan | tidak tersedia | `/admin/settings/services` | S+B memakai editor paket aktual; UIC-20 |
| Template WhatsApp dan informasi outlet | tidak tersedia | dalam Layanan & Harga | S+B dengan teks sintetis; template resmi/ketentuan/rekening pengguna tidak ditulis ulang atau diganti |
| Kelola Kasir: tambah, izin, ID, status, sesi | tidak tersedia | `/admin/pos/kasir` | S+B; pesan sukses berisi ID tersedia pada source, PendingSubmit tersedia; tidak mengklaim bug sesi nyata telah diuji ulang; UIC-21 |
| Pengaturan Akun dan ubah password | tidak tersedia | `/admin/settings` | S+B; syarat password dan pesan login ulang ditinjau; tidak mengganti password |
| Aturan poin lama | tidak tersedia | `/admin/points/rules` | S; sengaja 404, aturan dikelola database. Jangan menambah menu editor tanpa keputusan bisnis |
| Keluar akun/situs publik | action `leaveCashier` | action `logoutOwner`, `/admin/leave`, homepage | S; label/tujuan dan pembersihan sesi ditinjau, tidak menutup sesi pengguna |

### Temuan terbuka

P1 menghambat alur atau berisiko membuat petugas salah memahami tindakan. P2 mengurangi keterbacaan, konsistensi, atau kemudahan menemukan fitur. Tidak ada temuan P0 yang dibuktikan oleh audit UI ini; ini bukan audit keamanan backend baru.

| ID | Prioritas | Peran dan temuan | Bukti source/browser | Perbaikan yang disarankan |
|---|---|---|---|---|
| UIC-01 | P1 | Izin halaman Tambah Pesanan berbeda dari izin menu dan simpan | `app/kasir/pesanan/baru/page.tsx` meminta `order_view`; menu dan action memakai `order_create`. Probe create-only redirect, view-only bisa merender form | Selaraskan izin masuk halaman/tombol/action. Uji kombinasi izin dengan backend tetap menolak tindakan tanpa izin |
| UIC-02 | P1 | Nomor member tercetak berawalan 0 tidak dapat diperiksa lewat input manual | `order-form.tsx` mempertahankan nol input tetapi tombol mensyaratkan `[1-9]` di awal. Probe interaktif `000012` disabled, `12` enabled; resolver sebenarnya sudah punya normalisasi | Normalisasi nomor tercetak sebelum validasi/lookup; tetap simpan nomor canonical dan tampilkan identitas untuk konfirmasi. Berlaku pada alur member non-pilot; jangan membuka member asli pada pilot |
| UIC-03 | P1 | Pemindai Kasir kehilangan gaya, video tidak disembunyikan saat idle dan overflow | `CashierQrScanner` memakai `qrPanel`, `qrActions`, `galleryPick`, `qrVideo`, `qrHidden` yang tidak didefinisikan di wizard CSS. Wadah pelanggan sintetis overflow 114px pada 320, 44px pada 390; tombol kamera tinggi 30px | Lengkapi gaya komponen asli, batasi file/video sesuai wadah, sembunyikan video saat idle, target minimal 44px. Uji kamera ditolak/galeri rusak tanpa data nyata |
| UIC-04 | P1 | Unggah Binatu melebar keluar layar kecil | `app/admin/pos/import/page.tsx` memakai file input/grid inline tanpa pembatas lebar; halaman unggah dan review overflow 70px pada 320px | Beri anak grid `min-width:0`, file input berlebar wadah dan tombol reflow. Jangan menyembunyikan konten dengan overflow hidden |
| UIC-05 | P1 | Dialog review Binatu tidak mengelola fokus keyboard | `role=dialog aria-modal=true` tanpa focus trap/inert/handler Escape. Probe 390px: Tab dari tombol terakhir keluar dialog, Escape tidak menutup | Pindahkan fokus saat dibuka, tahan Tab di dialog, Escape tutup sementara tanpa keputusan review, pulihkan fokus ke pemicu |
| UIC-06 | P1 | Penanda pilot/simulasi tidak konsisten pada kas dan laporan | Halaman nota memiliki TestOrderNotice, tetapi kas/laporan kedua peran tidak membawa indikator pilot. Beberapa petunjuk pembayaran/refund tetap menyebut dana diterima/poin dibalik tanpa menyesuaikan nota uji | Tampilkan konteks simulasi dari backend pada kas/laporan dan copy tindakan nota uji. Jangan menyatakan mutasi sintetis sebagai transaksi pelanggan atau pelunasan nyata |
| UIC-07 | P2 | Board Manajer selalu mengaku pencatatan belum aktif | `app/admin/page.tsx` memasok `writeEnabled={false}` tanpa membaca capabilities | Ambil kemampuan aktual dan tampilkan beda antara terkunci, pilot, dan transaksi nyata. Jangan mengubah flag untuk menghilangkan pesan |
| UIC-08 | P2 | Enam disclosure Kasir dan satu daftar Binatu kurang terlihat sebagai kontrol | Hak akses, verifikasi kontak WA, refund, batal nota, mutasi kas, tutup shift; tambahan `Daftar seluruh nota` Binatu. Verifikasi WA tinggi 24px pada fixture Kasir 390, hak akses 38px; Owner WA 21px pada 390 | Gunakan bingkai/tampilan tombol dan label keadaan Buka/Tutup atau Lihat/Sembunyikan. Konfirmasi finansial tetap terpisah. Disclosure legacy Manajer juga perlu petunjuk keadaan; editor paket sudah mempunyai label Ubah sehingga tidak perlu diganti total |
| UIC-09 | P2 | Navigasi alternatif Kasir tidak mengikuti izin dan satu tujuan salah | `/kasir/pesanan` selalu memuat Tambah Pesanan/Mutasi Kas/Laporan; link Menu menuju `/kasir`, bukan `/kasir/menu`. Kas dan laporan saling menautkan tanpa memeriksa izin lawannya | Filter semua pintasan dengan grant yang sama seperti menu utama; betulkan tujuan Menu dan beri pesan penolakan yang jelas |
| UIC-10 | P2 | Cari Pesanan membuka halaman yang tidak menyediakan pencarian | Menu menuju `/kasir/pesanan`, sedangkan input cari hanya ada di `/kasir`. Daftar lama juga tidak menjelaskan batas 80 nota seperti board | Arahkan ke pencarian board yang sudah bekerja atau sediakan pencarian yang sama. Pertahankan penjelasan batas data, jangan menggandakan implementasi |
| UIC-11 | P2 | Nominal rupiah membelah digit pada mobile | Daftar lama, detail dan riwayat kas memakai batas 45% dan `overflow-wrap:anywhere`; screenshot `Rp75.000` dan `+Rp25.000` pecah di tengah angka ketika nama/kolom kiri panjang | Turunkan nominal ke baris sendiri saat ruang kurang dan jaga digit nominal utuh; pertahankan pembungkusan nama panjang |
| UIC-12 | P2 | Beberapa target klik belum 44×44px dan label Keluar hilang pada 320px | Keluar bawah 37×44px dan teks disembunyikan <359px; link pemilik login tinggi 18px, summary hak akses 38px; beberapa link kartu/impor pendek | Besarkan hit area, pertahankan label Keluar pada layar sempit; bedakan link paragraf dari kontrol navigasi utama |
| UIC-13 | P2 | Form kontak WA dan pembatalan Kasir tidak konsisten | `.paymentForm input` memberi checkbox ukuran input teks (minimal 48px dan lebar 100%); form batal Kasir tidak memakai gaya input paymentForm sehingga tinggi alasan 30px | Beri pengecualian checkbox dan label dengan area sentuh memadai; pakai gaya field yang sama untuk alasan pembatalan |
| UIC-14 | P2 | Empat tab status memakai grid tiga kolom | `pos-ui.css` repeat(3) untuk empat status; screenshot 1024px menempatkan Sudah Diambil sendirian pada baris kedua | Pilih susunan empat kolom bila muat atau grid 2×2 pada ruang sempit; status dan jumlah harus tetap terbaca |
| UIC-15 | P2 | Laporan memakai istilah teknis dan menyatukan error berbeda | `Tanggal akhir (eksklusif)`, raw `CASH`/kategori fallback dan pesan rentang salah atau layanan gagal dicampur | Jelaskan tanggal akhir yang belum masuk perhitungan dengan contoh sesuai pilihan, terjemahkan label UI dan pisahkan validasi tanggal dari koneksi. Jaga kontrak kolom CSV tetap kompatibel |
| UIC-16 | P2 | Copy tindakan dan instruksi memakai istilah internal/tidak konsisten | DP/Bayar sebagian, Refund/Sudah direfund/Pengembalian dana, Owner/Manajer, request yang SAMA, Supabase/database/posting; `Ubah ke Mulai proses`; scanner Owner menyebut membuka transaksi tetapi tujuan awal profil | Pakai kamus istilah dan kata kerja spesifik; letakkan ID teknis pada rincian pemulihan, tetap pertahankan peringatan idempotensi. Usulan copy ada di bawah |
| UIC-17 | P2 | Fitur legacy member tersedia tetapi tidak terjangkau dari profil normal | Profil default hanya Kartu Member/Ubah. MemberTaskNav dipasang setelah cabang profile selesai; direktori juga tidak menautkan transaksi/riwayat/promo | Catat keputusan bisnis fitur legacy yang memang ingin ditampilkan. Jika diaktifkan, sediakan navigasi eksplisit dengan otorisasi yang ada; jangan membuka pencatatan poin legacy pada pilot atau menambah jalur pemberian poin otomatis |
| UIC-18 | P2 | Login terpadu memuat lokasi Paiton berbeda dari shell | `app/admin/login/page.tsx` hardcode Paiton, shell memakai `site.shortAddress` Kandang Jati Kulon, Probolinggo | Gunakan sumber identitas outlet yang sama; jangan mengarang alamat baru |
| UIC-19 | P2 | Pencocokan Binatu menampilkan identitas/keputusan dengan format berbeda | Kandidat `Member #12`, sementara direktori `MJL-000012`; daftar raw PAID/PENDING/CONFLICT; kata batch/review/rekonsiliasi dominan | Format nomor sesuai kartu tanpa mengubah ID database, terjemahkan label status, tekankan konfirmasi hanya mencocokkan dan tidak memberi poin |
| UIC-20 | P2 | Panah eksternal pada editor katalog memberi isyarat yang salah | Label Ubah ↗ sebenarnya membuka details pada halaman yang sama, bukan tab/tujuan baru | Pertahankan label Ubah, ganti petunjuk dengan keadaan Buka/Tutup editor atau ikon disclosure. Tidak perlu mengganti desain editor yang sudah jelas |
| UIC-21 | P2 | Istilah hapus/nonaktif/perangkat kasir tidak seragam | Kelola Kasir menyebut Hapus kasir, Dihapus/nonaktif, kelola perangkat, tetapi operasinya soft-disable/revoke sesi. Tombol revoke/hapus langsung submit | Jelaskan Nonaktifkan kasir dan Cabut sesi beserta dampaknya; sediakan konfirmasi yang bisa dibatalkan. Pesan sukses ID dan PendingSubmit yang sudah ada dipertahankan, bukan ditulis ulang |
| UIC-22 | P2 | Beberapa keadaan kosong/gagal memberi arahan yang keliru | Member-name action mengembalikan [] pada RPC gagal sehingga UI menyebut member tidak ditemukan; katalog kosong dan hasil filter kosong sama-sama menyuruh ubah pencarian | Bedakan gagal memuat, belum dikonfigurasi, dan hasil pencarian kosong; beri satu langkah pemulihan yang sesuai |
| UIC-23 | P2 | Login Kasir tidak menunjukkan proses seperti login Manajer | Kedua form Kasir memakai button biasa; OwnerLoginSubmit sudah memakai useFormStatus | Tambahkan status Memeriksa akun dan tahan submit berulang selama request, tanpa klaim login berhasil sebelum backend mengonfirmasi |

### Usulan copy yang dapat ditinjau

Usulan berikut belum diterapkan dan tidak mengubah kebijakan bisnis, nominal, rekening atau template resmi pengguna.

| Lokasi | Saat ini | Usulan |
|---|---|---|
| Verifikasi kontak nota | Verifikasi nomor & alamat penerima | Atur penerima WhatsApp; Buka formulir / Tutup formulir |
| Hak akses | Hak akses kasir | Hak akses saya; Lihat izin / Sembunyikan izin |
| Catat kas non-penjualan | Catat kas masuk / keluar non-penjualan | Catat kas masuk atau keluar; petunjuk: Untuk transaksi di luar pembayaran nota |
| Status DP | DP / Bayar sebagian | Dibayar sebagian; rincian tetap menunjukkan nominal diterima dan sisa |
| Refund | Sudah direfund / Konfirmasi refund penuh | Dana sudah dikembalikan / Konfirmasi pengembalian dana |
| Mulai kerja | Ubah ke Mulai proses | Mulai proses |
| Hasil transaksi belum jelas | request yang SAMA | Periksa hasil transaksi terlebih dahulu. Jika perlu mencoba lagi, gunakan formulir ini agar nomor permintaan tetap sama |
| Sumber tarif | Tarif berasal dari Supabase | Tarif mengikuti pengaturan outlet dan diperiksa lagi saat nota disimpan |
| Tahun poin belum tersedia | Aturan poin periode … belum tersedia | Pertahankan: penyebab dan konsekuensinya sudah jelas; jangan mengganti dengan 0 poin |
| Laporan: tanggal | Tanggal akhir (eksklusif) | Tanggal batas akhir; petunjuk: Transaksi pada tanggal ini belum dihitung. Tambahkan contoh dari tanggal pilihan, tanpa mengubah logika query diam-diam |
| Binatu | Konfirmasi hanya pencocokan (tanpa poin) | Simpan kecocokan member; petunjuk tetap: Tindakan ini tidak mencatat pembayaran atau menambah poin |
| Kelola pegawai | Hapus kasir | Nonaktifkan kasir; jelaskan sesi berakhir dan riwayat tetap tersimpan |
| Ekspor | Ekspor CSV | Unduh laporan CSV |
| Situs publik | Lihat homepage (keluar admin) | Buka situs publik; jelaskan sesi Manajer berakhir bila itu perilaku yang tetap dipilih |

### Bukti lokal dan pekerjaan lanjutan

Artefak berada di direktori kerja `outputs/cashier-ui-audit-20261104/`: `metrics.json` (348 render dan probe), `member-input-probe.json`, screenshot bernama menu/peran/lebar, dan trace tes jika ada kegagalan. Log tes: `outputs/cashier-audit-browser.log` (32 PASS), `outputs/owner-audit-browser.log` (8 PASS). Script audit berada di luar repository; seluruh data artefak sintetis.

Implementasi yang disarankan satu paket terkoordinasi: tutup P1 dahulu, lalu konsistensi navigasi/copy/field P2, gunakan komponen yang sudah ada dan tes perilaku yang gagal saat ini. Jangan membuat ulang board/editor atau mengulang pekerjaan kartu dan recovery yang sudah benar. Setelah perbaikan, uji ulang peran/grant, member nol awal, scanner, dialog, nominal panjang, serta lebar peralihan 768/1024, lalu build dan satu CI yang relevan untuk paket source tersebut.

Real Auth Owner/Karyawan, pencabutan sesi nyata, keyboard Android/iOS dan layar pendek, kamera/galeri perangkat, printer, WhatsApp sungguhan, serta persetujuan visual Owner tetap **PHYSICAL_UAT_REQUIRED** atau **REAL_AUTH_UAT_REQUIRED** sesuai jenisnya. Bukti otomatis ini tidak mengisi sign-off bisnis/backup/rekonsiliasi G8. G8 tetap NO_GO untuk penggunaan finansial nyata. Tidak ada commit, push, CI baru, deployment atau migrasi produk yang dilakukan oleh audit UI ini.

### Penutupan implementasi UI, 4 November 2026

Owner menginstruksikan perbaikan seluruh hasil audit. Perubahan dibuat sebagai satu paket pada main terbaru, dengan desain Argon tetap. Matriks di atas merupakan bukti sebelum perbaikan, bukan daftar bug yang masih terbuka setelah paket ini.

| Temuan | Implementasi dan bukti penutupan teknis |
|---|---|
| UIC-01 | Halaman baru meminta order_create; katalog SQL mengizinkan order_create atau order_view dengan dua token sesi tetap wajib. Node test dan SQL QA memeriksa create-only, view-only, cash-only serta revoke |
| UIC-02 | Input nomor tercetak dinormalisasi sebelum lookup; dua browser test Owner/Kasir membuktikan 000012 dikirim sebagai 12 dan identitas MJL-000012 tetap terlihat |
| UIC-03/04 | CSS scanner nyata dilengkapi, video idle disembunyikan, tombol/file/video reflow; input unggah Binatu mengikuti lebar wadah. Pemeriksaan ulang 348 render pada enam lebar tidak menemukan overflow halaman |
| UIC-05 | Review Binatu memakai dialog native showModal; lima tes browser menguji fokus di dalam dialog, Escape, penutupan sementara, fokus kembali ke pemicu, dan tidak ada submit keputusan saat menutup |
| UIC-06/07 | Status kas/laporan dibaca melalui fungsi metadata berotorisasi, board Manajer memakai write_enabled aktual. Copy pembayaran/refund nota uji mengikuti is_test_order dan tidak mengaku memindahkan dana/poin member |
| UIC-08/12/13 | Disclosure native berlabel Buka/Tutup dan area klik minimal48px; input alasan pembatalan konsisten, checkbox tidak lagi mewarisi ukuran input teks. Label Keluar tetap tampil pada320px; ringkasan legacy memperoleh petunjuk Buka/Tutup |
| UIC-09/10 | Daftar Pesanan lama menggunakan board pencarian yang sama. Pintasan Kas/Laporan diperiksa dengan grant tujuan; tidak ada lagi link Menu yang menuju daftar lama atau tombol tambah tanpa izin |
| UIC-11/14 | Nominal rupiah diletakkan utuh saat ruang sempit; empat tab status memakai empat kolom atau2×2 sesuai ruang |
| UIC-15/16/18/19 | Tanggal batas akhir dijelaskan tanpa mengganti semantik query, validasi tanggal dipisah dari kegagalan pemuatan, label metode/kategori diterjemahkan. Lokasi login memakai site; nomor kandidat Binatu memakai format kartu. Instruksi scanner membuka profil dan teks harga menghindari istilah internal |
| UIC-17 | Profil menautkan riwayat dan promo secara eksplisit. Pencatatan/koreksi transaksi poin lama disembunyikan pada pilot/metadata tidak tersedia; server action recordAmountVisit, recordOwnerVisit dan correctOwnerVisit juga memeriksa mode sebelum memanggil RPC ledger. Tidak mengaktifkan penulisan poin lama |
| UIC-20/21/23 | Editor paket memakai isyarat Buka/Tutup, bukan panah tab luar. Nonaktifkan Kasir dan cabut sesi mempunyai review inline/Batal sebelum submit. Login Kasir memakai status pending yang sama dengan Manajer; pesan sukses beserta ID yang sudah benar dipertahankan |
| UIC-22 | Katalog belum tersedia dibedakan dari hasil filter kosong. Kegagalan lookup tidak lagi berubah menjadi daftar member kosong; UI mengarahkan pemeriksaan koneksi |

Migrasi `20261104070000_pos_ui_display_context.sql` hanya menambahkan fungsi STABLE untuk tiga boolean konteks dan mengganti otorisasi pembacaan katalog. SECURITY DEFINER memakai search_path kosong dan validasi Owner/sesi aktif. Tidak ada tabel baru, DML/backfill, perubahan flag, harga, member, saldo, pembayaran, atau grant tabel. QA diterapkan dahulu dan `pos-ui-context-rollback.sql` PASS dengan role anon ber-token, kasus negatif tanpa sesi, create-only, cash-only, serta kasir nonaktif; seluruh fixture rollback. Fixture juga dimasukkan sekali ke CI database dan rehearsal restore sintetis.

309 tes Node, build dan 113 tes browser lengkap lokal PASS. Lima tes kontrol baru serta 34 tes focused existing/wizard PASS. Run browser lengkap pertama terputus saat lingkungan tool tersambung ulang dan tidak diklaim PASS; run lengkap baru menjadi acuan receipt. Fixture kontrol sempat gagal karena setup bundle dipanggil beberapa worker pada direktori sama; spec diberi mode serial untuk setup bersama, tanpa melewati assertion. Mock pengujian lama diperbarui untuk pembacaan metadata tambahan dan navigasi riwayat yang memang kini ditampilkan; pemeriksaan riwayat, nominal gagal dan pencegahan pembatalan ulang tetap dipertahankan.

Artefak sesudah perbaikan disimpan terpisah di `outputs/ui-remediation-20261104/`, sehingga screenshot dan angka audit awal tetap utuh. Hasil CI/main/deployment final dicatat dalam receipt rilis lokal, bukan disamakan dengan bukti fisik. Ke-23 temuan sudah mempunyai perbaikan source dan bukti teknis; sign-off tampilan/perangkat nyata tetap PHYSICAL_UAT_REQUIRED. G7 tetap PARTIAL sampai bukti manusia terpenuhi, G8 finansial nyata tetap NO_GO.

Review terakhir juga membatasi promo legacy menjadi baca-saja selama pilot/metadata belum tersedia. Server action pemberian/penggunaan/pembatalan promo menolak mode tersebut sebelum RPC mutasi; tes Node dan browser negatif melindungi jalur yang baru ditautkan ini.
