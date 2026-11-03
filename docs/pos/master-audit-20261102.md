# Master audit POS G0–G8 — 2 November 2026

> **Checkpoint terkini sebelum final CI (2 Nov 2026): PROVISIONAL / G8 NO-GO.** Root mengonfirmasi ketiga migrasi canonical telah diterapkan **QA saja**: `20261102190000_pos_owner_creation_duration_snapshots.sql`, `20261102193000_pos_owner_operations_shared_cores.sql`, `20261102210000_pos_import_review_audit.sql`. Fixture owner duration, owner operations, import audit dan regresi existing G5/G6/G2 PASS setelah apply. `write_enabled=false` dan `finance_enabled=false`. Lima browser test wizard sintetis PASS pada 320/390/1440px memakai mocks; ini bukan real Auth atau PHYSICAL_UAT. Synthetic restore dan race tambahan menunggu CI yang akan datang, **belum PASS**. Final tree/CI dan deployment paket baru belum disertifikasi. Produksi tetap 0 tabel POS; tidak ada mutasi produksi. Lihat [master audit](./master-audit-20261102.md) untuk dependensi dan bukti penutupan.

**Status keseluruhan: PARTIAL; G8 NO-GO / BLOCKED.** Dokumen ini mengonsolidasikan audit baseline `main` `0fe995db640de6249bd9389fe674a6853ab4d5bd` dan paket perubahan lokal yang sedang diuji. **PROVISIONAL: final validation, final diff review, CI dan SHA hasil merge belum selesai.** PASS checkpoint tidak menjadi PASS untuk tree akhir. Tidak ada izin migrasi produksi, perubahan Auth produksi, aktivasi transaksi, posting impor, atau cutover dari dokumen ini.

## Cara membaca bukti dan prioritas

`IMPLEMENTED_QA` berarti jalur kode/SQL ada dan bukti sintetis tersedia, bukan operasional live. `PARTIAL` berarti ada lingkup atau acceptance terbuka. `BLOCKED` memerlukan bukti/keputusan eksternal. `PHYSICAL_UAT_REQUIRED` tidak dapat ditutup oleh source assertion, emulasi browser atau tes SQL. Hanya root task yang menggabungkan bukti akhir boleh mengubah status provisional setelah memeriksa hasil nyata.

P0 memblokir keselamatan release; P1 memblokir alur inti/rekonsiliasi; P2 mengoreksi kontrol, ketahanan dan kelengkapan. Dependensi berurutan: G0 identitas/baseline → G1 isolasi/restore → G2 kontrak/ACL → G3 identitas/izin → G4 order/snapshot → G5 uang/poin → G6 kas/laporan dan G6b histori → G7 integrasi/UAT → G8 approval/migrasi/pilot. G6b tidak boleh menjadi jalan pintas ke ledger live.

## Bukti pada checkpoint ini

- Root memverifikasi source main `0fe995d`, Vercel Production existing `mas` READY, SHA sama dan domain benar. Git connection `unyilhm1-hue/mas` dipertahankan. Bukti ini hanya berlaku baseline tersebut, bukan perubahan lokal yang belum merge/deploy.
- Root memverifikasi proyek produksi dan QA ACTIVE_HEALTHY. Produksi: 785 member, 18 kartu, 21 event, 19 amount snapshots dan **0 tabel POS**. QA: 20 tabel POS publik RLS, tanpa direct write role aplikasi dan tanpa data legacy pelanggan. Tabel audit private tambahan harus diinventarisasi terpisah; angka 20 bukan jumlah semua objek database.
- Sembilan regresi POS QA existing dilaporkan PASS. Migrasi `20261102190000_pos_owner_creation_duration_snapshots.sql` diterapkan **QA saja** sebagai `pos_owner_creation_duration_snapshots`; fixture baru beserta G4/G5/G6 dan katalog dilaporkan PASS. Checkpoint Node 268 PASS; baseline Playwright 78 PASS dan build PASS. Perubahan setelah checkpoint **FINAL_VALIDATION_PENDING**; tidak ada klaim CI final.
- Migrasi lokal `20261102193000_pos_owner_operations_shared_cores.sql` menambahkan owner operations/shared core dan `finance_enabled=false`; telah diterapkan QA; fixture owner ops PASS. Filename canonical aktual 20261102193000 menjadi acuan, bukan nama rencana 20261102200000. Final CI pending.
- `20261102210000_pos_import_review_audit.sql` dan fixture audit impor: dry-run dilaporkan PASS; telah diterapkan QA; fixture import audit PASS. Final CI pending. Tidak diterapkan ke produksi.

