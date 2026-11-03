# Eksekusi tambahan layanan, paket dan WhatsApp

Keputusan Owner 3 November 2026: jam kalender; durasi disimpan Owner, tanpa menetapkan 72/24/6 sebagai tarif/durasi resmi. Template asli diberikan Owner di chat; nilai transaksi contoh tidak diimpor. Empat tahap menggantikan kontrak tiga tahap untuk katalog paket baru.

Dependensi: main c262a7f; database CI PASS pada run 41590525640, release CI menunggu. PR #30 diabaikan.

1. Additive QA migration: keluarga layanan tunggal, paket global, variant tarif/revisi, pengaturan template dan audit. Katalog lama tetap utuh; mode paket diaktifkan eksplisit oleh Owner setelah tarif terisi, tanpa membuka write/finance.
2. Wizard empat tahap dan satu paket per nota, perubahan paket meminta konfirmasi; backend memvalidasi katalog aktif dan melindungi snapshot.
3. Status Diproses dan serah terima hanya setelah lunas; guard database juga mencakup endpoint lama.
4. Draf WA membaca ulang nota/pembayaran/ledger, dipisahkan nota/siap/diambil; template Owner, kontak terverifikasi, salin bila tanpa nomor. Tidak ada status terkirim otomatis.
5. QA rollback fixtures, regresi, browser, race, CI SHA final. Production schema dan financial switch tetap memerlukan approval terpisah.

Status awal: IN_PROGRESS; physical UAT tetap PHYSICAL_UAT_REQUIRED.


## Tambahan terverifikasi lokal — 3 November 2026

Keputusan Owner terbaru: wizard **Pelanggan → Durasi → Layanan → Konfirmasi**, satu paket per nota, **jam kalender**; durasi dan tarif resmi diisi Owner. Ini menggantikan kontrak tiga tahap/mixed-duration untuk katalog paket yang diaktifkan. Snapshot nota lama tidak dibackfill atau diubah.

Lima migrasi tambahan 20261103070000–074000 telah diterapkan QA saja. Keluarga layanan satu record + tarif per paket; pemetaan opsional record lama mempertahankan service ID; paket default nonaktif/tanpa durasi/tanpa tarif contoh. Tombol aktivasi katalog tidak mengubah write_enabled atau finance_enabled.

Nota memakai harga/revisi otoritatif; backend menolak campuran paket pada mode paket. Diproses, ready_at, collected_at, histori aktor, tab Sudah Diambil dan detail pembatalan tersedia. Trigger database menolak serah terima Belum Bayar, DP, refund dan tagihan nol; tidak ada override.

Template WA asli Owner tersimpan sebagai konfigurasi berotorisasi dan berversi. Nota/Siap/Sudah Diambil membaca ulang receipt dan ledger periode aktual, menyembunyikan poin untuk guest, membedakan perkiraan dengan saldo aktif. Kontak diverifikasi untuk nota dengan audit aktor; link wa.me hanya sesudah pemeriksaan penerima. Tidak ada pengiriman otomatis atau status SENT. Sumber URL: https://faq.whatsapp.com/5913398998672934.

23 fixture SQL regresi QA lulus secara kolektif; satu pemeriksaan jumlah tabel G5 awal gagal karena 20 menjadi 22 dan diperbarui ke 22 tanpa mengurangi RLS/ACL. Tambahan uji menolak unpaid/DP/refund/zero handover, menguji posting poin/lunas, ID kontak idempotent, revoke izin WA dan histori aktor. 284 tes Node dan TypeScript lulus; build dan suite browser final dijalankan kembali pada tree akhir. Fixture browser bukan real Auth atau uji Android/print fisik.

CI main c262a7f lulus: Audit Release Gate dan Stage 10 PostgreSQL Concurrency QA (run 41590525471 / 41590525640). CI/deployment **paket tambahan** harus diverifikasi pada SHA berikutnya; belum dinyatakan PASS di checkpoint ini. Production belum dimigrasi. G8 tetap NO-GO.

Advisor QA: default-deny RLS INFO disengaja; 3 anonymous dan 9 authenticated SECURITY DEFINER RPC exposure warnings pada tambahan awal ditinjau sebagai endpoint yang berotorisasi, bukan akses publik tanpa pemeriksaan. Negative auth/revoke fixtures lulus; kontrol identitas ID-only kasir tetap blocker sebelum finance. Tidak menyatakan advisor bersih. Raw ACL provider berbeda dari CI; fingerprint membandingkan definisi, RLS dan hak efektif anon/authenticated/kolom. Perbedaan semantic tersisa harus dijelaskan sesudah artefak CI final tersedia.


Checkpoint lokal final: 284/284 Node, TypeScript, build Next.js dan 93/93 browser PASS. Browser menguji komponen/route dan fixture sintetis; bukan bukti sesi bisnis nyata, WhatsApp terkirim atau physical UAT. Dua CI paket tambahan dan deployment SHA final masih harus diperiksa. Bukti aktual final disimpan pada release receipt terpisah setelah CI/deployment, tanpa mengubah persyaratan G8.
