# IMPLEMENTATION PLAN — POS LAYANAN, DURASI, NOTA & WHATSAPP MASJAWA LAUNDRY

**Versi:** 1.1  
**Status:** PLANNED — NOT STARTED  
**Prioritas:** Setelah pekerjaan G0–G8 yang sedang berjalan stabil  
**Scope:** Katalog layanan, paket durasi, pembuatan pesanan, nota, pembayaran, poin member, WhatsApp, dan pengambilan.

---

## 1. Tujuan

Membuat sistem transaksi MasJawa Laundry dengan alur utama:

**Login → Pelanggan → Durasi → Layanan → Konfirmasi → Buat Nota → WhatsApp → Proses Cucian → Siap Diambil → Pelunasan → Sudah Diambil**

Prinsip utama:

- Satu nota menggunakan satu paket durasi: Reguler, Ekspres, atau Kilat.
- Layanan dan harga yang tampil mengikuti paket yang dipilih.
- Owner mengelola layanan, harga, dan durasi melalui satu menu.
- Nota memiliki nomor unik dan menyimpan rincian transaksi historis.
- WhatsApp menampilkan informasi nota, pembayaran, dan poin.
- Pembayaran dan status pengerjaan merupakan dua status terpisah.
- **Cucian hanya boleh diserahkan setelah pembayaran lunas.**
- Poin member diberikan satu kali saat pembayaran lunas, sesuai aturan database.
- Semua tindakan keuangan tetap mengikuti gate G8.

## 2. Pengaturan layanan oleh Owner

Lokasi:

**Menu Owner → Pengaturan → Layanan & Harga**

### 2.1 Pengaturan paket durasi

| Paket | Durasi awal usulan |
|---|---|
| Reguler | 72 jam |
| Ekspres | 24 jam |
| Kilat | 6 jam |

Durasi dapat diubah Owner. Perubahan berlaku bagi nota baru, tanpa mengubah estimasi historis.

Sebelum menghitung waktu selesai secara otomatis, tentukan apakah durasi menggunakan jam kalender atau jam operasional, termasuk kebijakan hari libur.

### 2.2 Daftar layanan dan tarif

Satu layanan utama dapat memiliki beberapa paket.

| Layanan | Reguler | Ekspres | Kilat |
|---|---:|---:|---:|
| Cuci Setrika | Rp5.000 | Rp7.000 | Rp10.000 |
| Cuci Lipat | Rp3.000 | Rp5.000 | Rp7.000 |
| Bed Cover Double | Rp20.000 | Rp25.000 | Nonaktif |
| Boneka Besar | Rp20.000 | Nonaktif | Nonaktif |

Tarif merupakan contoh dari screenshot Binatu, bukan harga resmi MasJawa yang sudah diterapkan.

### 2.3 Form tambah/edit layanan

Owner dapat mengelola:

- Nama dan kategori layanan.
- Satuan: kg, pcs, meter, dan satuan valid lainnya.
- Ketersediaan Reguler/Ekspres/Kilat.
- Harga setiap paket.
- Status aktif/nonaktif.
- Urutan tampilan.

Tidak membuat layanan utama tiga kali untuk tiga paket.

Setiap kombinasi layanan dan paket harus mempunyai identitas dan revisi tarif yang dapat ditelusuri.

---

## 3. Flow pembuatan pesanan

### Tahap 0 — Login

**Owner:** ID dan password.

**Kasir:** ID `MAS-XXXX` sesuai hak akses.

Owner dan Kasir menggunakan antarmuka POS yang sama, tetapi setiap transaksi mencatat aktor sebenarnya. Owner tidak boleh dialihkan ke login Kasir.

### Tahap 1 — Pelanggan

Tampilkan:

- Pelanggan umum.
- Member MJL.
- Pencarian nama/nomor member.
- Scan QR/barcode.
- Identitas pelanggan sesuai izin.
- Nomor HP dan alamat untuk nota, apabila tersedia dan telah diverifikasi.

Pemindaian kartu tidak boleh otomatis memberikan poin.

### Tahap 2 — Durasi

Pilihan:

- Reguler.
- Ekspres.
- Kilat.

Ambil durasi dan status paket dari database.

Setelah memilih paket, aplikasi memfilter layanan sesuai pilihan tersebut.

### Tahap 3 — Layanan

