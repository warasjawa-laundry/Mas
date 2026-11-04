# UAT G7/G8

Status 3 November 2026: pilot guest dummy aktif, real GO belum diberikan oleh hasil pengujian. Automated evidence ada pada [verifikasi](./g7-g8-verification.md); fixture/browser print emulation bukan signoff perangkat fisik.

Production hanya boleh dipakai untuk latihan `UJI - Nama Dummy`, uang simulasi dan tanpa kontak/member pelanggan. Data member/poin sintetis diuji di QA. Akses QA dari perangkat harus dikonfigurasi operator dengan isolasi yang sah; tidak membuat Preview/Production baru atau memakai kredensial Production sebagai shortcut.

| Skenario | Expected result | Bukti lapangan |
| --- | --- | --- |
| Owner login → Pesanan → nota → bayar | Actor UUID Owner sendiri; tidak masuk login kasir | REAL_AUTH_UAT_REQUIRED |
| Kasir login ID, izin, revoke, expiry/two-tab | Backend menolak akses/aksi setelah revoke, bukan hanya tombol | REAL_AUTH_UAT_REQUIRED; mitigasi ID-only sebelum real finance |
| Wizard empat tahap dan ganti paket | Pelanggan → Durasi → Layanan → Konfirmasi; ganti paket meminta konfirmasi/pilih ulang | PHYSICAL_UAT_REQUIRED |
| Harga, ongkir, parfum dan stale catalog | Total/revisi/snapshot DB tepat; browser tidak mengirim harga buatan | PHYSICAL_UAT_REQUIRED |
| Tanggal kalender | 31/12 23:30 +6 jam menjadi 01/01 05:30; bulan/kabisat dan WIB benar; final dihitung ulang saat simpan | PHYSICAL_UAT_REQUIRED |
| Scan nama/nomor/QR/barcode/kamera/galeri | QA sintetis aktif ditemukan dan identitas salah ditolak; tidak award hanya karena scan | PHYSICAL_UAT_REQUIRED; member Production sengaja disabled pada pilot |
| DP→lunas, full refund, ready→collected | Cash/receipt reconcile; tidak overpay; pengambilan hanya PAID, bukan DP/refund/zero | PHYSICAL_UAT_REQUIRED; uang simulasi |
| Lost response sebelum/sesudah commit | UUID tetap, lookup exact actor; tidak menerima pembayaran kedua | REAL_NETWORK_UAT_REQUIRED |
| Nota uji Owner/Kasir | Marker DB true, label simulasi visible dan tetap tercetak, termasuk nama uji huruf kecil | PHYSICAL_PRINT_UAT_REQUIRED |
| Receipt dan WhatsApp | Nota uji tanpa bank/phone/link kirim; normal QA receipt punya nilai/points sah dan recipient check | PHYSICAL_WA_UAT_REQUIRED; jangan kirim kepada pelanggan asli |
| Shift, IN/OUT, laporan dan close | Semua simulasi dapat ditelusuri/reconcile, termasuk cash tanpa order | PHYSICAL_CASH_UAT_REQUIRED |
| UI HP/desktop, keyboard/zoom | Argon, tidak overflow, fokus/tap targets; bandingkan 25 referensi sesuai keputusan flow terbaru | OWNER_VISUAL_SIGNOFF_REQUIRED |
| Akhir pilot dan restore | Full backup/restore sah, jurnal simulasi ditangani, pilot OFF/test orders 0, saldo awal diterima | OPERATOR_OWNER_EVIDENCE_REQUIRED |

Catat perangkat, tanggal/jam, actor/role, skenario, expected/actual dan reviewer privat. Jangan menyimpan credential/raw QR/PII pada report publik. Jangan memberi PASS berdasarkan counts database saja atau membuat tanda tangan. Histori Binatu tidak diperlukan untuk rilis awal; bila impor dipilih, lakukan reconciliation batch terpisah.

## Perubahan identitas dan kontak pilot — 3 November 2026

Nomor member tetap MJL-0…, nota baru NOTA-1…, kasir baru MAS-2XXX. Satu nota lama beserta payment/cash dummy sudah diarsipkan atas izin Owner; 0 transaksi operasional saat snapshot, pilot tetap ON. Command/tombstone dan arsip private harus dipertahankan saat rollback; jangan reset counter atau mengaktifkan ulang invoice lama. Kontak penguji dan tautan wa.me kini diizinkan setelah verifikasi/konfirmasi, selalu dengan watermark simulasi. UAT aplikasi WhatsApp/perangkat fisik tetap PHYSICAL_UAT_REQUIRED. Rincian migrasi, hash data dan guard operator ada pada empat dokumen audit existing.

