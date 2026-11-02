## Owner correction — 2 November 2026 (latest, supersedes pairing requirement)

- Owner tetap login ID/password. Kasir login **hanya** menggunakan ID pola `MAS-0000` (empat digit), nomor otomatis saat owner membuat kasir, **tanpa password dan tanpa aktivasi perangkat**. `MAS-0000` dicadangkan; ID valid yang dialokasikan `MAS-0001`–`MAS-9999`.
- Owner mengatur kemampuan petugas dan dapat revoke sesi. Implementasi memakai dua token sesi acak 256-bit terpisah maksimal 12 jam, bukan cookie owner.
- Tidak menganggap 4-digit ID sebagai autentikasi kuat. Throttle global 10 permintaan/menit dengan 5 menit lock, maksimum lima sesi per staff; risiko brute-force, ID disclosure dan DoS harus ditinjau sebelum pembayaran produksi. Tidak ada perubahan database produksi dan G8 tetap NO-GO.
- [QA receipt](./g3-direct-id-login-verification.md) dan pembaruan `implementation-plan-v2.md` ikut dalam PR tunggal.

# POS decisions and implementation ledger

## User decisions

On 1 November 2026 the user explicitly selected “Setujui usulan D01–D11 untuk implementasi” after receiving the summary of DP, full-payment points, final-price basis including fees, WIB year, no backfill, full-refund-first, restricted custom discounts, manual WA and online-only. See `implementation-plan-v2.md` section 10 for the full approved decisions. This authorizes implementation, not production cutover.

The user separately approved a clean Mumbai QA project in organization `irwtmqbaqcnbxuuyamvk` at the tool quote US$0/month. Old paused QA remains untouched.

## Implementation rulings

- Pure money calculation is implemented before the order wizard as an independently testable approved contract; no financial writes depend on client totals. Wrong assumptions cost a contract/test revision before DB/UI integration.
- Amount/line/subtotal/fees/final caps are Rp1 billion. A later discount does not rescue an overflowing subtotal. Quantities are capped at one million units per line, with at most 1,000 lines, to bound parsing/calculation. These technical limits are documented and tested; changing them needs synchronized DB validation.
- Unknown item/adjustment/discount fields are rejected rather than silently ignored; a misspelled fee must not produce a successful lower quote.
- New QA reconstructs only schema, migration seeds and rollback fixtures, not real customer rows or private consolidation payloads.
- Owner intentionally keeps existing Vercel `mas` Git connection to `unyilhm1-hue/mas` and requests **no staging/Preview**. Source work stays in `warasjawa-laundry/Mas`; use temporary PR branches merged to `main`, existing Production deployment only, and explicit SHA/domain verification. The previous reconnect requirement is superseded; cloud Preview is N/A by owner decision, not PASS.

## Task status

| Task | Status |
| --- | --- |
| G0 source/data baseline | Read-only snapshot, source pin, schema/RPC inventory complete; reference screenshots/Excel and backup/restore evidence still pending |
| G1 QA schema/code isolation | New QA active, 17 migrations and 8 SQL tests done, guard added; Preview N/A by owner decision, authenticated UAT/restore remain pending |
| Nominal contract for G2/G4 | BigInt utility implemented; focused red/green tests and independent review completed |
| G2 RBAC/financial schema and legacy bridge | **Partial QA:** 17 POS tables, deny-by-default + RLS, 5 immutable triggers, read-only outlet RPC, actor FK now auth.users; SQL rollback regression passed. Authenticated owner/cashier UAT, payment RPC, production rollout and approval still pending. |
| G3 owner login + cashier MAS-XXXX | **Partial QA updated 2 Nov:** satu outlet, owner CRUD+izin, 4-digit ID unik, direct ID-only login tanpa pairing, dua token sesi 12h, global throttle+revoke; SQL rollback/Node tests. Real-auth UAT, security sign-off, prod schema/cutover tetap pending. |
| G4 create/read/work notes | **Implemented in isolated QA:** staff actor FK bridge, singleton invoice counter, member-number/guest, catalog-authoritative pricing, immutable command result, order list/detail, status transitions and HTML print. SQL rollback passes; still missing physical QR UAT, discount/delivery rules, concurrent race evidence, production migration authorization. |\n| G5 | QA payment/refund + points code merged in PR #23, live production database unchanged; real concurrency/UAT pending |\n| G6 | QA cash/report/shift/CSV/WA manual implemented (Paket B); production write OFF; physical UAT/pilot pending |\n| G6b | QA owner-only Excel import/review implemented (Paket B); historical posting and point backfill explicitly disabled |\n| G7–G8 | Physical UAT, backup/restore, reconciled cutover and pilot not complete |