## Matriks gate saat ini

| Gate | Lingkup dan jalur nyata | Kriteria yang sudah didukung bukti | Pekerjaan/bukti untuk menutup | Dependensi dan status |
| --- | --- | --- | --- | --- |
| G0 | Repo/SHA/domain/proyek, baseline schema/ledger, inventaris UI dan dokumen keputusan | Baseline root di atas; `baseline.md`, `evidence-manifest.md`, keputusan D01–D11 | Pin tree final dan deployed SHA setelah merge; snapshot konsisten final beserta migration/function/grant hashes; rekonsiliasi perubahan bisnis sah; bukti privat tersedia untuk reviewer | Pangkal semua gate. PARTIAL; baseline terverifikasi, release final pending |
| G1 | `lib/supabase/qa-preview-isolation.ts`, registry key/origin dan key kartu QA; runner SQL sintetis | Guard fail-closed dan proyek QA terpisah; tidak memakai pelanggan produksi | Restore rehearsal nyata, scope credential negatif dan QA auth/card roundtrip; bukti bahwa runner tidak menyentuh produksi; prosedur UAT aman tanpa website staging | G0. PARTIAL; restore BLOCKED. Preview N/A atas keputusan owner |
| G2 | Skema G2/G3/G5, RLS/grants, FK/XOR actor, append-only journals, counter tunggal | 20 tabel POS publik RLS; direct writes ditolak; staff bukan owner/Auth palsu; jurnal uang/point/command dilindungi | Inventaris objek private baru, ACL PUBLIC/anon/authenticated/service role; negative authenticated roles; lock graph termasuk legacy dan katalog; migration-history reconciliation; restore/rollback DDL | G0/G1. IMPLEMENTED_QA / PARTIAL; migrasi produksi BLOCKED |
| G3 | `/admin/login` Owner ID+password dan Karyawan MAS-XXXX; `/kasir`; owner cashier CRUD/revoke; dua cookie/token | ID unik berurutan non-recycle, status/izin dicek DB, TTL max 12 jam, throttle global, sesi dicabut | Real Auth owner+kasir; revoke saat aksi, expiry/two-tab/refresh; review known-ID impersonation dan DoS throttle; owner menerima kontrol identitas sebelum finance | G2. PARTIAL / PHYSICAL_UAT_REQUIRED; identity-risk approval BLOCKED |
| G4 | Wizard bersama Pelanggan→Layanan→Konfirmasi, katalog existing, nama/nomor/QR/barcode, order board/detail; owner create baru | Harga/qty/revisi dihitung server integer; unique UUID/counter; owner/staff XOR; mixed duration snapshots dan ETA known-only QA; tidak backfill histori | Recovery unknown commit melewati reload/re-auth, same-UUID owner race, catalog/member deactivation interleaving; ETA policy owner; cancellation command, adjustment/ongkir/diskon dengan kontrak izin bila masuk pilot | G2/G3. IMPLEMENTED_QA / PARTIAL; owner UI final validation pending |
| G5 | DP/pelunasan, receipt+cash+legacy ADD/amount/link atomik, full refund/VOID; owner finance/shared core lokal | G5 rollback dan existing 2-connection payment race; missing rule/inactive member/fraction/overpay/guest/zero diuji; finance switch baru default OFF | QA shared core dan actor owner/staff; two-session payment-vs-close/refund/legacy VOID/rule/year boundary; receipt/change/evidence semantics; fault injection tiap write; point timestamp parity; network-loss UAT | G2–G4 dan identity review. PARTIAL; FINANCE BLOCKED, PHYSICAL_UAT_REQUIRED |
| G6 | `/kasir/kas`, `/kasir/laporan`, CSV dan draft WA; owner operations lokal | Kas cash terpisah noncash, counted/discrepancy reason, journal append-only, export >300 ditolak, formula escaping; SQL rollback | Final shared core QA; opening cash policy, shift ownership/handover; unknown cash retry/re-auth; payment-close race; laporan occurrence clock/program year/cancellation as-of; owner endpoints+UI wiring penuh; physical count/WA consent/print | G5. PARTIAL / PHYSICAL_UAT_REQUIRED |
| G6b | `/admin/pos/import`, bounded XLSX/CSV, owner per-row paid review, hash/invoice conflict, audit private baru | No posting orders/payments/points; owner identity manual; 200 rows/1.5MB; parser batas aktif; cancellation/footer hardening lokal dan audit dry-run | Audit QA applied; final negative ACL/parser tests; section-aware footer/cancel variants; real Binatu owner reconciliation; identitas member ganda; revision/retry audit; opening receivable batch disetujui terpisah | G1/G2 dan G0 file evidence. PARTIAL; historical posting DISABLED |
| G7 | Shell Argon/Binatu dan navigasi role, 25 screenshot, scan kontekstual, keyboard/mobile/print | Baseline Playwright 78 dan source/parser/race tests; final wizard tests sedang dikerjakan | 320/360/390/768/1024/1440, zoom200%, keyboard/focus/contrast; Android real camera/gallery permission/revoke; owner+cashier full lifecycle; 25-screen signoff; network unknown, printer dan kas fisik | G3–G6b. PARTIAL / PHYSICAL_UAT_REQUIRED |
| G8 | Preflight pinned SHA/evidence, cutover/rollback/monitoring, restore dan owner approval | Receipt default NO_GO; checker fail-closed diperketat lokal, belum bukti readiness | Fresh SHA-bound independently reviewed evidence, actual restore, reconciled saldo/piutang/poin, real auth/hardware, owner identity/ETA/visual/cutover approval, full production migration approval lalu pilot monitoring | Semua gate. BLOCKED / NO-GO; tidak ada production POS schema |

