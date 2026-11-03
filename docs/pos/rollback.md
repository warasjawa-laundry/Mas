# G8 STOP/rollback runbook

> **Checkpoint terkini sebelum final CI (2 Nov 2026): PROVISIONAL / G8 NO-GO.** Root mengonfirmasi ketiga migrasi canonical telah diterapkan **QA saja**: `20261102190000_pos_owner_creation_duration_snapshots.sql`, `20261102193000_pos_owner_operations_shared_cores.sql`, `20261102210000_pos_import_review_audit.sql`. Fixture owner duration, owner operations, import audit dan regresi existing G5/G6/G2 PASS setelah apply. `write_enabled=false` dan `finance_enabled=false`. Lima browser test wizard sintetis PASS pada 320/390/1440px memakai mocks; ini bukan real Auth atau PHYSICAL_UAT. Synthetic restore dan race tambahan menunggu CI yang akan datang, **belum PASS**. Final tree/CI dan deployment paket baru belum disertifikasi. Produksi tetap 0 tabel POS; tidak ada mutasi produksi. Lihat [master audit](./master-audit-20261102.md) untuk dependensi dan bukti penutupan.

**Seluruh tindakan di bawah memerlukan operator terotorisasi. Dokumen ini bukan perintah yang telah dieksekusi.**

## Saat kondisi berbahaya
Tandai STOP jika ada poin duplikat, pembayaran ganda, nota tidak bisa ditelusuri, saldo kas berbeda, transaksi setelah shift ditutup, akses silang outlet/kasir, pelanggan/kartu hilang atau migrasi non-additive. Hubungi owner sebelum melanjutkan.

1. **Hentikan write di database dahulu**, dengan prosedur admin yang terautentikasi. Untuk outlet MJL jika skema sudah diaktifkan: lakukan transaksi terkontrol yang mengubah `laundry_pos_outlets.write_enabled=false` dan `finance_enabled=false`; verifikasi dari sesi lain. UI flag saja tidak cukup.
2. Tutup akses kasir/revoke device yang bermasalah; jangan menghapus order, receipt, `laundry_amount_transactions`, atau ADD/VOID.
3. Simpan ID request, nota, metode, kasir, UTC/WIB, ringkasan kas, saldo piutang dan diff jumlah poin dalam artefak privat. Jangan taruh PII atau token QR di issue/PR publik.
4. **App rollback** hanya melalui proyek Vercel Production `mas` yang sama, ke SHA yang telah diuji. Ini tidak meng-undo ledger yang sudah committed.
5. **Database restore** hanya setelah RPO/RTO dan dampak terhadap transaksi lama dievaluasi; jangan restore snapshot secara membabi-buta setelah pembayaran nyata. Utamakan penanganan audit/reconciliation dengan perintah koreksi append-only yang sah.
6. Pulihkan owner/member/QR/loyalty lama dulu, lakukan read-only audit baseline dan hitung kas fisik. Buka kembali POS hanya dengan persetujuan tertulis owner.

Rollback operasional bukan menghapus semua data POS. Migration additive tetap dipertahankan saat stop-write jika lebih aman; keputusan schema rollback memerlukan prosedur terpisah setelah audit FK, ledger dan rekonsiliasi.


**Pemilik tindakan eksternal:** Owner bersama reviewer keamanan/operator jaringan memilih dan menguji trusted workplace network yang benar-benar dibatasi atau kontrol identitas lebih kuat; ID-only known-ID impersonation tidak diselesaikan throttle. Operator DB membuktikan backup/restore produksi aman dan RPO/RTO; Owner+kasir/tester membuktikan real Auth, Android, uang/print dan visual; Owner+pemeriksa keuangan menandatangani cutoff/saldo/piutang/poin; Owner+operator release memberi approval schema dan cutover secara terpisah. Bukti/reviewer/timestamp privat wajib; semua masih BLOCKED sampai tersedia. [Daftar acceptance dan penanggung jawab](./master-audit-20261102.md#tindakan-eksternal-wajib-dan-pemilik-bukti).
