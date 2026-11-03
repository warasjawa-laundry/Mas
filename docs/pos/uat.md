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
