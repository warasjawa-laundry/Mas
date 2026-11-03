# Cutover G8

Keadaan 3 November 2026: schema dan katalog sudah Production; write/finance/package/pilot aktif untuk dummy-only. Ini bukan real GO. Kondisi dan pemilik acceptance berada pada [master audit](./master-audit-20261102.md), bukan checkpoint flags OFF lama. [Riwayat sebelum rekonsiliasi](https://github.com/warasjawa-laundry/Mas/blob/fe04ef7f1a9f7d65baece7373a708e730586d058/docs/pos/cutover.md).

## Sebelum peluncuran riil

1. Selesaikan latihan, rekonsiliasi dan penutupan shift simulasi saat pilot masih dibatasi guest dummy. Jangan menerima uang atau mengirim WA pelanggan nyata. Hasil command tidak pasti harus di-lookup dengan UUID yang sama.
2. Operator menghentikan command baru melalui write_enabled=false dan finance_enabled=false ketika memasuki maintenance/cutover. Lookup/read/audit tetap dipertahankan; committed command tidak dibatalkan oleh flags.
3. Verifikasi backup/restore aktual pada target sah, Auth/Storage scope, checksums, RPO/RTO, sumber/CI/SHA deployed serta snapshot member/kartu/poin. Jangan menyalin PII ke QA yang ada tanpa prosedur.
4. Owner/operator menetapkan prosedur klasifikasi/arsip/reset data simulasi dengan bukti rekonsiliasi cash/receipt/shift/point dan saldo pembukaan. Source saat ini belum menyediakan izin menghapus ledger; jangan DELETE/TRUNCATE atau menganggap pembayaran uji sebagai kas sungguhan. Bila butuh migrasi arsip, review dan uji terpisah dengan approval data yang jelas.
5. Setelah penanganan data uji diterima, verifikasi productionPilotTestOnly=false dan productionTestOrderCount=0 pada receipt terkini. Melepas pilot bukan langkah otomatis pada tahun/tanggal tertentu dan tidak dilakukan oleh review ini.
6. Isi evidence nyata pada g8-readiness.json untuk exact SHA: identitas/revoke, Owner/kasir Auth, perangkat/print/QR/WA, rekonsiliasi dan persetujuan. Preflight mensyaratkan flags finansial OFF pada pemeriksaan pra-aktivasi; status lama/pilot aktif tidak memenuhi GO.
7. Owner/operator menyetujui cutover riil, lalu mengaktifkan flags sesuai rencana dan memantau minimal dua shift tertutup tanpa selisih tak terjelaskan. Sumber/proyek/domain tetap sama; tidak reconnect Git atau membuat Production alternatif.

Histori Binatu dan backfill poin tidak diperlukan pada rilis awal. Jika dipilih kemudian, opening receivables/cutoff/reconciliation menjadi batch tersendiri; preview/upload tidak membuat receipt atau points.

## Kondisi STOP

Duplicate receipt/award, salah identitas, kas/piutang tidak reconcile, akses tak sah, hasil command tak dapat dipastikan, atau hilangnya data lama. Hentikan command baru, simpan request UUID/log non-PII dan rekonsiliasi sebelum forward fix. Jangan mengaktifkan sistem nominal lama/Binatu bersamaan tanpa cutoff karena berisiko mencatat dua kali.
