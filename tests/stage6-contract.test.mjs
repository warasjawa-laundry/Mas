import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const sql=read("supabase/migrations/20261016190000_stage6_manual_promotions.sql");
const server=read("app/admin/promotions/actions.ts");
const view=read("components/admin/member-promotions.tsx");
const member=read("app/admin/members/[id]/page.tsx");
const customer=read("app/k/[token]/page.tsx");
const scan=read("components/admin/scan-card.tsx");

test("manual promo grant has owner authorization and retry-safe DB identity",()=>{
 assert.match(sql,/laundry_private\.grant_manual_promotion/);
 assert.match(sql,/security definer set search_path=''/);
 assert.match(sql,/laundry_owner_accounts/);
 assert.match(sql,/on conflict\(request_id\) do nothing/);
 assert.match(sql,/idempotency_key_conflict/);
 assert.match(sql,/security invoker set search_path=''/);
 assert.match(sql,/grant execute on function public\.laundry_grant_manual_promotion.*to authenticated/);
 assert.doesNotMatch(sql,/grant execute on function public\.laundry_grant_manual_promotion.*to anon/);
});

test("manual lifecycle marks used or cancelled, never resets visit or sends WhatsApp",()=>{
 assert.match(sql,/status='USED'/);
 assert.match(sql,/status='CANCELLED'/);
 assert.match(sql,/where id=p_promotion_id and member_id=p_member_id and status='AVAILABLE'/);
 assert.doesNotMatch(sql,/laundry_checklist_events|notify|send_whatsapp|threshold|reward/i);
 assert.match(sql,/p_action is null/);
});

test("owner UI can add, redeem and cancel promos without auto-award",()=>{
 assert.match(server,/requireOwner\(\)/);
 assert.match(server,/laundry_grant_manual_promotion/);
 assert.match(server,/laundry_finish_manual_promotion/);
 assert.match(view,/Simpan Promo untuk Member/);
 assert.match(view,/Tandai Digunakan/);
 assert.match(view,/Batalkan Promo/);
 assert.match(member,/<MemberPromotions/);
 assert.match(customer,/laundry_public_card_progress/);
 assert.doesNotMatch(scan,/recordOwnerVisit|grantManualPromo|finishManualPromo/);
});

test("manual paste QR is gone; camera, gallery and manual member list remain",()=>{
 assert.doesNotMatch(scan,/owner-qr-paste|manual-qr|tempel link QR|setManual\(/i);
 assert.match(scan,/Buka Kamera/);
 assert.match(scan,/Pilih Foto QR/);
 assert.match(scan,/Cari Member Manual/);
});
