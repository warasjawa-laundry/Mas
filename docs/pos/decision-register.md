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
| G3 owner login + cashier MAS-XXXX | **Partial QA:** satu outlet MJL, owner CRUD+izin, username urut tidak reuse, per-device paired username login, token sesi kedua, lockout/revoke, SQL+Node tests. Physical real-auth UAT, production migration and financial actor bridge pending. |
| G4 create/read/work notes | **Implemented in isolated QA:** staff actor FK bridge, singleton invoice counter, member-number/guest, catalog-authoritative pricing, immutable command result, order list/detail, status transitions and HTML print. SQL rollback passes; still missing physical QR UAT, discount/delivery rules, concurrent race evidence, production migration authorization. |\n| G5–G8 | Not implemented; live payment/cash/point commands remain OFF; one outlet only |

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
