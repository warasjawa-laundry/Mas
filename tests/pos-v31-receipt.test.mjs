import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../lib/pos/receipt.ts';
import {receipt} from './pos-v3-receipt.fixture.mjs';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const payment={amount_idr:'10000',received_at:'2026-11-06T08:00:00Z',receiver:'Kasir Kedua',method:'QRIS'};
const snapshot=()=>({...structuredClone(receipt),is_test_order:false,order_id:id,order_version:'2',payment_version:'1',snapshot_at:'2026-11-06T09:00:00Z',service_subtotal:'71300',fees_idr:'0',discount_idr:'0',payments:[payment],refunds:[]});
test('shared validation accepts mixed units and confirmed receiver distinct from creator',()=>{
 const r=snapshot();assert.equal(model.validateReceiptData(r,{requireSnapshot:true}),r);
 assert.equal(r.actor,'Kasir Uji');assert.equal(r.payments[0].receiver,'Kasir Kedua');
 assert.equal(model.buildWhatsAppReceipt(r),model.buildReceipt(r));
});
test('processing is a valid current work status and contact drafts stay unverified',()=>{
 const r={...snapshot(),work_status:'PROCESSING',contact_draft:{phone:'+6280000000000',address:'Alamat QA',verified_at:null}};
 assert.equal(model.validateReceiptData(r,{requireSnapshot:true}).work_status,'PROCESSING');
 assert.throws(()=>model.validateReceiptData({...r,contact_draft:{...r.contact_draft,verified_at:r.snapshot_at}}));
});
test('shared validation rejects fractional pcs, unsupported units and wrong rounding or subtotal',()=>{
 for(const change of [{quantity_milli:1250,unit:'pcs'},{unit:'meter'},{quantity_milli:1250.5},{subtotal:'7499'}]){
  const r=snapshot();Object.assign(r.items[0],change);assert.throws(()=>model.validateReceiptData(r));
 }
 const r=snapshot();r.service_subtotal='71301';assert.throws(()=>model.validateReceiptData(r));
});
test('shared validation rounds each item to whole rupiah before summing',()=>{
 const r={...snapshot(),items:[{...receipt.items[0],quantity_milli:2375,price:'1234',subtotal:'2931'}],total:'2931',service_subtotal:'2931',paid:'0',remaining:'2931',status:'UNPAID',payments:[]};
 assert.equal(model.validateReceiptData(r).total,'2931');
});
test('small fractional and large quantities keep exact integer rupiah arithmetic',()=>{
 for(const [quantity,subtotal] of [[750,'926'],[999999999,'1233999999']]){
  const r={...snapshot(),items:[{...receipt.items[0],quantity_milli:quantity,price:'1234',subtotal}],total:subtotal,service_subtotal:subtotal,paid:'0',remaining:subtotal,status:'UNPAID',payments:[]};
  assert.equal(model.validateReceiptData(r).total,subtotal);
 }
});
test('collected snapshots cannot claim unpaid status or omit collection time',()=>{
 const r={...snapshot(),work_status:'COLLECTED'};assert.throws(()=>model.validateReceiptData(r,{requireSnapshot:true}));
});
test('collected then fully refunded snapshots remain readable as history, without a new handover draft',()=>{
 const r={...snapshot(),work_status:'COLLECTED',collected_at:'2026-11-06T08:30:00Z',paid:'71300',refunded:'71300',remaining:'0',status:'REFUNDED',payments:[{...payment,amount_idr:'71300'}],refunds:[{...payment,amount_idr:'71300'}]};
 assert.equal(model.validateReceiptData(r,{requireSnapshot:true}),r);
 assert.match(model.buildWhatsAppReceipt(r),/Status : REFUND/);
 assert.throws(()=>model.validateReceiptData({...r,collected_at:null},{requireSnapshot:true}));
 assert.throws(()=>model.validateReceiptData({...r,kind:'COLLECTED'},{requireSnapshot:true}));
});
test('cancelled pilot snapshots validate with their actual cancelled point simulation state',()=>{
 const r={...snapshot(),is_test_order:true,paid:'0',remaining:'0',status:'CANCELLED',work_status:'CANCELLED',payments:[],point_simulation:{booked:false,total_idr:'71300',paid_idr:'0',refunded_idr:'0',state:'CANCELLED',points:0,rule_available:true,program_year:2026,rule_revision:1,persisted_order:true}};
 assert.equal(model.validateReceiptData(r,{requireSnapshot:true}),r);
 assert.match(model.buildWhatsAppReceipt(r),/Status : DIBATALKAN/);
 assert.match(model.buildWhatsAppReceipt(r),/Simulasi poin dibatalkan/);
});
test('snapshot requires versions, confirmed financial records and matching status',()=>{
 for(const mutate of [r=>delete r.snapshot_at,r=>delete r.order_version,r=>r.payments=[],r=>r.payments[0]={...payment,amount_idr:'9999'},r=>r.status='PAID',r=>r.actor='Owner '+id,r=>r.invoice='',r=>r.work_status='UNKNOWN']){
  const r=snapshot();mutate(r);assert.throws(()=>model.validateReceiptData(r,{requireSnapshot:true}));
 }
});
test('full refund and cancellation have no new debt; receipt history is preserved',()=>{
 const r={...snapshot(),paid:'71300',refunded:'71300',remaining:'0',status:'REFUNDED',payments:[{...payment,amount_idr:'71300'}],refunds:[{...payment,amount_idr:'71300'}]};
 assert.equal(model.validateReceiptData(r,{requireSnapshot:true}).remaining,'0');
 assert.match(model.buildWhatsAppReceipt(r),/Refund : Rp71.300/);
 const cancelled={...snapshot(),paid:'0',remaining:'0',status:'CANCELLED',work_status:'CANCELLED',payments:[]};
 assert.equal(model.validateReceiptData(cancelled,{requireSnapshot:true}).remaining,'0');
});
