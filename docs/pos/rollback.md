# Rollback dan penghentian POS

Pilot Production tetap dummy-only; real G8 NO_GO. [Master audit](./master-audit-20261102.md) memuat kondisi terkini dan acceptance yang belum selesai.

1. Pada insiden, operator berwenang mematikan write_enabled dan finance_enabled untuk menghentikan command baru. Jangan mengubah pilot_test_only menjadi false sebagai cara mengatasi error test.
2. Pertahankan baca nota, jurnal, audit dan lookup committed command. Gunakan UUID semula; timeout/NOT_FOUND tidak membuktikan operasi dibatalkan dan bukan alasan menerima pembayaran ulang.
3. Rekonsiliasi receipt, cash, shift, refund/VOID dan point links sebelum perubahan data. Jangan DROP schema, TRUNCATE, menghapus journal, mencabut marker is_test_order atau menghapus kontak lama sebagai rollback otomatis.
4. Kode aplikasi lama harus tetap memahami snapshot/DTO additive dan boundary dummy. Guard order/point/contact serta RLS/grants tetap berlaku walaupun UI dikembalikan. Jangan menonaktifkan guard keamanan agar UI lama dapat mengirim WA nota uji.
5. Forward fix harus teruji QA/CI dengan actor/ACL dan idempotency tetap. Deploy hanya commit terverifikasi ke proyek mas existing; cocokkan SHA domain.
6. Restore backup yang menimpa live database memerlukan rencana dan approval data spesifik: target terisolasi, scope Auth/Storage, RPO/RTO dan rekonsiliasi data setelah backup. Backup DPAPI 13 tabel aplikasi bukan izin restore penuh atau pengganti bukti PostgreSQL restore.

Arsip/reset simulasi menuju Januari 2027 memerlukan prosedur yang disetujui dan bukti saldo awal. Satu nota/payment/cash row yang sudah ada pada review dipertahankan. Riwayat sebelum pembaruan tersedia pada Git fe04ef7.

## Perubahan identitas dan kontak pilot — 3 November 2026

Nomor member tetap MJL-0…, nota baru NOTA-1…, kasir baru MAS-2XXX. Satu nota lama beserta payment/cash dummy sudah diarsipkan atas izin Owner; 0 transaksi operasional saat snapshot, pilot tetap ON. Command/tombstone dan arsip private harus dipertahankan saat rollback; jangan reset counter atau mengaktifkan ulang invoice lama. Kontak penguji dan tautan wa.me kini diizinkan setelah verifikasi/konfirmasi, selalu dengan watermark simulasi. UAT aplikasi WhatsApp/perangkat fisik tetap PHYSICAL_UAT_REQUIRED. Rincian migrasi, hash data dan guard operator ada pada empat dokumen audit existing.


## Validasi paket UI kedua peran, 4 November 2026

Rollback UI4November: kembalikan deployment ke commit terverifikasi sebelumnya pada proyek mas existing. Fungsi display_context boleh tetap ada karena hanya membaca; jangan drop fungsi selama source baru masih memakainya. Bila otorisasi katalog perlu dipulihkan, gunakan definisi sebelumnya dari migrasi20261103210500 setelah review, tanpa reset flag/data. Data member, kartu, poin, invoice, arsip, payment dan ledger tidak disentuh oleh migrasi044.