## Temuan audit dan status koreksi

Temuan berikut berasal dari source baseline dan bukan klaim bahwa tree lokal saat ini masih memiliki bug yang sama. Root sedang memperbaikinya; status baru hanya ditutup dengan behavioral evidence pada final tree.

| ID / prioritas | Baseline masalah dan dampak | Perubahan aman / status sekarang | Bukti penutupan yang wajib |
| --- | --- | --- | --- |
| A01 P1 | Cash action membuang UUID/payload pada UNKNOWN lalu render UUID baru; risiko kas IN/OUT ganda | Local action sekarang mempertahankan form/error; root mengerjakan recovery. PROVISIONAL | Putus respons setelah/belum commit, identical UUID+payload retry, reload/re-auth, maksimal satu cash ledger; hasil bisa ditemukan tanpa menebak jurnal |
| A02 P1 | Create order membuang draft/UUID pada error; risiko nota kedua dan kehilangan input | Owner/cashier return recoverable state; root wizard recovery lokal. PROVISIONAL | Lost response, stale catalog, invalid qty, Back/Next, refresh/re-auth; satu invoice per request dan isian tetap benar |
| A03 P2 | Refund retry menyimpan UUID/version tetapi menghilangkan reason yang masuk digest | Root recovery form lokal. PROVISIONAL | Exact reason/payload retained dan immutable selama UNKNOWN, same UUID replay; changed payload conflict ditampilkan definitif |
| A04 P2 | Parser mengabaikan footer dan cancelled PAID menjadi LAINNYA yang bisa MATCHED | Parser lokal menandai cancellation UNKNOWN dan memeriksa footer; SQL guard/audit baru applied QA; fixture PASS, final CI pending | Footer salah ditolak; multiple sections/subtotals tidak ditafsirkan global keliru; cancelled/unknown tak MATCHED; legacy invalid row bisa dikarantina; tanpa receipt/point |
| A05 P2 | receipt_print grant diabaikan oleh PrintButton unconditional | Root permission guard lokal. PROVISIONAL | Permission false tidak menawarkan print action/receipt route; true berfungsi; akui browser dapat mencetak konten yang sudah terlihat |
| A06 P2 | Link.created_at berbeda dari timestamp receipt/ADD saat menunggu rule lock; laporan berpindah periode | Backend ops agent menangani canonical timestamp. FINAL_VALIDATION_PENDING | Cross-WIB-midnight two-session rule lock; receipt, amount, ADD/link dan report sama occurrence time/year, termasuk refund tahun berikut |

