# G8 monitoring satu outlet (owner operational checklist)

**Jalankan hanya setelah migrasi disahkan dan pilot aktif. Saat 2 Nov 2026 POS produksi belum ada.** Tidak ada automasi monitoring yang sudah dibuat.

Per setiap shift owner mengecek: 1) kas tunai harapan = opening + cash receipt + non-sale IN − refund cash − non-sale OUT; 2) seluruh receipt memiliki satu command UUID dan cash entry immutable; 3) tidak ada pembayaran melewati sisa tagihan; 4) semua ADD POS memiliki satu amount snapshot dan satu `laundry_pos_point_links`; 5) VOID refund terkait ADD yang sama; 6) jumlah piutang as-of period dan hist Binatu tidak tercatat ganda; 7) login kasir yang dicabut tidak memposting; 8) tabel RLS dan grant tidak berubah; 9) domain Vercel mengarah ke SHA `main` yang disetujui.

**Tanggapan:** mismatch sekecil Rp1, duplicate award/receipt, mapping member salah atau privilege leak = STOP write, simpan bukti privat, rekonsiliasi dan rujuk [rollback](./rollback.md). Jangan perbaiki ledger dengan UPDATE/DELETE raw. Gunakan laporan CSV periode WIB, audit request ID, catatan hitung uang fisik dan evidence owner.
