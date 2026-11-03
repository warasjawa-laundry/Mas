# Receipt — aktivasi POS dummy-only internal, 3 November 2026

**Status:** PILOT_TEST_ONLY_ACTIVE — **G8 NO_GO**. Tidak boleh dianggap cutover keuangan nyata.

## Bukti teknis yang diverifikasi
- Repo: `warasjawa-laundry/Mas`; reviewed code SHA `ae5da9d7d372988ba483209c2532c1858f63d958`.
- CI: [Audit Release Gate](https://github.com/warasjawa-laundry/Mas/actions/runs/41653046151) dan [Stage 10 PostgreSQL Concurrency QA](https://github.com/warasjawa-laundry/Mas/actions/runs/41653046216) **success**.
- Vercel Production: existing project `mas`, deployment `dpl_4it5WrLmQenBArhqFkgjXrzFxJKC`, status READY, alias `masjawalaundry.web.id` memetakan SHA tersebut.
- Production Supabase `hncfyfvqtlnvqyfrydzb`: migrasi `pos_test_only_pilot_guard_20261103_prod` berhasil, trigger `pos_test_only_order_guard` dan `pos_test_point_guard` enabled. QA `cwxsbgfjynwxqalwonae` sudah mendapat guard dan uji rollback.
- Setelah aktivasi: `pilot_test_only=true`, `package_workflow_enabled=true`, `write_enabled=true`, `finance_enabled=true`; 3 paket aktif, 14 keluarga layanan, 31 varian harga, 4 opsi ongkir; kasir aktif 0; nota 0, pembayaran 0, kas 0, point-link POS 0, member 785.
- Uji negatif Production dalam transaksi rollback: insert order memakai `member_id` ditolak `POS_PILOT_GUEST_ONLY`. Member asli tidak dimodifikasi. Data tes order ditandai `is_test_order`; trigger mencegah pengaitan member/poin.
- **Tidak dilakukan:** create order dengan sesi Owner autentik, uang/pembayaran dummy nyata, print perangkat, WA, atau backup/restore real pada aktivasi ini.

## Instruksi uji internal
1. Login Owner di domain utama → Pesanan → Tambah Pesanan. Gunakan **Pelanggan umum** bernama `UJI - Nama Dummy` (bukan identitas pelanggan sebenarnya). Member MJL otomatis dinonaktifkan pada form pilot.
2. Pilih Reguler/Ekspres/Kilat, layanan, kuantitas, parfum dan antar-jemput. Konfirmasi subtotal + ongkir. Klik Buat pesanan dan pastikan nota tersimpan (bukan hanya label UI).
3. Gunakan **uang simulasi**, bukan kas riil, untuk latihan shift, DP/pelunasan/refund; cek status pengerjaan Siap Diambil → Sudah Diambil hanya setelah lunas. Jangan kirim WA ke nomor pelanggan asli.
4. Uji Kasir hanya setelah Owner membuat akun tes, dengan mitigasi kontrol akses. Login ID empat digit tanpa password tetap blocker keamanan menuju live.
5. Kumpulkan UAT pada HP/printer dan bukti review nyata; jangan menandatangani skenario yang belum diuji.

## Batas dan penutupan
G8 preflight masih NO_GO (full backup restore, real Auth Owner/Kasir, keamanan MAS-XXXX, fisik QR/WA/cetak, rekonsiliasi, approval). Simulasi POS tetap tercatat dalam jurnal Production dan harus diidentifikasi dengan `is_test_order`, direkonsiliasi dan diarsipkan/ditangani sebelum rilis Januari 2027. Tidak melakukan DELETE/TRUNCATE langsung. Pada insiden STOP gunakan flags database `write_enabled=false`, `finance_enabled=false` di bawah operator yang berwenang. Sebelum live, buat backup teruji, bersihkan jurnal simulasi secara sah, pertahankan 785 pelanggan dan nomor member, review saldo awal dan persetujuan cutover.