Prioritas P0 release: jangan menyalakan `write_enabled`/`finance_enabled`, menerapkan produksi atau mengklaim G8 GO sebelum approval dan bukti eksternal. Tidak ditemukan P0 exploit terkonfirmasi dari audit read-only baseline; ketiadaan P0 bukan sertifikasi keamanan.

## Review migrasi baru

### Owner create dan duration snapshots

Core private tidak dapat dipanggil role aplikasi; wrapper owner memanggil active owner check; cashier memeriksa order_create dan member_lookup bila memilih member. Outlet lock mendahului service share locks; counter dan replay recheck serial. Actor owner dan staff dipertahankan XOR. Snapshot item baru tidak berubah akibat edit katalog; histori lama tidak diisi ETA rekaan. Unknown/range duration menghasilkan PENDING/null; known elapsed minutes memakai max per-item pada order. Fixture QA memeriksa stale catalog, flag-off replay, cross-actor denial, actor XOR, snapshot dan invoice melewati enam digit.

Review lanjutan: ACL negatif, cross-actor lookup dan recovery berdasarkan izin operasi diuji pada fixture SQL. Race dua koneksi tetap menunggu CI. Item snapshot dilindungi ACL/RLS dan ketiadaan update RPC, belum trigger immutable seperti lima jurnal. Pastikan old due_at non-null tidak disalahartikan sebagai PENDING sesudah default kolom baru.

### Audit impor

`20261102210000_pos_import_review_audit.sql` memberi audit private append-only dengan FK source/actor/member, RLS dan revoke all; trigger melarang perubahan field sumber dan mencatat perubahan keputusan oleh owner. Tidak ada jalur posting finansial. Dry-run fixture memeriksa dua keputusan, identical retry tanpa audit ganda, unknown PAID ditolak, audit immutable dan tidak ada uang/poin.

Guard PAID dengan status mentah tak dikenal menolak INSERT/MATCHED, tetapi row lama boleh dikarantina CONFLICT/SKIPPED; fixture QA lulus. Parser menolak cancelled dan footer tak cocok; subtotal per-section belum didukung tanpa contoh sah.

## Pekerjaan berurutan dan acceptance

1. **P1 recovery & identity UI (G3/G4/G5/G6):** selesaikan pending command identity, freeze exact payload, typed definitive/UNKNOWN state, recovery setelah re-auth dan pilihan member eksplisit. Owner UI harus memanggil owner endpoint; jangan menumpang token kasir.
2. **P1 finance core integration (G2/G5/G6):** review shared core ACL/actor/lock graph, finance flag default false, satu timestamp event, opening/close policy; QA DDL+fixtures dan race dua koneksi. Jangan mengubah guard legacy menjadi permissive.
3. **P2 import integrity (G6b):** final parser+audit SQL, sumber immutable, review history append-only, cancelled/footer/section/duplicate/revision/legacy invalid quarantine; data sintetis saja. Real historical reconciliation memerlukan owner.
4. **P2 contract completion (G4/G6):** cancellation, diskon/ongkir/ETA, program-year reporting dan physical cash scope ditetapkan. Bila fitur sengaja tidak masuk pilot, tampilkan unavailable dan catat persetujuan scope, bukan tandai implemented.
5. **Final automated gate (G0–G7):** Node/typecheck/build/Playwright final, SQL ACL/rollback fixtures, race/fault injection, diff review dan CI pada SHA final. Laporkan perintah, count, exit status dan commit; jangan menyalin checkpoint sebagai hasil terbaru.
6. **External gate (G1/G3/G7/G8):** restore rehearsal, real owner/cashier Auth, Android QR/barcode/gallery, physical count/print, 25 screenshot owner review, actual Binatu/opening receivable reconciliation, identity-risk+ETA approval. Status sampai bukti tersedia: BLOCKED / PHYSICAL_UAT_REQUIRED.
7. **Release terpisah (G8):** owner menyetujui rencana migrasi produksi dan cutoff; preflight fresh SHA/evidence; backup, maintenance/reconciliation, schema migration flag-off, validasi tanpa money live, explicit cutover GO, monitoring shift/poin/refund. Satu domain/proyek; tidak reconnect Git dan tidak menyentuh PR #30.

