# Aktivasi transaksi dan pembayaran — 3 November 2026

Atas instruksi pengguna "aktifkan transaksi dan pembayaran", operator melalui konektor Supabase mengubah tepat satu baris outlet aktif MJL pada Production hncfyfvqtlnvqyfrydzb. Timestamp database: 2026-11-03 08:47:38.219378 UTC (15:47:38 WIB).

| Konfigurasi | Sebelum | Sesudah |
| --- | --- | --- |
| write_enabled | false | true |
| finance_enabled | false | true |
| package_workflow_enabled | false | false |

Tidak ada transaksi, receipt pembayaran, refund, cash entry, pemberian poin atau impor histori yang dijalankan oleh operator. Jumlah sesudah perubahan: orders 0, payments 0, cash ledger 0, point links 0. Hak akses dan sesi kasir tidak diubah; kasir aktif 0, grant direct DML anon/authenticated 0. Semua operasi bisnis tetap harus lewat RPC berotorisasi dengan pemeriksaan actor/session/permission dan idempotency.

## Batas operasional

Paket dan keluarga layanan aktif masih 0. Owner perlu mengisi durasi kalender/tarif resmi, memetakan layanan lama, dan mengaktifkan katalog paket pada Menu Owner > Pengaturan > Layanan & Harga. UI nota baru memakai package_workflow_enabled dan katalog paket aktif selain write_enabled; karena itu aktivasi dua flags saja belum membuat nota baru dapat disimpan melalui UI. Tidak menebak 72/24/6 jam atau mengganti durasi rentang lama. Tidak membuat akun kasir atau memberikan financial grant default.

G8 tetap NO_GO: aktivasi pengguna dicatat sebagai izin perubahan konfigurasi, tidak dipalsukan menjadi hasil physical UAT, kontrol identitas ID-only, independent review atau full database restore. Backup logis 13 tabel aplikasi terenkripsi lokal tetap tersedia; Auth/Storage dan restore PostgreSQL penuh belum diverifikasi.

## Verifikasi dan rollback

State dibaca ulang dari database sesudah UPDATE; kedua flags true, package workflow false dan seluruh ledger baru tetap kosong. Tidak membuat pembayaran sintetis di Production. Checker G8 tetap menolak live flags saat preflight dan evidence yang belum lengkap. Fixture candidate tes sekarang secara eksplisit memakai flags false agar menguji kontrak pre-activation secara terpisah dari state Production terkini; assertions schema 22, required evidence, SHA, identity dan finance tetap.

Jika terjadi hasil transaksi tidak pasti, hentikan command baru, lookup request UUID dan rekonsiliasi receipt/ledger. Operator dapat mematikan write_enabled/finance_enabled untuk menghentikan command baru. Jangan menghapus receipt/poin committed, mengganti UUID agar lolos konflik, menghapus schema atau melakukan refund rekaan. Menonaktifkan flags tidak membatalkan transaksi yang sudah commit.
