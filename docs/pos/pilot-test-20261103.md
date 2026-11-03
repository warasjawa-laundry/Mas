# Pilot POS internal (data dummy) — 3 November 2026

**Tujuan:** membuat POS dapat diuji secara langsung di domain Mas Jawa Laundry sebelum operasional rencana awal 2027. **Tidak mengubah G8 NO_GO menjadi GO**.

## Lingkup dan pengamanan
- Semua pelanggan asli dan nomor member **dilindungi**. Hanya **Pelanggan umum** bernama `UJI - Nama Dummy` yang boleh membuat nota saat flag pilot hidup; pembatasan ada di SQL, bukan sekadar frontend.
- Migrasi additive `supabase/migrations/20261103210500_pos_test_only_pilot.sql` menyimpan `pilot_test_only` di outlet, `is_test_order` di nota, trigger sebelum insert/update untuk melarang pencampuran member serta trigger mencegah posting point-link nota uji.
- Nota, pembayaran/DP/lunas, shift, refund dan serah terima yang dipraktikkan adalah **simulasi finansial**; dilarang menerima uang nyata atau mengirim WhatsApp ke pelanggan. Jangan memakai data pelanggan asli untuk QR/WA pada pilot.
- Operator tidak membuat kasir otomatis. Owner dapat membuat kasir untuk test terkontrol, dengan catatan ID-only tetap risiko keamanan yang belum mendapat G8 sign-off.
- `package_workflow_enabled` dapat ON hanya setelah guard pilot terpasang dan `pilot_test_only=true`; konfigurasi existing `write_enabled`/`finance_enabled` tidak menjadi G8 GO.
- Harga, parfum dan antar-jemput berasal dari Supabase; biaya final dihitung ulang oleh SQL. Dokumen hasil testing dan screenshot HP nyata tetap harus diisi Owner/penguji.
- Perlu verifikasi independen sebelum hari operasional: backup/restore riil, keamanan akses Kasir, UAT fisik, rekonsiliasi kas dan saldo awal, archive/reset test orders + cash/point dummy, serta approval G8. Jangan TRUNCATE/DELETE ledger secara ad hoc.

## Prosedur operator
1. Audit HEAD main, CI, SHA domain Vercel, migrations QA/Production, baseline pelanggan/member/nota/poin.
2. Terapkan migrasi ke QA lalu SQL test rolled-back. Terapkan migrasi Production setelah tes dan CI lolos, **tanpa mengubah flags lebih dulu**.
3. Setelah deployment SHA cocok dan nilai 3 paket/tarif valid, operator mengaktifkan pilot atomik: `pilot_test_only=true` lalu `package_workflow_enabled=true` untuk satu outlet. Verifikasi kondisi dan jumlah nota sebelum/sesudah. Hanya Owner/pekerja tes yang melakukan simulasi.
4. Saat muncul hasil tak pasti, STOP dengan `write_enabled=false` dan `finance_enabled=false`, catat UUID+receipt, periksa laporan dan jangan mencoba pembayaran ulang dengan UUID baru.
5. Saat pilot selesai, audit seluruh data `is_test_order` untuk prosedur pembersihan yang direview. Keputusan go-live **terpisah** setelah G8 GO.

## Checkpoint
Uji regresi otomatis bukan pengganti UAT autentikasi riil, kamera, printer, WhatsApp, atau uang fisik. `docs/pos/g8-readiness.json` tetap berstatus NO_GO sampai semua evidence aktual disetujui.
