import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  availableProgramYears,canEditProgramYear,canInitializeProgramYear,
  currentProgramYear
} from "../lib/laundry/program-years.ts";

const read=path=>readFileSync(path,"utf8");
const sql=read("supabase/migrations/20261017090000_stage10_card_reissue_and_next_year.sql");
const rotate=read("app/admin/members/card/actions.ts");
const card=read("app/admin/members/[id]/card/page.tsx");
const points=read("app/admin/points/actions.ts");
const rules=read("app/admin/points/rules/page.tsx");
const originalPoints=read("supabase/migrations/20261016230000_stage9_amount_points.sql");

test("WIB year boundary and historical/next year visibility are deterministic",()=>{
  const before=new Date("2026-12-31T16:59:59.000Z"); // 23:59:59 WIB
  const after=new Date("2026-12-31T17:00:00.000Z"); // Jan 1, 2027 WIB
  assert.equal(currentProgramYear(before),2026);
  assert.equal(currentProgramYear(after),2027);
  assert.deepEqual(availableProgramYears(before),[2026,2027]);
  assert.deepEqual(availableProgramYears(after),[2026,2027,2028]);
  assert.equal(canInitializeProgramYear(2028,before),false);
  assert.equal(canInitializeProgramYear(2028,after),true);
  assert.equal(canEditProgramYear(2026,after),false);
  assert.equal(canEditProgramYear(2027,after),true);
  assert.equal(canEditProgramYear(2028,after),true);
  assert.equal(canEditProgramYear(2035,after),false);
});

test("card rotation is transactional, owner-only, idempotent and auditable",()=>{
  assert.match(sql,/create table if not exists public\.laundry_card_reissues/);
  assert.match(sql,/request_id uuid primary key/);
  assert.match(sql,/alter table public\.laundry_card_reissues enable row level security/);
  assert.match(sql,/revoke all on public\.laundry_card_reissues from public,anon,authenticated/);
  assert.match(sql,/language plpgsql security definer set search_path = ''/);
  assert.match(sql,/language sql security invoker set search_path=''/);
  assert.match(sql,/auth\.uid\(\)/);
  assert.match(sql,/o\.is_active/);
  assert.match(sql,/for update/);
  assert.match(sql,/v_prior\.new_card_id/);
  assert.match(sql,/idempotency_key_conflict/);
  assert.match(sql,/revoked_at=clock_timestamp\(\),revoked_by=v_actor,revoked_reason=v_reason/);
  assert.match(sql,/insert into public\.laundry_member_cards/);
  assert.match(sql,/insert into public\.laundry_card_reissues/);
  assert.match(sql,/grant execute on function public\.laundry_reissue_card.*?to authenticated/s);
});

test("reissue requires explicit flag and owner confirmation before write",()=>{
  assert.match(rotate,/requireOwner\(\)/);
  assert.match(rotate,/OWNER_CARD_REISSUE_ENABLED/);
  assert.match(rotate,/confirmInvalidation/);
  assert.match(rotate,/laundry_reissue_card/);
  assert.match(rotate,/p_request_id:requestId/);
  assert.match(rotate,/tokenDigest\(token\)/);
  assert.match(rotate,/encryptCardToken\(token\)/);
  assert.match(card,/allowReissue &&/);
  assert.match(card,/Kartu QR sebelumnya tidak dapat digunakan lagi/);
  assert.doesNotMatch(card,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test("future-year setup is explicit, owner-only, idempotent, and never backfills historic transactions",()=>{
  assert.match(sql,/create or replace function laundry_private\.initialize_point_year/);
  assert.match(sql,/p_year not between v_current and v_current\+1/);
  assert.match(sql,/v_source.*?from public\.laundry_point_rules r/s);
  assert.match(sql,/for share/);
  assert.match(sql,/on conflict\(program_year\) do nothing/);
  assert.doesNotMatch(sql,/update public\.laundry_amount_transactions|delete from public\.laundry_amount_transactions/);
  assert.match(originalPoints,/rule_revision integer not null/);
  assert.doesNotMatch(points,/initializePointYear|laundry_initialize_point_year|savePointRules/);
  assert.match(rules,/notFound\(\)/);
});

test("public progress follows the WIB program year and does not mix historical points",()=>{
  const progress=read("app/k/[token]/page.tsx");
  const ownerDetail=read("app/admin/members/[id]/page.tsx");
  assert.match(progress,/memberHistoryYear\(input.year,currentYear\)/);
  assert.match(progress,/r.program_year===year/);
  assert.match(progress,/laundry_public_transaction_history/);
  assert.match(ownerDetail,/timeZone:"Asia\/Jakarta"/);
  assert.doesNotMatch(progress,/whatsapp_e164|description|amount_idr|token_ciphertext/);
});
