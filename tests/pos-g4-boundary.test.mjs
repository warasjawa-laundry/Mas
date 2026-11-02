import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(name,'utf8');
test('G4 create/write is permission-checked twice, no owner session masquerading',()=>{
 const sql=read('supabase/migrations/20261101190000_pos_g4_order_creation.sql');
 const actions=read('app/kasir/pesanan/actions.ts');
 assert.match(sql,/created_staff_id uuid references public\.laundry_pos_staff/);
 assert.match(sql,/actor_staff_id uuid references public\.laundry_pos_staff/);
 assert.match(sql,/pos_g4_cashier_authorize\(p_device_token,p_login_token,'order_create',true\)/);
 assert.match(sql,/write_enabled for update/);
 assert.match(sql,/POS_REQUEST_CONFLICT/);
 assert.match(sql,/POS_CATALOG_CHANGED/);
 assert.match(sql,/laundry_pos_order_events\(order_id,command_id,actor_staff_id/);
 assert.match(actions,/cashierRpcAccess\("order_create"\)/);
 assert.doesNotMatch(actions,/created_by\s*:|actor_id\s*:|price_idr\s*:|point|laundry_record_amount_visit/);
});
test('G4 no payment/award function and order form cannot forge price',()=>{
 const sql=read('supabase/migrations/20261101190000_pos_g4_order_creation.sql');
 const form=read('app/kasir/pesanan/baru/order-form.tsx');
 assert.doesNotMatch(sql,/insert into public\.laundry_pos_(payments|point_links|cash_ledger)/);
 assert.doesNotMatch(form,/name="price_idr"|name="actor_id"/);
 assert.match(form,/calculateOrderTotals/);
 assert.match(form,/Buat pesanan/);
 assert.match(sql,/p_request_id uuid/);
});
