import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(name)=>readFileSync(name,"utf8");
const sql=read("supabase/migrations/20261016150000_stage4_members_and_cards.sql");
const action=read("app/admin/members/actions.ts");
const card=read("lib/laundry/card.ts");
const member=read("app/admin/members/new/page.tsx");
const portal=read("app/k/[token]/page.tsx");
test("member registration is explicit owner-only, DB atomic and idempotent",()=>{
 assert.match(action,/requireOwner\(\)/);
 assert.match(sql,/registration_request_id uuid unique/);
 assert.match(sql,/on conflict \(registration_request_id\) do nothing/i);
 assert.match(sql,/insert into public\.laundry_member_cards/);
 assert.match(sql,/laundry_owner_accounts/);
 assert.match(sql,/security definer/);
 assert.match(sql,/laundry_private/);
});
test("QR never uses human-readable member number or third-party generation",()=>{
 assert.match(card,/randomBytes\(32\)/);
 assert.match(card,/createHash\("sha256"\)/);
 assert.match(card,/aes-256-gcm/);
 assert.match(card,/createDecipheriv/);
 assert.doesNotMatch(card,/NEXT_PUBLIC_/);
 assert.doesNotMatch(action,/service_role|SUPABASE_SECRET_KEY/);
});
test("public progress reads no private phone/name, does not mutate visits",()=>{
 assert.match(portal,/laundry_public_card_progress/);
 assert.match(sql,/c\.token_digest=decode\(p_digest_hex,'hex'\)/);
 assert.doesNotMatch(sql.slice(sql.indexOf('create or replace function laundry_private.public_card_progress')),/whatsapp_e164/);
 assert.doesNotMatch(portal,/signInWithPassword|laundry_checklist_events/);
});
test("member form has optional WhatsApp and explicit consent",()=>{
 assert.match(member,/name="name"/);
 assert.match(member,/name="whatsapp"/);
 assert.match(member,/name="consent"/);
 assert.match(member,/Simpan & Lihat Kartu/);
});
