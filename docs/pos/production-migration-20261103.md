# Receipt migrasi struktur POS Production — 3 November 2026

**SCHEMA MIGRATED; FINANCE DISABLED. G8 tetap NO-GO untuk cutover keuangan.** Scope awal memakai785 member,18 kartu dan ledger poin lama secara langsung. Tidak ada impor histori Binatu, pembentukan ulang member, backfill transaksi atau saldo poin baru.

Owner secara eksplisit mengizinkan migrasi Production, kemudian meminta eksekusi tanpa prasyarat. Tiga migrasi awal selesai pada instruksi tersebut. Pesan Owner berikutnya kembali mewajibkan backup pelanggan; sebelum18 sisanya dibuat backup logis terenkripsi13 tabel publik aplikasi. Urutan ini dicatat, tidak diklaim ada backup sebelum migrasi pertama.

Source canonical:17430c0f608249a1d151840ac23eadb960f2cadb, verified release CI41599471224 dan DB CI41599471321. Seluruh21 file diverifikasi checksum-nya terhadap paket review; diterapkan satu per satu memakai apply_migration, lock_timeout5s dan statement_timeout90s. Semua berhasil. History Production sekarang38 receipt (17 lama+21 baru); timestamp receipt konektor berbeda dari versi filename canonical, sehingga mapping nama/checksum/versi aktual dicatat pada output JSON. Tidak menyalin history QA atau menulis ke QA.

## Verifikasi database


- 22/22 tabel POS publik RLS, tepat1 outlet; write_enabled=false, finance_enabled=false, package_workflow_enabled=false.

- 0 orders/payments/cash ledger/point links;0direct INSERT/UPDATE/DELETE/TRUNCATE untuk anon/authenticated pada tabel POS/privatePOS.

- 1.546 metadata entries Production=QA,0 selisih: columns, constraints, function definitions/config, RLS flags dan effective anon/authenticated table/column/function ACL. Ini bukan perbandingan raw provider defaults atau bukti full database restore.

- 13 tabel lama seluruhnya sama jumlah/hash pada kolom asal. Kolom additive baru dikecualikan dari perbandingan agar perubahan bentuk JSON tidak dianggap perubahan nilai historis. Member785, kartu18, event21 dan nominal19 tetap sama. Katalog9 layanan juga tetap sama; tidak menetapkan harga/durasi contoh atau mengubah rentang menjadi waktu pasti.

- Owner RPC tanpa identitas ditolak owner_only42501; katalog dengan token kasir invalid ditolak POS_ACCESS_DENIED42501. Tidak memalsukan sesi Owner atau menjalankan tes pembayaran sintetis di Production.

- Advisors:31 INFO RLS no-policy default deny;3 WARN anon dan9 WARN authenticated SECURITY DEFINER endpoint exposure berotorisasi; leaked password protection WARN masih ada. Tidak menyatakan advisor bersih. Keputusan kontrol identitas kasir dan physical UAT tetap dibutuhkan sebelum finance.

## Backup yang benar-benar dibuat

Lokasi privat di komputer pengguna: C:/Users/laras/.codex/backups/masjawalaundry/20261103-pos-schema-17430c0/.
File application-data.json.dpapi meliputi13 tabel publik aplikasi pada snapshot SELECT yang sama, beserta daftar kolom asal dan source SHA. Konten pelanggan tidak ditulis ke repository/output publik atau dicetak pada log. Manifest berisi jumlah, hash, ukuran dan hasil baca/dekripsi file; source38 migrasi disertakan untuk operator.

Enkripsi Windows DPAPI CurrentUser; dekripsi membutuhkan profil Windows pengguna ini. Readback byte/JSON PASS. Backup tidak mencakup Auth, Storage atau arsip consolidation private; bukan backup sistem portabel atau full PostgreSQL restore rehearsal. Backup/restore independen tetap pekerjaan operator untuk G8 finansial; tidak menandai evidence restoreRehearsal sebagai verified.

## Yang tersisa

Owner dapat mengatur paket/durasi kalender/tarif dan memetakan layanan lama melalui Pengaturan Layanan & Harga; semua paket masih inactive/null minutes. Real-session Owner/kasir, scanner Android/gallery, printer/WA, recovery jaringan, mitigasi ID-only, opening cash/ledger parity dan signoff fisik belum diganti oleh SQL/CI. Histori Binatu tidak diperlukan untuk tahap awal; impor kelak adalah keputusan terpisah dan tidak memposting poin otomatis.

Jangan mengaktifkan write/finance hanya karena schema terpasang. Rollback memakai stop flags dan forward fix; jangan DROP ledger/schema baru atau mengembalikan FK secara buta. Tidak ada rollback destruktif, refund nyata, award poin nyata, pesan WA terkirim, atau financial cutover pada eksekusi ini.
