# Rollback dan penghentian POS

V3.2: kembalikan aplikasi ke deployment terverifikasi `3d6c04a` pada proyek mas existing bila laporan baru bermasalah. RPC V3 dan CSV lama tetap tersedia. Pertahankan RPC baca additive V3.2 sampai tidak ada reader; tidak perlu restore data karena migrasi hanya menambah fungsi baca. Jangan mengganti jurnal, mengubah hasil Cocokkan Kas, menghapus nota atau melepas Mode Uji sebagai rollback laporan. Forward fix harus melewati QA/CI dan pembandingan fingerprint. [Kontrak](implementation-plan-v3.2.md).

Validasi07010000: pertahankan pemeriksaan sumber/tujuan sebelum separator saat rollback aplikasi. Request baru tanpa nama minimal3 karakter ditolak; retry transaksi historis yang identik tetap mendapat hasil asli. Jangan menghapus atau memperbarui metadata/jurnal lama untuk memperbaiki validasi ini.

Closure review V3.1: pertahankan pembatasan kategori Owner, privasi item serta lookup jurnal saat rollback aplikasi. Jangan memulihkan fungsi lama yang membuka kembali temuan akses. Migrasi06040000 tidak menulis ulang histori. Transaksi perpindahan lama yang identik tetap memakai alasan/digest aslinya. Jika UI lama tidak mengisi sumber/tujuan, API menolak pencatatan baru tersebut; lakukan forward fix UI, bukan melemahkan backend. Saldo rekening tidak direkonsiliasi oleh catatan laci satu sisi.

V3.1: rollback aplikasi ke deployment terverifikasi sebelumnya di proyek mas. Pertahankan snapshot/read RPC V3.1 dan metadata kategori/kontak; jangan menghapus jurnal atau draf sebagai rollback otomatis. Legacy print/WhatsApp RPC mempertahankan saldo akuntansi lama, sedangkan V3.1 menampilkan saldo yang dapat ditagih nol pada refund/batal. Core keuangan tidak ditulis ulang. Rutin V3 cash/report kini membungkus base private yang tetap berizin; jangan membuka EXECUTE base helper ke anon/authenticated. Forward fix harus QA/CI, bukan menonaktifkan pilot. [Rincian](implementation-plan-v3.1.md).

V3: rollback aplikasi ke deployment terverifikasi sebelumnya. Pertahankan rutin/table additive serta metadata payment-method/reconciliation agar audit baru tidak hilang. Jangan menyusutkan constraint opening jika carried balance sudah dipakai, jangan menghapus transaksi sebagai rollback, dan jangan mematikan pilot_test_only untuk mengatasi masalah. [Rincian V3](./implementation-plan-v3.md).

Katalog homepage4November: rollback aplikasi ke deployment terverifikasi sebelumnya jika pembacaan gagal. Fungsi additive `laundry_public_service_catalog()` boleh tetap terpasang karena tidak mengubah data atau API lama. Jangan drop sebelum seluruh reader berpindah. Scope dan bukti: [homepage/katalog](../2026-11-04-homepage-catalog.md). Tidak perlu restore data untuk perubahan fungsi baca ini.

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
