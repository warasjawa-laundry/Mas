import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseG5Payment,parseG5Refund,parseG5Shift} from '../lib/pos/g5-payment.ts';
const make=data=>{const f=new FormData();for(const [k,v] of Object.entries(data))f.append(k,v);return f;};
const req='a3c37b07-b9d3-4f6e-a783-80c1a712352f';
const order='cd38a914-158b-4f8f-a21b-6cfe5b1111f7';
const payment=(overrides={})=>make({orderId:order,requestId:req,amountIdr:'63000',method:'CASH',expectedVersion:'2',...overrides});
test('G5 strict payment parser retains stable UUID + exact IDR string',()=>{
 assert.deepEqual(parseG5Payment(payment()),{orderId:order,requestId:req,amountIdr:'63000',method:'CASH',expectedVersion:2});
 assert.equal(parseG5Payment(payment({method:'NONCASH'}))?.method,'NONCASH');
});
test('G5 rejects money coercion/negative/zero/over-limit/stale version/invalid method',()=>{
 for(const bad of ['', '0', '-1', '01', '+1', '1.0', '1e3', '1,000', ' 1', '1000000001','999999999999999999999999'])
  assert.equal(parseG5Payment(payment({amountIdr:bad})),null);
 for(const bad of ['0','-1','1.0','NaN','999999999999999999999999'])
  assert.equal(parseG5Payment(payment({expectedVersion:bad})),null);
 for(const bad of ['CARD','cash',''])assert.equal(parseG5Payment(payment({method:bad})),null);
 for(const method of ['TRANSFER','QRIS'])assert.equal(parseG5Payment(payment({method})).method,method);
 for(const field of ['orderId','requestId']) assert.equal(parseG5Payment(payment({[field]:'fake'})),null);
});
test('G5 refund reason and stable identity must be present',()=>{
 assert.deepEqual(parseG5Refund(make({orderId:order,requestId:req,expectedVersion:'3',reason:'Koreksi nota'})),
  {orderId:order,requestId:req,expectedVersion:3,reason:'Koreksi nota'});
 for(const reason of ['', 'x', 'x'.repeat(301), 'reason\n bad']) assert.equal(parseG5Refund(make({orderId:order,requestId:req,expectedVersion:'3',reason})),null);
 assert.equal(parseG5Refund(make({orderId:order,requestId:req,expectedVersion:'0',reason:'Refund'})),null);
 assert.deepEqual(parseG5Shift(make({orderId:order,requestId:req})),{orderId:order,requestId:req});
});
test('G5 SQL ensures cash/points/refund atomic journaling, no owner impersonation',()=>{
 const sql=readFileSync('supabase/migrations/20261101233000_pos_g5_payment_points_refund.sql','utf8');
 assert.match(sql,/alter table public\.laundry_amount_transactions\s+add column actor_staff_id/);
 assert.match(sql,/pos_amount_one_actor/);
 assert.match(sql,/v_now:=clock_timestamp\(\)/);
 assert.match(sql,/for update/);
 assert.match(sql,/POS_OVERPAYMENT/);
 assert.match(sql,/POS_ORDER_VERSION_CONFLICT/);
 assert.match(sql,/insert into public\.laundry_amount_transactions/);
 assert.match(sql,/insert into public\.laundry_pos_point_links/);
 assert.match(sql,/insert into public\.laundry_pos_cash_ledger/);
 assert.match(sql,/POS_LEGACY_MANUAL_AWARD_DISABLED/);
 assert.doesNotMatch(sql,/set role service_role|insert into auth\.users|update public\.laundry_checklist_events/);
});
test('Server actions preserve request UUID across uncertain payment/refund responses',()=>{
 const actions=readFileSync('app/kasir/pesanan/payment-actions.ts','utf8');
 assert.match(actions,/p_request_id:payload.requestId/);
 assert.match(actions,/confirmed:true,redirectTo/);
 assert.doesNotMatch(actions,/new URLSearchParams/);
 assert.match(actions,/alasan dan ID permintaan yang sama/);
 assert.match(actions,/cashierRpcAccess\('payment_collect'\)/);
 assert.match(actions,/cashierRpcAccess\('refund_full'\)/);
 assert.doesNotMatch(actions,/service_role|actor_staff_id\s*:|price_idr\s*:/);
});
