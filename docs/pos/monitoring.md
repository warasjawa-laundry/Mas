# G8 monitoring satu outlet (owner operational checklist)

> **Checkpoint terkini sebelum final CI (2 Nov 2026): PROVISIONAL / G8 NO-GO.** Root mengonfirmasi ketiga migrasi canonical telah diterapkan **QA saja**: `20261102190000_pos_owner_creation_duration_snapshots.sql`, `20261102193000_pos_owner_operations_shared_cores.sql`, `20261102210000_pos_import_review_audit.sql`. Fixture owner duration, owner operations, import audit dan regresi existing G5/G6/G2 PASS setelah apply. `write_enabled=false` dan `finance_enabled=false`. Lima browser test wizard sintetis PASS pada 320/390/1440px memakai mocks; ini bukan real Auth atau PHYSICAL_UAT. Synthetic restore dan race tambahan menunggu CI yang akan datang, **belum PASS**. Final tree/CI dan deployment paket baru belum disertifikasi. Produksi tetap 0 tabel POS; tidak ada mutasi produksi. Lihat [master audit](./master-audit-20261102.md) untuk dependensi dan bukti penutupan.

**Jalankan hanya setelah migrasi disahkan dan pilot aktif. Saat 2 Nov 2026 POS produksi belum ada.** Tidak ada automasi monitoring yang sudah dibuat.

Per setiap shift owner mengecek: 1) kas tunai harapan = opening + cash receipt + non-sale IN − refund cash − non-sale OUT; 2) seluruh receipt memiliki satu command UUID dan cash entry immutable; 3) tidak ada pembayaran melewati sisa tagihan; 4) semua ADD POS memiliki satu amount snapshot dan satu `laundry_pos_point_links`; 5) VOID refund terkait ADD yang sama; 6) jumlah piutang as-of period dan hist Binatu tidak tercatat ganda; 7) login kasir yang dicabut tidak memposting; 8) tabel RLS dan grant tidak berubah; 9) domain Vercel mengarah ke SHA `main` yang disetujui.

**Tanggapan:** mismatch sekecil Rp1, duplicate award/receipt, mapping member salah atau privilege leak = STOP write, simpan bukti privat, rekonsiliasi dan rujuk [rollback](./rollback.md). Jangan perbaiki ledger dengan UPDATE/DELETE raw. Gunakan laporan CSV periode WIB, audit request ID, catatan hitung uang fisik dan evidence owner.


**Pemilik tindakan eksternal:** Owner bersama reviewer keamanan/operator jaringan memilih dan menguji trusted workplace network yang benar-benar dibatasi atau kontrol identitas lebih kuat; ID-only known-ID impersonation tidak diselesaikan throttle. Operator DB membuktikan backup/restore produksi aman dan RPO/RTO; Owner+kasir/tester membuktikan real Auth, Android, uang/print dan visual; Owner+pemeriksa keuangan menandatangani cutoff/saldo/piutang/poin; Owner+operator release memberi approval schema dan cutover secara terpisah. Bukti/reviewer/timestamp privat wajib; semua masih BLOCKED sampai tersedia. [Daftar acceptance dan penanggung jawab](./master-audit-20261102.md#tindakan-eksternal-wajib-dan-pemilik-bukti).


### Tambahan 3 November 2026

Pantau POS_SINGLE_PACKAGE_REQUIRED, stale catalog/revision, contact_request_conflict, POS_HANDOVER_REQUIRES_SETTLED_PAYMENT dan kegagalan baca receipt. Jangan mencatat nomor HP, alamat, isi pesan, QR/token atau kredensial di log. wa.me opened/copied bukan delivery. Pantau jumlah point ADD/VOID vs pelunasan/refund dan periode program.