## Owner decision: sequential cashier usernames (1 November 2026)

- Owner supplies cashier **name** only; database automatically assigns `MAS-0001`, `MAS-0002`, ... `MAS-9999`. Counter locks single outlet row; immutable unique ID not reissued after disable/delete.
- Cashier signs into `/kasir` by entering the assigned username, no password, only on a device owner paired for **that cashier**; device token 7 days and a second login token 12 hours. Five wrong attempts lock device for five minutes; other staff IDs rejected even if known.
- This supersedes former automatic cashier access on a paired device, but keeps owner as the only password account. No second outlet, no live payment writes. QA migration and SQL rollback tests passed; physical UAT and production migration pending.

## Owner change — only one outlet and passwordless staff (1 November 2026)

- Owner is the only user with ID/password login. Cashier is an owner-managed display-name/profile + explicitly assigned permissions, **not** a Supabase Auth account.
- Device activation requires an already logged-in owner on the actual workstation, issues a random 256-bit cookie token (SHA-256 digest stored DB), then signs out owner locally; staff uses `/kasir` without passwords. Owner can remove (soft-disable), revoke devices, adjust permissions. Seven-day expiry.
- Exactly one fixed outlet: Mas Jawa Laundry, Jl. Raya Kandang Jati Kulon RT.06 RW.01, Kandang Jati Kulon, Probolinggo. No add/edit/switch outlet UI. POS flag `write_enabled=false` in QA; no financial writes on Production.
- Supersedes previous D08 multioutlet assumption and D09 individual cashier passwords. G5 must migrate financial actor refs to actual staff IDs before enabling payments: owner identity must never be substituted for cashier.
- QA receipt: [`g3-single-outlet-cashiers.md`](./g3-single-outlet-cashiers.md); G3 is not signed off until authenticated device/physical tests.

## Latest owner decisions — direct main workflow

- Only one Vercel project `mas`; keep connected Git repository `unyilhm1-hue/mas` unchanged.
- No Vercel Preview, staging or new deployment environment. Release reviewed partial features via `main` to existing Production; verify SHA and domain mapping after each merge; never turn on incomplete POS payments or point writes. Owner login only; one outlet only.
- Screenshot references remain in `reference/binatu-ui-ux` (25 sanitized JPGs, commit `c17b043`), mapped from `docs/pos/evidence-manifest.md`.
- Existing member, point, QR production records must remain intact. No live write testing.

## G2 QA schema package — one PR/CI batch

- Migrasi SQL additive `supabase/migrations/20261101142000_pos_g2_foundation_roles_orders_financial_schema.sql` telah diterapkan di **QA saja** (`cwxsbgfjynwxqalwonae`) sebagai migrasi `pos_g2_foundation_roles_orders_financial_schema`; semua 17 tabel baru RLS + default deny.
- SQL test rollback `supabase/tests/pos-g2-schema-contract.sql` lulus dan terhubung ke satu run Stage 10 CI untuk paket ini.
- FK `laundry_checklist_events.actor_id` sekarang mereferensikan `auth.users` di QA, tanpa menaikkan privilege kasir atau mengubah owner-only RPC.
- Tidak ada login QA, test user, live POS receipt/point, atau migration ke DB produksi. G2 belum PASS menyeluruh.
- Tidak ada push per-file; satu branch dan satu PR untuk menekan penggunaan kuota CI.

## Newly verified G2 design issue

The legacy checklist and audit event `actor_id` foreign keys point to `laundry_owner_accounts`. A cashier cannot insert a correctly attributed point event merely because a new POS helper accepts that cashier. Adding cashiers as active owners would be an unacceptable privilege escalation.

Bridge FK di QA **sudah diterapkan secara terbatas**; sebelum operasi produksi tetap perlu review independen dan regresi owner/cashier terautentikasi. Catatan desain awal: point/audit actor references may need to target canonical `auth.users` while owner-only RPC authorization, base-table grants and RLS remain unchanged. Existing historical rows must not be rewritten and actor identities must not be fabricated. Member/card/promo owner-only constraints should remain unchanged unless separately required. This is a constraint change, not something to describe as “only adding new tables.” Add direct privilege, cashier attribution, owner regression and historical-FK tests before accepting it. No such migration has been applied to production or QA in this foundation patch.