## Tambahan penerimaan simulasi poin

| Skenario | Expected | Bukti |
| --- | --- | --- |
| Konfirmasi Owner/Kasir HP/desktop | Harga/item/ongkir diverifikasi backend, poin dari rules/revisi/periode yang tampil |105 browser termasuk9 tambahan PASS; physical UAT tetap REQUIRED |
| Detail unpaid/DP/paid/refund | Perkiraan, menunggu, simulasi setelah lunas, dibatalkan; selalu TIDAK DIBUKUKAN | SQL QA dan browser PASS; login manusia belum signoff |
| Rules hilang/berubah dan tahun2026/2027 | Unavailable bukan0; revisi terlihat; paid memakai periode receipt akhir WIB | SQL rollback PASS; timestamp masa depan hanya fixture sintetis |
| Print/WA | POIN SIMULASI tanpa saldo asli; marker uji tetap tercetak, tidak auto-send | Browser print emulation/formatter PASS; printer/WA asli PHYSICAL_UAT_REQUIRED |
| Member sintetis QA75.000 | DP25.000 tanpa points, lunas50.000 award sekali/retry, refund VOID sekali dan saldo0 | RPC/ledger/balance/history SQL PASS, rollback |

Tidak ada reset data dummy Production pada task ini. Receipt final memuat hash dataset dan CI/deployment exact SHA; G8 tetap NO_GO.


## Validasi paket UI kedua peran, 4 November 2026

Perbaikan UI4November: ulangi login kedua peran, grant create-only/view-only/cash-only, ketik nomor kartu berawalan0, buka/tutup semua panel, review Binatu dengan Tab/Shift+Tab/Escape, nominal panjang, checkbox kontak dan konfirmasi Nonaktifkan Kasir. Uji320/390/768/1024/1440 serta keyboard HP, kamera/galeri, printer dan WhatsApp nyata. Otomatis bukan PHYSICAL_UAT_REQUIRED PASS; mode uji tetap tidak boleh mengubah poin member lama.

## UAT Member Experience V2

Evidence and complete automated scenarios: [Member Experience V2](../2026-11-04-member-experience-v2.md). Owner/operator must verify an issued card on physical Android: camera allow/deny/retry/close, gallery photo, correct member number, year selection, refresh/history/promo, lost/revoked card denial, TalkBack and 200% zoom. Also verify bookmarked unified login with real Owner/Kasir sessions and role redirect. Status **PHYSICAL_UAT_REQUIRED** until dated device/operator results exist; do not paste tokens or credentials into evidence. Camera video and QR browser fixtures are synthetic, not physical acceptance. This UI release does not authorize financial cutover, remove Data Uji or alter opening points.


## UAT visual background MasJawa (belum diuji pada perangkat fisik)
Pada domain utama dan perangkat Android/desktop, pastikan warna ungu–biru dan ikon SVG baru tampil pada login gabungan (tab Manajer/Kasir), fallback login `/kasir`, header dashboard Owner/Kasir, menu dan sidebar, serta halaman Kelola Kasir. Periksa logo resmi MasJawa, lengkungan panel putih, pemotongan banner pada lebar 320/360/390/768/desktop, teks tetap terbaca dan tidak ada overflow. Verifikasi tab dan login kedua peran tetap berfungsi; riwayat/kas/nota tidak berubah. Catat bukti fisik dan reviewer nyata, bukan otomatis PASS dari commit visual. Acuan: `docs/pos/brand-background-20261104.md`.


## UAT palet visual Kasir/Manajer (menunggu perangkat fisik)
Pastikan pada lebar 320/360/390/768/desktop: tombol login Manajer/Kasir, tombol Tambah Pesanan dan nota, menu/sidebar terpilih, tab antrian, status Belum Bayar/Lunas, mode uji, wizard paket-durasi, pilihan jumlah, pengaturan layanan, poin simulasi, mutasi kas, laporan, serta kartu cetak menggunakan tema MasJawa tanpa kuning lama. Kontras CTA putih pada ungu, tab aktif lavender dengan teks gelap, notice info biru, unpaid rose, paid hijau, refund/destruktif merah. Periksa focus ring, enabled/disabled dan keyboard/tab selection (bukan hanya warna), handover/print tetap terbaca, scroll/overflow dan tidak ada aksi berubah. Bukti otomatis tidak menggantikan UAT fisik. Lihat `docs/pos/brand-palette-20261104.md`.
