import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261106010000_pos_v31_receipt_snapshot.sql',import.meta.url),'utf8');
test('versioned receipt endpoints preserve legacy accounting balances through compatibility wrappers',()=>{
 for(const name of ['laundry_pos_v31_print_receipt','laundry_pos_v31_whatsapp_receipt'])assert.ok(sql.includes('function public.'+name+'('));
 assert.match(sql,/legacy_v:=public\.laundry_pos_v31_print_receipt/);
 assert.match(sql,/legacy_v:=public\.laundry_pos_v31_whatsapp_receipt/);
 assert.equal((sql.match(/\(legacy_v->>'total'\)::bigint-\(legacy_v->>'paid'\)::bigint\+\(legacy_v->>'refunded'\)::bigint/g)||[]).length,2);
});
test('snapshot preserves existing financial core and authorizes each read surface separately',()=>{
 assert.match(sql,/pos_v3_receipt_core\(p_order_id,p_kind,p_device_token,p_login_token,p_permission\)/);
 assert.match(sql,/pos_v31_receipt_snapshot\(p_order_id,p_kind,p_device_token,p_login_token,'whatsapp_draft',false\)/);
 assert.match(sql,/pos_v31_receipt_snapshot\(p_order_id,'NEW',p_device_token,p_login_token,'order_view',true\)/);
 assert.match(sql,/permissions->>'receipt_print'/);
 assert.doesNotMatch(sql,/insert into public\.laundry_pos_(payments|cash_ledger|point_links)|update public\.laundry_pos_orders/i);
});
test('audit-only internal links never flow through customer payment records',()=>{
 assert.match(sql,/if p_audit then/);assert.match(sql,/'internal_reference',payment_row\.command_id/);assert.match(sql,/'cash_ledger_id',payment_row\.ledger_id/);
 for(const field of ['order_id','order_version','payment_version','snapshot_at','payments','refunds'])assert.ok(sql.includes("'"+field+"'"));
 assert.match(sql,/revoke all on function laundry_private\.pos_v31_receipt_snapshot/);
});
