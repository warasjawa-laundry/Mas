import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(path,"utf8");
const sql=read("supabase/migrations/20261016210000_stage8_member_contact_management.sql");
const action=read("app/admin/members/contact/actions.ts");
const edit=read("app/admin/members/[id]/edit/page.tsx");
const list=read("app/admin/members/page.tsx")+read("components/admin/member-directory-list.tsx");
const detail=read("app/admin/members/[id]/page.tsx");
const whatsapp=read("components/admin/promo-whatsapp.tsx");
const css=read("app/admin/admin.css");

test("member edit is a dedicated owner-only path and never reissues cards or mutates visits",()=>{
 assert.match(edit,/requireOwner\(\)/);
 assert.match(action,/requireOwner\(\)/);
 assert.match(edit,/action=\{updateMemberContact\}/);
 assert.match(list,/\/edit\`}>Ubah Data/);
 assert.match(detail,/Ubah Data/);
 assert.doesNotMatch(action,/laundry_record_visit|laundry_register_member|laundry_grant_manual_promotion|newCardToken|encryptCardToken/);
 assert.match(action,/normalizeWhatsapp/);
 assert.match(action,/validateMemberName/);
});
test("security definer checks active owner and RLS hides history from anon",()=>{
 assert.match(sql,/security definer set search_path=''/);
 assert.match(sql,/laundry_owner_accounts[\s\S]*auth_user_id=v_owner and is_active/);
 assert.match(sql,/create policy laundry_owner_read_contact_events/);
 assert.match(sql,/grant select on table public\.laundry_member_contact_events to authenticated/);
 assert.match(sql,/revoke all on table public\.laundry_member_contact_events from public,anon,authenticated/);
 assert.match(sql,/security invoker set search_path=''/);
 assert.match(sql,/grant execute on function public\.laundry_update_member_contact.*to authenticated/);
 assert.doesNotMatch(sql,/grant execute on function public\.laundry_update_member_contact.*to anon/);
});
test("explicit customer confirmation is required; phone change defaults to revoking old consent",()=>{
 assert.match(sql,/v_action='GRANT' and \(v_phone is null or p_customer_confirmed is distinct from true\)/);
 assert.match(sql,/v_action='REVOKE' or v_phone is null or v_phone_changed/);
 assert.match(sql,/v_consent_at:=null/);
 assert.match(sql,/v_consent_at:=clock_timestamp\(\)/);
 assert.match(edit,/Wajib dicentang jika memilih Aktifkan/);
 assert.match(edit,/Mengubah nomor akan mencabut izin lama/);
});
test("member revision and request ID guard against stale and duplicate submission",()=>{
 assert.match(sql,/member_edit_revision bigint not null default 0/);
 assert.match(sql,/member_edit_revision=member_edit_revision\+1/);
 assert.match(sql,/v_member\.member_edit_revision is distinct from p_expected_revision/);
 assert.match(sql,/where request_id=p_request_id/);
 assert.match(sql,/idempotency_key_conflict/);
 assert.match(action,/p_expected_revision:expected/);
 assert.match(edit,/name="expectedRevision"/);
});
test("audit history records only boolean changes, not old/new phone PII",()=>{
 const table=sql.slice(sql.indexOf("create table if not exists public.laundry_member_contact_events"),sql.indexOf("alter table public.laundry_member_contact_events enable row level security"));
 assert.doesNotMatch(table,/whatsapp_e164|display_name|phone_old|phone_new|old_phone|new_phone/);
 assert.match(table,/consent_before boolean/);
 assert.match(table,/consent_after boolean/);
 assert.match(table,/phone_changed boolean/);
 assert.match(table,/actor_id uuid/);
 assert.match(edit,/Riwayat perubahan data/);
});
test("WhatsApp action for missing consent leads to owner member edit instead of bypass",()=>{
 assert.match(whatsapp,/Ubah nomor atau izin promo/);
 assert.match(whatsapp,/props\.whatsappConsent/);
 assert.match(whatsapp,/props\.memberActive && validPhone && props\.whatsappConsent/);
 assert.match(css,/owner-edit-card/);
 assert.match(css,/@media\(max-width:600px\)/);
});
