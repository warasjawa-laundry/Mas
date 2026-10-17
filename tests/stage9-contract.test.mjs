import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(path,"utf8");
const sql=read("supabase/migrations/20261016230000_stage9_amount_points.sql");
const actions=read("app/admin/points/actions.ts");
const form=read("components/admin/amount-visit-form.tsx");
const rules=read("app/admin/points/rules/page.tsx");
const member=read("app/admin/members/[id]/page.tsx");
const publicCard=read("app/k/[token]/page.tsx");
const scanner=read("components/admin/scan-card.tsx");

test("five database-managed nominal bands with year-isolated default rules",()=>{
 assert.match(sql,/program_year integer primary key/);
 assert.match(sql,/insert into public\.laundry_point_rules/);
 for (const n of [10000,25000,50000,100000,200000])assert.match(sql,new RegExp('"minimum":'+n));
 assert.match(sql,/jsonb_array_length\(p_tiers\)<>5/);
 assert.match(sql,/v_amount<=v_previous/);
 assert.match(sql,/v_current<>p_expected_revision/);
 assert.match(rules,/notFound\(\)/);
 assert.doesNotMatch(actions,/savePointRules|initializePointYear|laundry_set_point_rules/);
 assert.doesNotMatch(member,/Atur nominal & poin/);
});
test("owner manually confirms amount, description and preview points before adding a visit",()=>{
 assert.match(form,/action=\{recordAmountVisit\}/);
 assert.match(form,/name="amountIdr"/);
 assert.match(form,/name="description"/);
 assert.match(form,/Perkiraan poin/);
 assert.match(form,/Simpan transaksi/);
 assert.match(form,/type="submit"/);
 assert.match(actions,/requireOwner\(\)/);
 assert.match(actions,/laundry_record_amount_visit/);
 assert.match(member,/<AmountVisitForm/);
 assert.match(member,/Riwayat transaksi/);
});
test("amount transaction is atomic with legacy checklist, with immutable scoring",()=>{
 assert.match(sql,/laundry_private\.record_visit\(p_member_id,p_request_id\)/);
 assert.match(read("supabase/migrations/20261016180000_stage5_owner_checklist.sql"),/on conflict\(request_id\) do nothing/);
 assert.match(sql,/laundry_amount_transactions/);
 assert.match(sql,/awarded_points integer not null/);
 assert.match(sql,/rule_revision integer not null/);
 assert.match(sql,/idempotency_key_conflict/);
 assert.match(sql,/reversal\.reverses_event_id=t\.visit_event_id/);
 assert.doesNotMatch(form,/resolveOwnerScannedCard|decodeFromVideoDevice|fetch\(/);
 assert.doesNotMatch(scanner,/recordAmountVisit|laundry_record_amount_visit/);
});
test("operator-only rules with owner-verified transactions and no direct table update grants",()=>{
 assert.match(sql,/security definer set search_path=''/);
 assert.match(sql,/security invoker set search_path=''/);
 assert.match(sql,/laundry_owner_accounts/);
 assert.match(sql,/revoke all on public\.laundry_amount_transactions from public,anon,authenticated/);
 assert.match(sql,/revoke all on public\.laundry_point_rules from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.laundry_record_amount_visit.*to authenticated/);
 assert.doesNotMatch(sql,/grant execute on function public\.laundry_record_amount_visit.*to anon/);
});
test("customer receives only sums per year, not raw details or private member fields",()=>{
 assert.match(publicCard,/laundry_public_point_balances/);
 assert.match(publicCard,/Saldo program 2027/);
 assert.doesNotMatch(publicCard,/description|amount_idr|whatsapp_e164|p_member_id/);
 assert.match(sql,/if p_digest_hex is null or p_digest_hex !~ '\^\[0-9a-f\]\{64\}\$'/);
 assert.match(sql,/where c\.token_digest=decode\(p_digest_hex,'hex'\)/);
});
