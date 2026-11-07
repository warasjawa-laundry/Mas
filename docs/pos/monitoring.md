# Monitoring POS dan pilot

V3.2: pantau penolakan interval/batas data dan kegagalan validasi snapshot sebelum XLSX dikirim. Ekspor tidak boleh menulis order/payment/ledger/point/member/audit/reconciliation. Bila enam sheet tidak cocok, hentikan unduh dan persempit periode/investigasi sumber; jangan mengirim laporan parsial. Log hanya waktu, kelas error dan request ID bila ada, tanpa isi laporan/token/PII. Periksa snapshot_at berbeda dari generatedAt, order CURRENT terpisah dari piutang historis belum tersedia, dan pemeriksaan fisik mempertahankan timestampnya. [Kontrak](implementation-plan-v3.2.md).

Review kas V3.1: pantau penolakan kategori Owner dari sesi kasir dan kegagalan lookup jurnal tanpa mencatat nomor telepon/catatan rekening. Lookup UUID harus tetap membatasi outlet serta menyembunyikan kuantitas bila order_view tidak ada. Perpindahan laci baru memakai label satu sisi di jurnal/CSV; jangan menganggapnya saldo rekening berpasangan. Retry transaksi historis tidak boleh menambah baris atau mengganti alasan lama. Bukti fingerprint rilis awal tersedia pada `docs/pos/evidence/v31-release-20261106.json`.

V3.1: pantau kegagalan baca snapshot/izin, perubahan versi sebelum print, request conflict pada kontak/kategori, export422 dan keseimbangan kas. Timestamp snapshot/perhitungan bukan perubahan nominal. Jangan log nomor telepon, alamat, token QR atau isi lengkap WhatsApp. Cetak/draf/unduh tidak boleh menaikkan jumlah payment, ledger atau point links. Hasil printer/login nyata tetap harus dicatat operator; indikator READY deployment bukan G8 GO. [Kontrak dan bukti](implementation-plan-v3.1.md).

Source kondisi operasional: [audit teknis G8](./g8-audit-20261102.md). Production saat ini pilot dummy, bukan penerimaan uang nyata; jangan menafsirkan flags ON atau status PAID nota uji sebagai G8 GO.

| Pantau | Tindakan |
| --- | --- |
| Flags write/finance/package/pilot dan SHA domain | Bandingkan dengan rencana yang disetujui; jangan otomatis melepas pilot |
| Nota uji tanpa marker atau terkait member | STOP command baru dan investigasi; marker DB harus immutable, guest-only |
| POS point-link untuk nota uji | Harus ditolak DB; jangan membetulkan dengan ADD/VOID manual tanpa rekonsiliasi |
| Kontak/tautan WA nota uji | Kontak baru ditolak, receipt contact null dan UI tanpa link kirim. POS_TEST_CONTACT_FORBIDDEN adalah penolakan yang disengaja; jangan bypass guard |
| Duplicate UUID/digest conflict/overpay atau hasil tidak pasti | Lookup request semula, periksa ledger, jangan buat UUID/pembayaran kedua |
| Cash/receipt/refund/shift totals | Rekonsiliasi; jurnal simulasi tidak menjadi kas awal riil. Identifikasi juga cash IN/OUT yang tidak terhubung nota |
| RLS/grant/actor drift | Bandingkan canonical metadata dan negative auth tests, jangan mengandalkan menu tersembunyi |
| Nota lama, snapshot harga/ongkir/durasi dan saldo member | Perubahan katalog tidak boleh mengubah riwayat |

Log hanya request UUID, order UUID bila diperlukan, operation, error class dan timestamp. Jangan mencetak password, bearer/QR raw, HP/alamat, isi receipt atau data pelanggan pada log monitoring. Membuka WA bukan bukti pesan terkirim.

Pada cutover riil kumpulkan bukti dua shift tertutup, saldo pembukaan dan reviewer. Preflight mensyaratkan pilot OFF/test orders 0 serta semua evidence; proses arsip harus direview, bukan DELETE/TRUNCATE ad hoc. Full backup/restore, real Auth dan physical UAT tetap dibutuhkan.

## Perubahan identitas dan kontak pilot — 3 November 2026

Nomor member tetap MJL-0…, nota baru NOTA-1…, kasir baru MAS-2XXX. Satu nota lama beserta payment/cash dummy sudah diarsipkan atas izin Owner; 0 transaksi operasional saat snapshot, pilot tetap ON. Command/tombstone dan arsip private harus dipertahankan saat rollback; jangan reset counter atau mengaktifkan ulang invoice lama. Kontak penguji dan tautan wa.me kini diizinkan setelah verifikasi/konfirmasi, selalu dengan watermark simulasi. UAT aplikasi WhatsApp/perangkat fisik tetap PHYSICAL_UAT_REQUIRED. Rincian migrasi, hash data dan guard operator ada pada empat dokumen audit existing.


## Validasi paket UI kedua peran, 4 November 2026

Sesudah rilis UI4November, periksa error RPC display_context/katalog, pesan mode tidak tersedia, grant menu versus tujuan, kegagalan lookup member, dan keluhan tombol/dialog mobile. Metadata gagal harus terlihat sebagai belum terverifikasi, bukan mode transaksi nyata. Tidak merekam token, nomor WA atau isi kartu ke log baru.
