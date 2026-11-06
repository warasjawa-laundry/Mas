import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {receipt} from './pos-v3-receipt.fixture.mjs';
import * as receiptModel from '../lib/pos/receipt.ts';
const req=createRequire(import.meta.url);
function actions({allow=true,testOrder=false,invalidSnapshot=false}={}){
 const calls=[],grants=[],result={...receipt,is_test_order:testOrder,order_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',order_version:'2',payment_version:'1',snapshot_at:invalidSnapshot?null:'2026-11-06T08:00:00Z',service_subtotal:'71300',fees_idr:'0',discount_idr:'0',payments:[{amount_idr:'10000',received_at:'2026-11-06T08:00:00Z',receiver:'Kasir Kedua',method:'CASH'}],refunds:[]},out={exports:{}};
 if(testOrder)result.point_simulation={booked:false,total_idr:'71300',paid_idr:'10000',refunded_idr:'0',state:'PARTIAL',points:1,rule_available:true,program_year:2026,rule_revision:1,persisted_order:true};
 const source=ts.transpileModule(readFileSync('app/kasir/pesanan/receipt-actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const client={async rpc(name,args){calls.push({name,args});return {data:result,error:null};}};
 runInNewContext(source,{exports:out.exports,module:out,require:name=>({
  '@/lib/supabase/owner':{requireOwner:async()=>({supabase:client})},
  '@/lib/pos/g4-server':{cashierRpcAccess:async permission=>{grants.push(permission);return allow?{client,tokens:{p_device_token:'device',p_login_token:'login'}}:null;}},
  '@/lib/pos/command-recovery':req('../lib/pos/command-recovery.ts'),
  '@/lib/pos/receipt':receiptModel,
  '@/lib/pos/point-simulation':req('../lib/pos/point-simulation.ts'),
 }[name])});
 return {api:out.exports,calls,grants};
}
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('print reads require receipt_print and use read-only print RPC without WhatsApp grant',async()=>{
 const {api,calls,grants}=actions();const reply=await api.preparePrintReceipt('cashier',id);
 assert.equal(reply.error,'');assert.equal(reply.text,undefined);assert.equal(reply.data.order_version,'2');
 assert.deepEqual(grants,['receipt_print']);assert.deepEqual(calls.map(x=>x.name),['laundry_pos_v31_print_receipt']);
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0].args)),{p_device_token:'device',p_login_token:'login',p_order_id:id});
});
test('missing snapshot metadata fails closed for print and WhatsApp',async()=>{
 const {api}=actions({invalidSnapshot:true});assert.ok((await api.preparePrintReceipt('cashier',id)).error);assert.ok((await api.prepareOrderReceipt('cashier',id,'NEW')).error);
});
test('pilot print simulation comes from the same snapshot RPC without another read',async()=>{
 const {api,calls}=actions({testOrder:true});const reply=await api.preparePrintReceipt('cashier',id);
 assert.equal(reply.error,'');assert.equal(reply.data.point_simulation.state,'PARTIAL');assert.deepEqual(calls.map(x=>x.name),['laundry_pos_v31_print_receipt']);
});
test('WhatsApp retains its separate draft grant and common receipt content',async()=>{
 const {api,calls,grants}=actions();const reply=await api.prepareOrderReceipt('cashier',id,'NEW');assert.equal(reply.error,'');
 assert.deepEqual(grants,['whatsapp_draft']);assert.deepEqual(calls.map(x=>x.name),['laundry_pos_v31_whatsapp_receipt']);assert.equal(calls[0].args.p_kind,'NEW');
 assert.equal(reply.text,receiptModel.buildReceipt(reply.data));
});
test('unauthorized or malformed print read never calls the database',async()=>{
 const {api,calls}=actions({allow:false});assert.ok((await api.preparePrintReceipt('cashier',id)).error);assert.ok((await api.preparePrintReceipt('cashier','bad-id')).error);assert.equal(calls.length,0);
});

