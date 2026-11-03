# Monitoring POS dan pilot

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