Tampilkan nama layanan, kategori, harga paket terpilih, satuan, dan kontrol kuantitas.

Kasir dapat memilih beberapa layanan dalam paket durasi yang sama.

Jika mengganti paket, aplikasi memperingatkan bahwa pilihan layanan dan tarif perlu diperiksa kembali. Jangan menghapus pilihan tanpa konfirmasi.

### Tahap 4 — Konfirmasi

Tampilkan:

- Identitas pelanggan.
- Paket dan durasi.
- Waktu masuk dan estimasi selesai.
- Rincian layanan dan kuantitas.
- Harga satuan dan subtotal.
- Parfum serta catatan cucian.
- Biaya tambahan/diskon jika sudah didukung secara sah.
- Total tagihan.
- Informasi pembayaran awal.
- Informasi poin member.

Periksa ulang seluruh harga, paket, kuantitas, dan identitas pada backend sebelum membuat nota.

### Tahap 5 — Buat Nota

Setelah menekan **Buat Pesanan**, backend harus menyimpan secara atomik:

1. Nomor nota unik.
2. Identitas pelanggan.
3. Identitas pembuat nota.
4. Paket dan durasi snapshot.
5. Tanggal masuk dan estimasi selesai.
6. Layanan, kuantitas, harga, dan total snapshot.
7. Parfum dan catatan.
8. Status pengerjaan awal: Antrian.
9. Status pembayaran aktual.
10. Request ID untuk mencegah nota ganda.

Nota baru dianggap berhasil setelah database mengonfirmasi penyimpanan.

---

## 4. Pembayaran awal dan WhatsApp nota baru

Setelah nota disimpan, pengguna dapat mencatat pembayaran awal jika fitur keuangan telah aktif secara sah.

Pilihan:

| Pembayaran awal | Status |
|---|---|
| Bayar seluruh tagihan | Lunas |
| Bayar sebagian | DP |
| Belum membayar | Belum Bayar |

Sesudah pembayaran awal selesai diproses atau dilewati, sistem membaca kembali status nota dan menyiapkan WhatsApp.

**Flow:**

Buat Nota → Pembayaran Awal (opsional) → Perbarui Data Nota → Buka WhatsApp → Kasir menekan Kirim.

Jika pembayaran dicatat saat nota dibuat, poin baru hanya boleh muncul sebagai poin aktif apabila pelunasan benar-benar berhasil dan poin sudah dibukukan.

### 4.1 Format WhatsApp nota awal

Pertahankan format yang diberikan Owner, dengan nilai dinamis dari database.

Contoh struktur:

**MAS JAWA LAUNDRY KRAKSAAN**

Alamat dan nomor kontak outlet

{nomor_nota}

Pelanggan : {nama}  
No Handphone : {nomor_hp}  
Alamat : {alamat}  
Kasir : {nama_kasir}  
Layanan : {paket} ({durasi})  
Masuk : {tanggal_masuk}  
Est Selesai : {estimasi_selesai}

----------------------------------------

**LAYANAN**

{daftar_layanan_dengan_jumlah_harga_subtotal}

----------------------------------------

Parfum : {parfum}

----------------------------------------

Total Layanan : {total_layanan}

----------------------------------------

**PEMBAYARAN**

Total : {total_tagihan}  
Sudah Dibayar : {total_dibayar}  
Sisa Tagihan : {sisa_tagihan}  
Status : {status_pembayaran}

----------------------------------------

**POIN MEMBER**

{informasi_poin_sesuai_status}

----------------------------------------

Ketentuan komplain, tanggung jawab laundry, pemberitahuan pembayaran di awal, rekening Mandiri, e-wallet, dan kontak CS mengikuti template asli Owner yang dapat diperbarui dari pengaturan.

Untuk pelanggan umum, blok poin tidak ditampilkan.

Untuk member yang belum lunas, saldo aktif tidak boleh mencakup poin yang masih menunggu pembayaran.

### 4.2 Pengiriman WhatsApp

Gunakan nomor tujuan yang valid dan telah diverifikasi.

Buka WhatsApp dengan pesan yang sudah terisi melalui mekanisme URL WhatsApp yang didukung.

Kasir tetap menekan **Kirim** secara manual.

Jika nomor tidak tersedia atau WhatsApp gagal dibuka, nota tetap tersimpan dan draf dapat disalin.

