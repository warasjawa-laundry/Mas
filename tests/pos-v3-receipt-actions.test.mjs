import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {receipt} from './pos-v3-receipt.fixture.mjs';
import * as receiptModel from '../lib/pos/receipt.ts';
const req=createRequire(import.meta.url);
function actions({allow=true,testOrder=false}={}){
 const calls=[],grants=[],result={...receipt,is_test_order:testOrder},out={exports:{}};
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
 assert.equal(reply.error,'');assert.equal(reply.text,receiptModel.buildReceipt(reply.data));
 assert.deepEqual(grants,['receipt_print']);assert.deepEqual(calls.map(x=>x.name),['laundry_pos_print_receipt']);
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0].args)),{p_device_token:'device',p_login_token:'login',p_order_id:id});
});
test('WhatsApp retains its separate draft grant and common receipt content',async()=>{
 const {api,calls,grants}=actions();const reply=await api.prepareOrderReceipt('cashier',id,'NEW');assert.equal(reply.error,'');
 assert.deepEqual(grants,['whatsapp_draft']);assert.deepEqual(calls.map(x=>x.name),['laundry_pos_whatsapp_receipt']);assert.equal(calls[0].args.p_kind,'NEW');
 assert.equal(reply.text,receiptModel.buildReceipt(reply.data));
});
test('unauthorized or malformed print read never calls the database',async()=>{
 const {api,calls}=actions({allow:false});assert.ok((await api.preparePrintReceipt('cashier',id)).error);assert.ok((await api.preparePrintReceipt('cashier','bad-id')).error);assert.equal(calls.length,0);
});

