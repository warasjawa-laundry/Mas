import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const path=new URL('../supabase/migrations/20261106040000_pos_v31_cash_review_closure.sql',import.meta.url);
const sql=existsSync(path)?readFileSync(path,'utf8'):'';

test('cash review migration restricts sensitive categories before forwarding to the unchanged finance core',()=>{
 assert.match(sql,/staff_v is not null and p_category_code in \('CAPITAL','CASH_TRANSFER'\)/);
 assert.match(sql,/POS_ACCESS_DENIED/);
 assert.match(sql,/Sumber: /);assert.match(sql,/Tujuan: /);
 assert.match(sql,/public\.laundry_pos_v3_finance\('CASH_ENTRY'/);
 assert.doesNotMatch(sql,/create(?: or replace)? function laundry_private\.pos_(?:cash_entry|payment|refund_full)_core/i);
});
test('cash reads gate item summaries and targeted detail uses scoped authorization and original payment method',()=>{
 assert.match(sql,/create function public\.laundry_pos_cash_entry_detail\(p_entry_id uuid/);
 assert.match(sql,/'cash_view',false/);
 assert.match(sql,/l\.id=p_entry_id and l\.outlet_id=outlet_v/);
 assert.match(sql,/coalesce\(p\.original_receipt_id,p\.id\)/);
 assert.match(sql,/case when can_view and p\.order_id is not null then laundry_private\.pos_v31_item_summary/);
 assert.match(sql,/case when \(e\.value->>'can_view_order'\)::boolean and e\.value->>'order_id' is not null/);
 assert.match(sql,/e\.value-'item_count'-'quantities_milli'-'quantity_summary'/);
 assert.match(sql,/revoke all on function public\.laundry_pos_cash_entry_detail/);
});
test('cash review changes display labels without rewriting historical journals or category tables',()=>{
 assert.match(sql,/Perpindahan uang laci \(satu sisi\)/);
 assert.doesNotMatch(sql,/(?:update|delete from|insert into) public\.laundry_pos_(?:cash_ledger|payments|orders)\b/i);
 assert.doesNotMatch(sql,/(?:update|delete from|insert into) laundry_private\.pos_v31_cash_categories\b/i);
 assert.doesNotMatch(sql,/alter function .* set schema/i);
});
test('new transfer journal labels are explicit while existing request retries reuse the historical reason',()=>{
 assert.match(sql,/reason_v:=case when p_category_code='CASH_TRANSFER' then 'Perpindahan uang laci \(satu sisi\)' else category_v.label end/);
 assert.match(sql,/select note into reason_v from public\.laundry_pos_cash_ledger where command_id=p_request_id/);
 assert.ok(sql.indexOf("elsif p_category_code='CASH_TRANSFER'")>sql.indexOf('if old_v.category_code<>p_category_code'));
 assert.match(sql,/null,null,reason_v,p_direction,p_device_token,p_login_token/);
});
