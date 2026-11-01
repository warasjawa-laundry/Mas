# G8 STOP/rollback runbook

**Seluruh tindakan di bawah memerlukan operator terotorisasi. Dokumen ini bukan perintah yang telah dieksekusi.**

## Saat kondisi berbahaya
Tandai STOP jika ada poin duplikat, pembayaran ganda, nota tidak bisa ditelusuri, saldo kas berbeda, transaksi setelah shift ditutup, akses silang outlet/kasir, pelanggan/kartu hilang atau migrasi non-additive. Hubungi owner sebelum melanjutkan.

1. **Hentikan write di database dahulu**, dengan prosedur admin yang terautentikasi. Untuk outlet MJL jika skema sudah diaktifkan: lakukan transaksi terkontrol yang mengubah `laundry_pos_outlets.write_enabled=false`; verifikasi dari sesi lain. UI flag saja tidak cukup.
2. Tutup akses kasir/revoke device yang bermasalah; jangan menghapus order, receipt, `laundry_amount_transactions`, atau ADD/VOID.
3. Simpan ID request, nota, metode, kasir, UTC/WIB, ringkasan kas, saldo piutang dan diff jumlah poin dalam artefak privat. Jangan taruh PII atau token QR di issue/PR publik.
4. **App rollback** hanya melalui proyek Vercel Production `mas` yang sama, ke SHA yang telah diuji. Ini tidak meng-undo ledger yang sudah committed.
5. **Database restore** hanya setelah RPO/RTO dan dampak terhadap transaksi lama dievaluasi; jangan restore snapshot secara membabi-buta setelah pembayaran nyata. Utamakan penanganan audit/reconciliation dengan perintah koreksi append-only yang sah.
6. Pulihkan owner/member/QR/loyalty lama dulu, lakukan read-only audit baseline dan hitung kas fisik. Buka kembali POS hanya dengan persetujuan tertulis owner.

Rollback operasional bukan menghapus semua data POS. Migration additive tetap dipertahankan saat stop-write jika lebih aman; keputusan schema rollback memerlukan prosedur terpisah setelah audit FK, ledger dan rekonsiliasi.
