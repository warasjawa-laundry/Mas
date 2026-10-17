import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");
const migration=read("supabase/migrations/20261017130000_stage11_db_only_point_rules.sql");
const actions=read("app/admin/points/actions.ts");
const route=read("app/admin/points/rules/page.tsx");
const navigation=read("components/admin/admin-navigation.tsx");
const home=read("app/admin/page.tsx");
const member=read("app/admin/members/[id]/page.tsx");

test("no point-rule editor, link, or server action is available to owner or staff",()=>{
 for(const source of [navigation,home,member]){
   assert.doesNotMatch(source,/Atur nominal & poin|Atur Poin|href="\/admin\/points\/rules"|href:\s*"\/admin\/points\/rules"/);
 }
 assert.match(route,/notFound\(\)/);
 assert.doesNotMatch(route,/savePointRules|initializePointYear|form action/);
 assert.doesNotMatch(actions,/savePointRules|initializePointYear|laundry_set_point_rules|laundry_initialize_point_year/);
});

test("database roles cannot execute policy mutations or update rule rows",()=>{
 for(const name of [
  "public.laundry_set_point_rules(integer,jsonb,integer)",
  "laundry_private.set_point_rules(integer,jsonb,integer)",
  "public.laundry_initialize_point_year(integer)",
  "laundry_private.initialize_point_year(integer)",
 ]) assert.ok(migration.includes("function "+name),name);
 assert.equal((migration.match(/from public, anon, authenticated, service_role/g)||[]).length,5);
 assert.match(migration,/revoke insert, update, delete, truncate on public\.laundry_point_rules/);
 assert.doesNotMatch(migration,/grant execute|update public\.laundry_point_rules|delete from public\.laundry_point_rules/i);
});

test("ledger and read-only point estimate still work",()=>{
 assert.match(actions,/laundry_record_amount_visit/);
 assert.match(member,/<AmountVisitForm/);
 assert.match(member,/laundry_point_rules/);
 assert.match(read("components/admin/amount-visit-form.tsx"),/Perkiraan poin/);
 assert.match(read("supabase/migrations/20261016230000_stage9_amount_points.sql"),/grant select on public\.laundry_point_rules to authenticated/);
});
