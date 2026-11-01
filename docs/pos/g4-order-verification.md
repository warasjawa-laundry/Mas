# G4 – Nota laundry, katalog dan status kerja (QA-only)

**Tanggal:** 1 November 2026 (WIB). **Status:** kode dan migrasi selesai untuk baseline G4; pengujian QA berjalan, **belum ada migrasi/pembayaran POS di production**. Jangan sebut G4 FULL GO sebelum UAT perangkat dan seluruh opsi bisnis disahkan.

## Implementasi dalam satu paket

1. Migrasi `supabase/migrations/20261101190000_pos_g4_order_creation.sql`: actor bridge aditif untuk `laundry_pos_orders.created_staff_id`, `laundry_pos_commands.actor_staff_id`, `laundry_pos_order_events.actor_staff_id`, serta guest `created_staff_id`. Kolom owner/Auth yang lama menjadi nullable dengan **CHECK XOR** sehingga record lama tetap dapat menyimpan pencatat owner asli, sedangkan transaksi kasir baru hanya menyimpan `staff_id` asli—tidak meminjam kredensial owner.
2. RPC kasir dengan keamanan two-token yang sudah disetujui G3: katalog terbatas, lookup member **berdasarkan nomor tepat** (tidak melakukan pencarian massal nama/HP), pembuatan order, daftar 40 order terbaru, detail order dan transisi status `QUEUED → READY → COLLECTED`. Izin `order_view`, `order_create`, `order_work`, `member_lookup` diperiksa lagi **di DB setiap request**.
3. Pembuatan order: input 1–30 item, sumber harga/nama/unit/revisi adalah katalog aktif di DB; pelanggan member harus aktif atau guest bernama valid. Kuantitas kg/m ketelitian .001, pcs bilangan bulat, `line = floor((price*qty_milli+500)/1000)` dan total maksimum Rp1 miliar. Catalog row `FOR SHARE`, invoice counter singleton DB, `MJL-000001` dst, dan payload digest + request UUID untuk replay idempotent. Harga berubah/revisi lama ditolak. **Tidak ada** command pembayaran, refund atau award poin.
4. Form UI `/kasir/pesanan/baru` menampilkan alur pelanggan → daftar layanan +/- kuantitas → konfirmasi/parfum/catatan/total sticky. `/kasir/pesanan` daftar pesanan, `/kasir/pesanan/[id]` detail, cetak HTML, perubahan status pekerjaan. Input nominal dari browser *tidak dipercaya*. Saat `write_enabled=false`, tombol simpan/ubah status dinonaktifkan dan RPC juga menolak request palsu dari luar UI.
5. `tests/pos-g4-order.test.mjs`, `tests/pos-g4-boundary.test.mjs`, `supabase/tests/pos-g4-orders-rollback.sql` dan Stage 10 CI PostgreSQL 17 menambah regression untuk replay, stale catalog, invalid amount, status kerja, revocation dan bukti tidak ada payment/point entries. Test tidak mengunggah data member nyata ke QA.

## Bukti aktual QA

- Project QA independen: `cwxsbgfjynwxqalwonae`, migrasi bernama `pos_g4_order_creation_staff_attribution` **berhasil diterapkan**. Repository SQL menggunakan tanggal prefix untuk replay CI. Jangan menjalankan dua kali migrasi yang sama pada QA tersebut.
- Tes QA gabungan (migrasi+tes dalam satu transaksi) dan tes setelah apply migration **lulus**. Semua fixture synthetic dibuat di dalam `BEGIN ... ROLLBACK` dan tidak meninggalkan nota/customer/shift/point.
- Seluruh **20/20** tabel `laundry_pos_%` memiliki RLS, tabel finansial tidak diberikan direct select/insert kepada `anon`/`authenticated`. Fungsi elevated berada di `laundry_private` dengan search path kosong dan grants eksplisit. Advisor keamanan `rls_enabled_no_policy` bersifat informasional untuk tabel yang memang *default deny*. Jangan menambahkan permissive policy untuk menyembunyikan warning.
- Pada saat tes QA: 1 outlet MJL, 0 nota dan 0 kasir sesi yang tersisa, 0 pembayaran dan 0 point links. Production Supabase `hncfyfvqtlnvqyfrydzb` belum disentuh.

## Gate yang belum selesai

- **Belum** pengujian fisik owner→kasir→QR scan dengan perangkat Android nyata dan thermal printer; cetak HTML browser bukan bukti kompatibilitas printer 58/80mm.
- Pilihan durasi per layanan saat ini ditampilkan sesuai katalog, belum disahkan konversi otomatis ke ETA. Ongkir, diskon preset/custom dan pemilihan parfum dari daftar tetap memerlukan konfigurasi bisnis dan tes, tidak boleh ditebak. Fitur scan QR kasir dari kartu member lama perlu wrapper aman agar tidak membocorkan akses owner.
- Belum uji race dua koneksi khusus G4 untuk CREATE_ORDER bersamaan; proteksi DB bersumber dari row lock outlet, unique request dan idempotency. Perlu SQL concurrency evidence dan Android UAT sebelum mengaktifkan POS live.
- Belum implementasi G5 payment, DP, refund, receipt cash dan poin otomatis 100%-lunas. FK actor pada tabel pembayaran/ledger G2 tetap belum memakai staff ID; **G5 BLOCKED** sampai bridge actor untuk payment diselesaikan.
- Database produksi **belum** memiliki migrasi G2/G3/G4. Deploy source ke Vercel yang ada bukan izin apply migrasi. `write_enabled` tetap false di QA dan tidak ada flag transaksi produksi yang diaktifkan. Fitur POS yang belum tersedia harus gagal secara aman.

## Aturan CI dan rilis

Satu branch kerja, satu PR gabungan beserta seluruh implementasi, tes dan update plan. Build/test (`npm test`, `npm run typecheck`, `npm run build`, Stage10) wajib hijau sebelum merge. Setelah merge langsung deploy ke existing project Vercel Production `mas` tanpa mengubah koneksi Git ke `unyilhm1-hue/mas` dan periksa SHA+alias. Jangan membuat staging/proyek kedua. Aktivasi POS finansial tetap memerlukan gate tersendiri dan izin owner untuk database produksi.