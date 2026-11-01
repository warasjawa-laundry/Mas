# Review rencana POS Mas Jawa Laundry V1

Tanggal: 1 November 2026, WIB. Lingkup: review dokumen dan pemeriksaan terarah salinan kode lokal; bukan audit ulang produksi atau eksekusi migrasi.

Kesimpulan: arah V1 tepat, tetapi belum cukup tegas untuk implementasi pembayaran dan cutover. V2 memperbaiki kontrak teknis dan urutan kerja; keputusan bisnis yang belum disetujui tetap dicatat sebagai usulan.

| ID | Prioritas | Temuan V1 | Perbaikan V2 |
| --- | --- | --- | --- |
| R01 | P1 | State `draft/created/paid_partial/paid_full/refunded` mencampur lifecycle pesanan dan pembayaran; refund bisa membuat piutang/poin salah | Pisahkan lifecycle, pekerjaan, pembayaran, refund; definisikan rumus dan transisi |
| R02 | P1 | `UNIQUE(request_id)` belum menjelaskan payload berbeda, timeout sesudah commit, dan retry dengan versi lama | Registry command, hash payload kanonis, replay sebelum cek versi, lookup hasil setelah timeout |
| R03 | P1 | Satu award aktif belum menentukan perilaku refund lalu pelunasan/re-award lintas tahun | Award cycle, VOID ke event asal, tahun/revisi asli, tanpa re-award otomatis; refund parsial ditahan sampai kebijakan disahkan |
| R04 | P1 | Menyembunyikan UI nominal lama tidak menutup RPC lama sebagai jalur award kedua | Cutoff per outlet dan guard DB untuk award manual baru; koreksi historis tetap tersedia dengan audit |
| R05 | P1 | QA baru disebut aman, tetapi guard lokal masih dapat menerima mode `single` operasional pada Preview dan hanya mengunci satu nama branch QA | Semua Preview/CI write harus fail closed pada project QA allowlist; uji URL, key dan seluruh credential server |
| R06 | P1 | Keanggotaan global dan akses per outlet belum punya batas terhadap kontak/saldo lintas outlet | Resolver pelanggan minimal lintas outlet, detail pesanan/kontak dibatasi; owner RPC tetap owner-only |
| R07 | P1 | Aturan tahun dan revisi belum mengunci timestamp pada transisi pelunasan, edit aturan bersamaan, atau tahun yang belum diatur | Waktu DB setelah lock, rule snapshot konsisten, tahun belum diatur menolak seluruh posting dengan pesan operasional |
| R08 | P1 | Rollback ke admin lama berpotensi membuka pencatatan manual tanpa nota ketika POS sudah berisi penjualan | Kill switch DB menolak command baru, tetap read/reconcile, guard cutoff tetap aktif; forward-fix untuk transaksi yang sudah committed |
| R09 | P2 | Angka nominal memakai bigint DB tetapi kontrak JSON/JS dan pembulatan belum diputuskan | String IDR/desimal, arithmetic integer, batas input dan contoh rounding yang dapat diuji |
| R10 | P2 | “Revenue report berdasarkan paid_at” menyamakan penerimaan kas dengan omzet/penjualan | Pisahkan nilai pesanan, penerimaan, refund, piutang dan poin; hindari istilah laporan akuntansi tanpa kebijakan pengakuan |
| R11 | P2 | Tutup kas disebut, tetapi tidak ada shift, saldo awal, pengeluaran non-pesanan, selisih atau cutoff | Model shift dan ledger non-sale, formula saldo harapan, close idempoten dan koreksi append-only |
| R12 | P2 | Snapshot/row hash impor belum menentukan bukti lebih baru dan dampaknya ke laporan live | Imported history terpisah, immutable source revision, paid_at tidak diketahui, opening receivable terkontrol; tidak membuat ledger/poin otomatis |
| R13 | P2 | Referensi 25 screenshot/Excel dinyatakan ada tetapi tidak ada pada lampiran review ini; baseline tanggal 1 November tidak diverifikasi ulang | Label evidence historis/input dokumen; reference inventory dan live baseline wajib di G0 |
| R14 | P2 | Guard reauth per document entry dapat memutus wizard saat refresh, pindah tab, atau kembali dari WhatsApp | Uji kebijakan sesi eksplisit dan draft aman dengan request ID stabil; jangan melemahkan auth diam-diam |
| R15 | P2 | WA outbox dan printer thermal masuk lingkup tanpa integrasi/perangkat yang dipilih | WA manual pada rilis awal; HTML print terlebih dahulu, thermal hanya jika ukuran/perangkat dan UAT disepakati |

## Bukti kode lokal yang dibaca

- `work/fix-ui-flows/proxy.ts`: document entry dan re-entry tertentu menghapus grant/sesi lokal, mengarahkan ke `notice=reauth`.
- `work/fix-ui-flows/lib/supabase/qa-preview-isolation.ts`: cabang `LAUNDRY_DATABASE_MODE=single` menerima origin operasional sebelum pemeriksaan Vercel environment; pemeriksaan QA lain dibatasi ke satu branch lama. Ini temuan pada salinan lokal, bukan klaim konfigurasi deployment saat ini.
- `work/fix-ui-flows/app/admin/points/actions.ts`: owner action memanggil `laundry_record_amount_visit` tanpa nota POS.
- `work/fix-ui-flows/supabase/migrations/20261016230000_stage9_amount_points.sql`: owner check, rule lock, snapshot revisi, dan pembandingan payload idempotency sudah ada. POS harus mempertahankan jaminan itu dan menambahkan integrasi nota; jangan menggantinya dengan check UI saja.

## Dasar teknis

Penguncian baris dan urutan lock digunakan untuk serialisasi command pada nota yang sama; konflik transaksi tetap harus ditangani. Rujukan: [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html), [transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html).

Fungsi privileged harus punya grants terbatas, pemeriksaan izin eksplisit dan search path aman. Rujukan: [Supabase database functions](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

Server Actions tetap memerlukan validasi akses dan input di server. Rujukan: [Next.js data security](https://nextjs.org/docs/app/guides/data-security).

Tidak ada perubahan aplikasi, data pelanggan, konfigurasi cloud, commit atau deployment dalam pekerjaan review ini.
