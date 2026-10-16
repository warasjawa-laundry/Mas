import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p)=>readFileSync(p,"utf8");
const sql=read("supabase/migrations/20261016180000_stage5_owner_checklist.sql");
const actions=read("app/admin/visits/actions.ts");
const scan=read("components/admin/scan-card.tsx");
const detail=read("app/admin/members/[id]/page.tsx");
const ownerHub=read("app/admin/scan/page.tsx");

test("scanner resolves a member and NEVER writes a visit automatically",()=>{
 assert.match(scan,/resolveOwnerScannedCard/);
 assert.match(scan,/BrowserQRCodeReader/);
 assert.doesNotMatch(scan,/recordOwnerVisit|laundry_record_visit|\.insert\(/);
 assert.match(ownerHub,/<ScanCard\/>/);
});
test("only owner confirmation can ADD or VOID visit, each using request UUID",()=>{
 assert.match(actions,/requireOwner\(\)/);
 assert.match(actions,/laundry_record_visit/);
 assert.match(actions,/laundry_void_visit/);
 assert.match(detail,/action=\{recordOwnerVisit\}/);
 assert.match(detail,/Catat 1 Transaksi/);
 assert.match(detail,/action=\{correctOwnerVisit\}/);
 assert.match(sql,/on conflict\(request_id\) do nothing/i);
 assert.match(sql,/event_type='ADD'/);
 assert.match(sql,/event_type='VOID'/);
 assert.match(sql,/idempotency_key_conflict/);
});
test("security definer stays private; invoker RPC explicitly authorizes owner UUID",()=>{
 assert.match(sql,/laundry_private\.record_visit/);
 assert.match(sql,/security definer set search_path=''/);
 assert.match(sql,/security invoker set search_path=''/);
 assert.match(sql,/laundry_owner_accounts/);
 assert.match(sql,/revoke all on function public\.laundry_record_visit.*from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.laundry_record_visit.*to authenticated/);
 assert.doesNotMatch(sql,/grant execute on function public\.laundry_record_visit.*to anon/);
});
test("public member page remains read-only and does not award promo",()=>{
 const publicPage=read("app/k/[token]/page.tsx");
 assert.match(publicPage,/laundry_public_card_progress/);
 assert.doesNotMatch(publicPage,/laundry_record_visit|recordOwnerVisit/);
 assert.doesNotMatch(actions,/promo|whatsapp|reward|threshold/i);
});