Status membuka WhatsApp tidak boleh dianggap sebagai bukti pesan terkirim.

---

## 5. Status operasional cucian

Status pengerjaan dan status pembayaran dikelola terpisah.

### 5.1 Status cucian

| Status | Keterangan |
|---|---|
| Antrian | Nota sudah dibuat |
| Diproses | Cucian sedang dikerjakan |
| Siap Diambil | Cucian selesai, menunggu pengambilan |
| Sudah Diambil | Cucian telah diserahkan secara sah |

Perubahan status mencatat waktu, identitas petugas, dan histori.

### 5.2 Status pembayaran

| Status | Kondisi |
|---|---|
| Belum Bayar | Belum ada pembayaran sah |
| DP | Sebagian tagihan sudah dibayar |
| Lunas | Seluruh tagihan telah dibayar |
| Refund | Pengembalian dana tercatat melalui prosedur yang sah |

Pembayaran tidak boleh diasumsikan berhasil hanya karena tombol ditekan. Keberhasilan harus berasal dari transaksi database.

---

## 6. WhatsApp ketika cucian Siap Diambil

Saat status berubah menjadi **Siap Diambil**, sistem harus mengambil kembali:

- Total tagihan.
- Total pembayaran yang sah.
- Sisa pembayaran.
- Status pembayaran.
- Poin transaksi.
- Saldo poin aktif member.
- Perkiraan poin setelah pelunasan, jika valid.

Jangan menggunakan snapshot pembayaran lama dari saat nota pertama dibuat.

### 6.1 Format pesan Siap Diambil

**MAS JAWA LAUNDRY KRAKSAAN**

**PEMBERITAHUAN CUCIAN SIAP DIAMBIL**

No Nota : {nomor_nota}  
Pelanggan : {nama_pelanggan}  
Layanan : {paket} ({durasi})  
Masuk : {tanggal_masuk}  
Selesai : {tanggal_selesai}

----------------------------------------

**STATUS CUCIAN : SIAP DIAMBIL**

----------------------------------------

**RINCIAN PEMBAYARAN**

Total Tagihan : {total_tagihan}  
Sudah Dibayar : {jumlah_dibayar}  
Sisa Tagihan : {sisa_tagihan}  
Status : {status_pembayaran}

----------------------------------------

**POIN MEMBER**

{informasi_poin}

----------------------------------------

Halo Kak {nama_pelanggan},

Cucian Kakak sudah selesai dan siap diambil di Mas Jawa Laundry Kraksaan.

{informasi_pelunasan}

**Pengambilan hanya dapat dilakukan setelah pembayaran lunas.**

Terima kasih telah mempercayakan cucian kepada kami.

Untuk keluhan dan informasi:  
{kontak_cs}

### 6.2 Pesan pembayaran dinamis

**Jika Lunas:**

Total Tagihan : Rp19.600  
Sudah Dibayar : Rp19.600  
Sisa Tagihan : Rp0  
Status : LUNAS

Pembayaran sudah lunas. Cucian dapat diambil.

**Jika DP Rp10.000:**

Total Tagihan : Rp19.600  
Sudah Dibayar : Rp10.000  
Sisa Tagihan : Rp9.600  
Status : DP / BELUM LUNAS

Mohon melunasi Rp9.600 sebelum cucian diserahkan.

**Jika Belum Bayar:**

Total Tagihan : Rp19.600  
Sudah Dibayar : Rp0  
Sisa Tagihan : Rp19.600  
Status : BELUM BAYAR

Mohon melakukan pembayaran Rp19.600 sebelum cucian diserahkan.

Nominal tersebut hanya contoh.

---

## 7. Aturan poin member

Gunakan aturan poin yang sah pada database MasJawa dan periode program yang berlaku.

### 7.1 Poin baru diberikan setelah lunas

- Pembayaran awal lunas: poin dapat ditambahkan setelah pelunasan berhasil.
- Pembayaran DP: belum ada poin transaksi yang dibukukan.
- Belum Bayar: belum ada poin transaksi yang dibukukan.
- Pelunasan DP: poin ditambahkan satu kali setelah seluruh tagihan dibayar.
- Refund/VOID: poin disesuaikan menggunakan mekanisme pembatalan yang dapat diaudit.