## G4 QA-only verification (1 November 2026)

[Receipt](./g4-order-verification.md). No production Supabase mutation. The existing owner actor provenance is preserved; real MAS-XXXX staff is linked only to order creation/work events (G4), **not** payment/legacy point posting (G5 blocked). A single review/PR/CI batch includes the SQL migration, UI and tests.

## G5 Paket A — bukti QA (1 November 2026)

- Satu PR konsolidasi berisi: skema atribusi finansial kasir nyata tanpa menyamar sebagai owner, dua-token scoped `payment_collect`/`refund_full`, buka shift MAIN saldo awal 0, pembayaran sebagian/lunas, jurnal kas, award satu kali, full refund/VOID, guard legacy manual ADD, status read-only, dan UI pembayaran meniru pola referensi Binatu dengan identitas Mas Jawa.
- SQL migration `20261101233000_pos_g5_payment_points_refund.sql` berhasil diterapkan **hanya pada Supabase QA** dan belum masuk Supabase produksi.
- Regression rollback: sebagian bayar tanpa poin, lunas satu ADD/amount/link, replay UUID, konflik payload, versi lama, overpayment, guest tanpa poin, nota nol, refund dua metode + VOID, ADD manual owner terblokir saat cutover, kasir tanpa izin refund, dan sesi kasir dicabut semuanya lulus.
- **Belum GO:** pengujian fisik Android/QR, race dua koneksi, login Auth nyata, backup/restore, dan persetujuan migrasi produksi. `write_enabled=false` pada QA; tidak ada pembayaran/poin produksi aktif. G6/G6b belum dibuat.

## Paket B owner decisions (2 November 2026)

- UI/UX sedekat mungkin dengan Binatu (25 screenshot tersanitasi) dengan identitas Mas Jawa Laundry; G6/G6b mengikuti pola mutasi/periode dan modal transaksi lunas, tanpa mengambil aset proprietari.
- Hanya ada satu outlet `MJL`, satu shift/register `MAIN`, dan project Vercel Production `mas` tetap terhubung ke `unyilhm1-hue/mas`. GitHub source target `main` dengan satu PR konsolidasi.
- Impor Excel Binatu owner-only **tidak** menambah poin, riwayat kunjungan atau pembayaran; kecocokan nama menampilkan nomor member + telepon + alamat untuk dipilih manual; nomor nota Binatu adalah kunci konflik.
- G6 shift closing dan laporan di QA siap untuk UAT; keputusan pilot produksi, riwayat piutang dan poster/thermal printer belum disahkan sebagai live. Panduan: [G6–G6b verification](./g6-g6b-verification.md).


## Paket C G7/G8 decision — 2 Nov 2026
- In-scope code batch: read-only cashier QR camera/gallery+database digest lookup, functional status tabs, POS visual yellow style, SQL regression & committed two-session PostgreSQL race CI, owner UAT runbook and fail-closed release receipt.
- Owner's request for UI/UX nearly identical to Binatu remains binding, BUT visual sign-off is not met; see [UI parity audit](./ui-parity-audit.md) for explicit gaps (duration sheet, delivery fee, discounts, member name search, physical Android screenshot comparison).
- G8 database production migration, backup/restore, data reconciliation, owner cutover sign-off, flag enable, real payment/point posting and new Vercel staging environment are NOT authorized by successful source PR. Source is `warasjawa-laundry/Mas` main; existing Production project/Git connection stays.
- QA history contains a comment-only migration entry preceding actual G7 DDL; rectify evidence at future schema-cutover review, do not copy QA migration log into production.


## G7 wizard decisions — 2 Nov 2026

- Durasi dipilih dari `laundry_services.duration` sebenarnya, bukan tarif Reguler/Express/Kilat fiktif; dapat berubah sesuai katalog yang disetujui owner. Belum ada due-date otomatis dari durasi rentang.
- Kasir dengan `member_lookup` berhak melihat maksimal 8 nama+nomor per pencarian prefix min 3 karakter. Phone/address tetap hanya untuk alur owner import Binatu, tidak diperluas ke kasir.
- Preset parfum hanya mengisi field existing. Ongkir dan diskon akan tetap non-operasional sampai owner menentukan nilai, otorisasi, dan aturan akuntansi/POINT base. Semua bukti UI masih source-level, bukan full signed-off parity.
- G8 **NO-GO**, DB produksi tidak disentuh, existing Vercel project/linked Git unchanged.
