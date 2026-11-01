# Rekonsiliasi impor Binatu → Mas Jawa Laundry

**Sifat impor: pratinjau dan keputusan identitas, bukan transaksi finansial.** Owner saja yang boleh mengunggah/review. Tidak ada auto-award, backfill, atau pembuatan nota kasir dari laporan historis.

## Format terbukti

Contoh laporan XLSX Binatu yang diterima menunjukkan 23 kolom dengan urutan antara lain: `NOTA`, `TANGGAL MASUK`, `PELANGGAN`, `STATUS`, `PEMBAYARAN`, `HARGA AKHIR`, `BELUM BAYAR`, `SUDAH BAYAR`. Sheet data memiliki baris judul, periode, header dan footer; parser mencari header berlabel, tidak menganggap baris pertama sebagai transaksi. **File asli, nama/telepon/nota asli tidak masuk source maupun tes CI.**

## Proses owner

1. Unggah XLSX atau CSV Binatu ≤1,5 MB, ≤200 nota. Tidak menerima macro, link eksternal, rumus, format tak dikenal, atau workbook multi-sheet. File full dibuang setelah membaca data terpilih; hash SHA256 tersimpan untuk jejak unggahan.
2. Setiap baris dibaca berdasarkan kolom yang terverifikasi, bukan indeks posisi tanpa label. Status `lunas` diperoleh dari kolom **PEMBAYARAN** dan harus konsisten dengan `SUDAH BAYAR = HARGA AKHIR`. Status pekerjaan `antrian/siap ambil` hanya metadata pekerjaan.
3. Batch unik oleh outlet + sumber + hash. Impor ulang file yang sama menampilkan batch lama; nomor nota yang pernah ada ditandai konflik dan tidak ditimpa. Kode nota Binatu ≠ nomor member Mas Jawa ≠ nomor nota POS `MJL-...`.
4. Untuk setiap baris lunas yang masih `PENDING`, owner melihat dialog satu transaksi. Kandidat member berisi nama sama, nomor member Mas Jawa, telepon dan alamat dari tabel existing. Owner memilih identitas atau menyatakan konflik/lewati; tidak otomatis memilih berdasarkan nama.
5. Setelah konfirmasi, UI bergerak ke baris berikutnya. Log batch mencatat jam unggah dan jumlah baris pending. Bila konflik membutuhkan peninjauan ulang, pilih dari daftar konflik. Jangan mengizinkan duplicate source invoice yang sudah cocok di batch berbeda.
6. Tidak membuat transaksi baru, mengubah `laundry_members.id`, saldo poin, history token QR, invoice `MJL-*`, `cash_ledger`, atau `laundry_amount_transactions`. Data histori hanya dipakai dalam rekonsiliasi **read-only** sampai gate G8.

## Piutang pembukaan / migrasi operasional

Sengaja **belum aktif**. Jika pemilik ingin memindahkan piutang lama, dibutuhkan cutoff WIB tunggal, dokumen saldo per nota, tanda tangan owner, mapping unik, bukti nota tidak aktif di kedua sistem, serta migrasi/RPC khusus yang diuji dengan rollback dan rekonsiliasi. Membuat poin ulang dari nota lama dilarang tanpa aturan bisnis terpisah.

## Uji keamanan dan batasan

- RLS semua tabel POS aktif dan tanpa GRANT langsung. RPC importer hanya `authenticated` + pemilik aktif; bukan kasir tanpa password. Kandidat nama/HP/alamat tidak pernah tampil ke kasir atau portal publik.
- Nilai/nota menggunakan validasi ketat (0–Rp1 miliar, nominal IDR bulat, tanpa rumus). Konversi formula Spreadsheet/CSV untuk ekspor memakai escaping agar field `=`, `+`, `-`, `@` tidak dieksekusi saat dibuka.
- Data yang tidak dikenal, footer, dan sel yang tidak konsisten tidak pernah memposting uang/poin. User harus memperbaiki file/menandai konflik secara sadar.
- Batas 200 nota dan satu sheet adalah aturan awal. Untuk file besar/multisheet, buat adapter template baru setelah pengujian, bukan mengendurkan pengamanan diam-diam.