Tidak boleh ada poin duplikat akibat retry, impor Binatu, atau pembayaran berulang.

### 7.2 Poin dalam WhatsApp

Contoh: saldo aktif sebelumnya 8 poin, transaksi memperoleh 1 poin.

**Lunas:**

Poin Transaksi : +1 poin  
Total Poin Aktif : 9 poin

**DP:**

Poin Transaksi : 1 poin (menunggu pelunasan)  
Total Poin Aktif : 8 poin  
Perkiraan Total Setelah Lunas : 9 poin

**Belum Bayar:**

Poin Transaksi : 1 poin (menunggu pelunasan)  
Total Poin Aktif : 8 poin  
Perkiraan Total Setelah Lunas : 9 poin

Perkiraan poin hanya ditampilkan jika aturan poin yang berlaku memungkinkan perhitungan yang dapat dipertanggungjawabkan.

Saldo aktif harus berasal dari ledger/database. Periode poin tahunan tidak boleh digabung tanpa aturan yang sah.

**Khusus nota awal yang langsung lunas:** total poin yang ditampilkan harus sudah memasukkan poin transaksi tersebut setelah posting berhasil.

---

## 8. Proses pengambilan cucian

### 8.1 Ketika pelanggan datang

Kasir membuka nota yang berstatus **Siap Diambil**.

Sistem menampilkan:

- Nomor nota.
- Nama pelanggan.
- Status cucian.
- Total tagihan.
- Sudah dibayar.
- Sisa tagihan.
- Status pembayaran.
- Poin member.
- Tombol pembayaran atau pengambilan sesuai izin.

### 8.2 Jika belum lunas

Tombol **Sudah Diambil** tidak boleh mengeksekusi serah terima.

Kasir mencatat pelunasan terlebih dahulu.

Setelah transaksi pembayaran berhasil, backend menghitung ulang sisa tagihan dan memperbarui poin member jika memenuhi ketentuan.

### 8.3 Jika sudah lunas

Kasir dapat menekan **Sudah Diambil**.

Backend tetap wajib memeriksa ulang:

- Nota benar dan masih Siap Diambil.
- Sisa tagihan Rp0.
- Tidak ada kondisi refund atau sengketa yang memblokir penyerahan.
- Petugas memiliki izin.
- Pesanan belum pernah ditandai Sudah Diambil.

Jika valid, simpan waktu pengambilan dan identitas petugas secara atomik.

**Tidak ada pengecualian serah terima sebelum lunas dalam scope rencana ini.**

Untuk kasus tagihan nol, refund, atau penyesuaian khusus, perlu aturan eksplisit sebelum sistem mengizinkan penyerahan.

---

## 9. WhatsApp setelah Sudah Diambil

Pesan ini bersifat **opsional**, untuk menghindari terlalu banyak WhatsApp.

Contoh:

**MAS JAWA LAUNDRY KRAKSAAN**

**KONFIRMASI PENGAMBILAN PESANAN**

No Nota : {nomor_nota}  
Pelanggan : {nama_pelanggan}  
Layanan : {paket}

----------------------------------------

**STATUS : SUDAH DIAMBIL**

Tanggal Pengambilan : {tanggal_pengambilan}  
Petugas : {nama_kasir}

**PEMBAYARAN**

Total : {total_tagihan}  
Total Dibayar : {total_dibayar}  
Status : LUNAS

**POIN MEMBER**

Poin Transaksi : {poin_transaksi_aktual}  
Total Poin Aktif : {total_poin_aktual}

Terima kasih telah menggunakan jasa Mas Jawa Laundry.

Untuk pelanggan umum, hilangkan bagian poin.

Gunakan data terbaru dari database, bukan angka contoh.

---

## 10. Detail nota dan histori

Satu nomor nota digunakan sepanjang siklus transaksi.

Nota harus tetap dapat dilihat dan dicetak setelah berstatus Sudah Diambil.

Simpan histori:

- Tanggal dan petugas pembuat nota.
- Paket dan durasi snapshot.
- Estimasi selesai.
- Waktu selesai sebenarnya.
- Waktu pengambilan.
- Histori perubahan status.
- Rincian pembayaran, DP, pelunasan, dan refund.
- Riwayat poin transaksi.
- Versi template WhatsApp bila diperlukan untuk audit.

Jangan menghapus nota setelah pesanan selesai.

