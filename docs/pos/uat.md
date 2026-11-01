# UAT G7 — Mas Jawa Laundry POS (2 Nov 2026)

**STATUS: IN PROGRESS / NO-GO untuk transaksi produksi.** Dokumen ini adalah daftar uji manual, bukan klaim bahwa pemilik/pegawai atau HP Android sudah diuji. Gunakan perangkat milik outlet satu-satunya, data sintetis dan sesi kasir yang telah dipair oleh owner. **Jangan mencatat pembayaran pelanggan nyata sebelum G8 disetujui.**

## Peta 25 referensi Binatu (commit c17b043)
| Screenshot | Fungsi | Posisi di Mas Jawa / status |
|---|---|---|
| 01–02 | Pesanan & menu kasir | `/kasir`, `/kasir/pesanan`: tersedia secara kode; mobile bottom navigation/paritas piksel belum dibuktikan |
| 03 | Pilih pelanggan | Form order: guest/member; nomor member; G7 menambahkan scanner QR. Nama-search belum setara |
| 04 | Pilih durasi bottom sheet | **GAP:** durasi mengikuti layanan, belum ada bottom sheet 3 tingkat Reguler/Ekspres/Kilat |
| 05–11 | Kartu layanan, +/- qty, sticky Lanjut | `/kasir/pesanan/baru` tersedia; G7 memperjelas warna kuning/tombol; belum screenshot-to-screenshot UAT |
| 12–14 | Parfum, antar-jemput, diskon | Parfum/catatan tersedia; **GAP:** antar-jemput/ongkir dan diskon belum terimplementasi |
| 15–17 | Rincian nota, status kerja, siap ambil | `/kasir/pesanan/[id]` tersedia; periksa di HP nyata |
| 18–20 | WA dan bayar | Draf WA salin manual, DP/lunas/refund kode QA; kirim otomatis tidak ada |
| 21–22 | Periode/mutasi kas | `/kasir/kas`, `/kasir/laporan`: kode QA; uji hitung uang fisik dan CSV |
| 23–25 | Manajer/kasir/akun petugas | Login owner/password dan kasir MAS-XXXX pada perangkat dipair; UAT izin/revoke belum dilakukan |

**Kriteria desain:** hierarki, lokasi CTA, tab, sheet, kartu, scrolling dan label seperti referensi; warna/identitas menggunakan Mas Jawa (aksen kuning untuk POS), tanpa logo/aset Binatu. Audit ini *source-based*, **bukan klaim 25/25 visual pass**. Rujukan: [README referensi](https://github.com/warasjawa-laundry/Mas/tree/c17b043d2a2480adbe0bcd05d39d961c398db603/docs/references/binatu).

## Pemeriksaan fisik wajib (belum ditandatangani)
| No | Skenario | Expected | Bukti / penanggung jawab |
|---|---|---|---|
| 1 | Android Chrome, keyboard angka/desimal, layar kecil & rotation | Tombol +/- 44px, sticky total tidak menutup input | Pending owner/staff |
| 2 | Login owner→pair perangkat→MAS-0001; revoke di tengah sesi | Kasir cabut/revoke ditolak pada RPC baru | Pending |
| 3 | Kamera QR aktif, kamera ditolak, screenshot dari galeri, URL QR palsu | Kartu valid memilih nomor; invalid/revoked gagal; tidak ada poin | Pending |
| 4 | Member sama nama, nomor member dan poin saat lunas | Identitas tidak otomatis ditebak; ADD sekali | Pending |
| 5 | DP, lunas, dua pembayaran bersamaan, jaringan putus setelah commit | Retry UUID sama; tak ada receipt/poin ganda | Pending fisik; race CI terpisah |
| 6 | Cash masuk/keluar, selisih tutup shift, beda metode | Kas tunai tidak termasuk noncash, selisih butuh alasan | Pending kasir + owner |
| 7 | XLSX asli 200 nota, duplikat, review lunas per baris | Identity manual, nota unik, tidak memposting poin | Pending owner |
| 8 | WhatsApp draf & consent, cetak HTML nota | Tidak auto-send; tidak mengungkap QR/token | Pending |
| 9 | Legacy owner scan, kartu, portal /k/[token], promo & history | Semua modul lama tetap berfungsi | Pending |
| 10 | Side-by-side 25 screenshot pada viewport yang sama | Owner tanda tangan setiap penyimpangan yang disetujui | Pending |

### Klasifikasi gate
- **Terverifikasi otomatis:** struktur SQL/ACL RLS, parser, regresi historis, build, dan tes race dua sesi CI (hanya bila job CI hijau).
- **Tidak terverifikasi:** kamera/QR fisik, perangkat Android nyata, terminal printer, uang tunai fisik, penilaian visual owner, portal live seusai posting, dan rekonsiliasi Binatu asli.
- Semua P0/P1, selisih rupiah, salah member atau poin ganda memblokir G8.


## Instruksi uji tambahan — wizard G7 durasi/member

- Bandingkan screenshot 03–04 dan 05–14: member nama sama harus bisa dipilih manual berdasarkan **nomor**, pencarian min 3 karakter, QR tidak membuat ADD. Pilih durasi satu per satu: daftar layanan/total harus menunjukkan harga katalog sebenarnya, tidak boleh ada pilihan layanan tersembunyi yang masih dihitung setelah ganti durasi.
- Tekan Escape dan Tab/Shift+Tab pada bottom sheet durasi memakai keyboard, tutup sheet harus mengembalikan fokus ke tombol pembuka. Periksa zoom 200% dan 320px HP.
- Bandingkan parfum preset/kustom; pastikan semua opsi harga non-layanan (ongkir/diskon) **tidak mempengaruhi total** dan tidak dikirim ke RPC G4 sebelum disahkan owner.
- Saat QA database belum terpasang, lihat pesan kesalahan yang jelas, tidak menyimpan transaksi diam-diam. Semua skenario ini **belum ditandatangani oleh kasir/owner nyata**.