## Bukti yang tidak boleh diganti dengan klaim

Real Auth berarti sesi Supabase owner dan sesi dua-token kasir sungguhan dengan izin/revoke diuji, bukan set_config JWT di SQL superuser. Restore berarti restore backup aktual ke target aman dan rekonsiliasi, bukan checksum. Concurrency berarti koneksi terpisah dengan commit dan interleaving terkontrol, bukan satu rollback fixture. Physical UAT berarti perangkat dan uang/printer nyata, bukan Playwright. Visual parity berarti 25 layar ditinjau owner pada viewport sepadan, bukan string test. G8 GO memerlukan semua itu serta persetujuan eksplisit; master audit ini tetap NO-GO.


## Tindakan eksternal wajib dan pemilik bukti

| Tindakan | Penanggung jawab | Bukti penutupan (belum tersedia) |
| --- | --- | --- |
| Pilih kontrol identitas kasir sebelum finance | Owner + reviewer keamanan/operator jaringan | Keputusan tertulis: trusted workplace network dengan pembatasan akses yang dibuktikan, atau kontrol identitas lebih kuat; negative test dari jaringan/perangkat tak berhak, impersonation/revoke/expiry. Throttle tidak memperbaiki penyamaran memakai ID yang sudah diketahui; persetujuan risiko saja tanpa kontrol teruji bukan PASS |
| Backup dan restore produksi aman | Operator database + Owner | Backup aktual, restore ke target aman, checksum/ledger reconciliation, waktu/RPO/RTO, reviewer. Synthetic CI restore bukan restore produksi |
| Real Auth owner/kasir + Android | Owner dan kasir pilot + tester | Sesi nyata, role/revoke/timeout, Android kamera/galeri/barcode/QR, jaringan putus dan retry; timestamp/perangkat/hasil privat |
| Kas fisik/print/WA dan visual 25 layar | Owner dan kasir pilot | Count opening/receipts/refund/close, hasil print perangkat nyata, consent draf WA, per-screen owner signoff pada viewport sepadan |
| Rekonsiliasi finansial/histori | Owner + pemeriksa keuangan | Nota unik, kas/piutang cutoff WIB, ADD/VOID/poin, Binatu cancelled/lunas/duplicate, saldo awal dan perbedaan nol atau disetujui dengan jejak |
| Migrasi dan cutover | Owner + operator release/database | Approval schema terpisah, fresh reviewed/deployed SHA, baseline before/after, kedua flag OFF saat migrasi; approval pilot/aktivasi terpisah dan monitoring/stop procedure |

Seluruh baris tetap BLOCKED / PHYSICAL_UAT_REQUIRED sampai bukti nyata tersedia. Source dan synthetic mocks tidak dapat mengisi bukti ini.

## Checkpoint integrasi 3 November 2026

280 tes Node PASS; TypeScript dan build PASS; 14 tes browser fixture PASS pada 320/390/1440px. Lima migrasi canonical baru QA saja. Recovery menyimpan UUID saja, memulihkan hasil aktor yang sama dan memeriksa izin tiap operasi. Cancel owner/kasir meminta alasan/versi, menolak dana belum direfund. Synthetic restore, race dua koneksi dan deployment SHA baru menunggu CI; status gate tidak dinaikkan.

Tambahan rencana v1.1 diterima: empat tahap, satu paket per nota, paket global dan WA dinamis. Audit ulang dan implementasi dilaksanakan setelah paket ini stabil; lihat service-duration-whatsapp-plan-v1.1.md. Tarif contoh bukan konfigurasi resmi.