---

## 11. Pengaturan template WhatsApp Owner

Tempatkan pengaturan template dalam pengaturan Owner, tanpa membuat dashboard visual lain.

Sediakan informasi outlet dan template untuk:

1. Nota Baru.
2. Siap Diambil.
3. Sudah Diambil.

Pertahankan teks dan urutan informasi contoh asli Owner, termasuk ketentuan komplain, pemberitahuan pembayaran di awal, rekening, e-wallet, serta kontak CS.

Bagian identitas dan rekening menjadi konfigurasi Owner yang terotorisasi, bukan data dari input kasir.

Pastikan template tidak membocorkan token QR, rahasia sistem, atau informasi pelanggan lain.

---

## 12. Tahapan implementasi

| Fase | Pekerjaan | Hasil |
|---|---|---|
| F1 | Audit katalog dan schema POS | Pemetaan layanan dan paket tanpa merusak data lama |
| F2 | Pengaturan paket Reguler/Ekspres/Kilat | Durasi global paket dan tarif per layanan |
| F3 | UI Owner Layanan & Harga | Pengeditan dalam satu menu |
| F4 | Wizard empat tahap | Pelanggan → Durasi → Layanan → Konfirmasi |
| F5 | Pembuatan nota | Nomor unik, snapshot, estimasi, audit |
| F6 | Pembayaran dan poin | DP, pelunasan, posting poin idempotent |
| F7 | WhatsApp Nota Baru | Template lengkap dan draf WhatsApp |
| F8 | Status operasional | Antrian → Diproses → Siap Diambil |
| F9 | WhatsApp Siap Diambil | Pembayaran, sisa tagihan, dan poin dinamis |
| F10 | Serah terima | Validasi lunas di backend dan histori pengambilan |
| F11 | WhatsApp Sudah Diambil | Pesan konfirmasi opsional |
| F12 | QA dan UAT | Pengujian transaksi dan alur perangkat fisik |
| F13 | Integrasi dokumentasi | Sinkronisasi dengan pekerjaan G0–G8 setelah stabil |

---

## 13. Acceptance criteria wajib

Sistem baru dinyatakan selesai secara teknis jika:

- Owner dapat mengelola paket, durasi, layanan, dan harga.
- Kasir hanya melihat layanan tersedia pada paket terpilih.
- Harga dan total selalu sesuai database.
- Nota memiliki nomor unik dan snapshot historis.
- Nota tidak dibuat ganda akibat retry.
- WhatsApp Nota Baru menggunakan format Owner dan data aktual.
- WhatsApp Siap Diambil menampilkan status Lunas, DP, atau Belum Bayar.
- Sisa tagihan benar untuk setiap kondisi pembayaran.
- Poin pada WhatsApp mencerminkan ledger aktual.
- Poin transaksi yang belum lunas tidak ditampilkan sebagai saldo aktif.
- Setelah pelunasan, total poin aktif mencakup poin yang sudah berhasil dibukukan.
- Pelanggan umum tidak mendapat informasi poin member.
- Poin tidak digandakan melalui pembayaran atau impor.
- Serah terima ditolak oleh backend jika belum lunas.
- Pesanan Sudah Diambil tetap memiliki histori lengkap.
- Semua perubahan status mencatat identitas petugas.
- Draf WhatsApp tidak dianggap berhasil terkirim secara otomatis.
- UI tetap mengikuti Argon MasJawa.
- Pengujian perangkat, database QA, dan regresi berhasil.
- Aktivasi transaksi Production tetap melalui G8 GO yang disetujui secara terpisah.

---

## 14. Isolasi dari pekerjaan G0–G8

Ini adalah rencana pengembangan terpisah dan **belum dieksekusi**.

Jangan menggabungkan implementasinya dengan pekerjaan Codex G0–G8 yang sedang berjalan tanpa mengaudit kembali kondisi terbaru repository.

Jangan menggunakan atau me-merge PR #30.

Jangan mengubah database Production atau mengaktifkan transaksi keuangan hanya berdasarkan persetujuan rencana ini.

Setelah pekerjaan G0–G8 stabil, periksa kembali `main`, tentukan bagian yang sudah tersedia, dan implementasikan hanya pekerjaan yang belum selesai.

**STATUS AKHIR: PLANNED — NOT STARTED.**