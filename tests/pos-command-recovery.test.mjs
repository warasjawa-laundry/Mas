import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as recovery from '../lib/pos/command-recovery.ts';

const request='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const order='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function fixture(role,response,authorized=true){
 const calls=[];const out={exports:{}};
 const client={rpc:async(name,args)=>{calls.push({name,args});return response}};
 const mocks={
  '@/lib/pos/command-recovery':recovery,
  '@/lib/pos/g4-server':{cashierRpcAccess:async permission=>{assert.ok(['order_create','payment_collect','refund_full','cash_entry'].includes(permission));return authorized?{client,tokens:{p_device_token:'synthetic-device',p_login_token:'synthetic-login'}}:null}},
  '@/lib/supabase/owner':{requireOwner:async()=>{if(!authorized)throw Error('reauth');return {supabase:client}}},
 };
 const file=`app/${role==='owner'?'admin':'kasir'}/pesanan/recovery-actions.ts`;
 runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,
  {exports:out.exports,module:out,require:name=>{assert.ok(name in mocks,name);return mocks[name]}});
 return {calls,invoke:out.exports[role==='owner'?'recoverOwnerOrder':'recoverCashierCommand']};
}

test('recovery storage scopes distinguish actor, role, operation and invoice',()=>{
 const key=recovery.commandRecoveryKey('cashier','actor-a','PAYMENT',order);
 for(const other of [
  recovery.commandRecoveryKey('cashier','actor-b','PAYMENT',order),
  recovery.commandRecoveryKey('owner','actor-a','PAYMENT',order),
  recovery.commandRecoveryKey('cashier','actor-a','FULL_REFUND',order),
  recovery.commandRecoveryKey('cashier','actor-a','PAYMENT',request),
 ])assert.notEqual(other,key);
 assert.equal(recovery.commandUuid.test(request),true);
 assert.equal(recovery.commandUuid.test('not-a-request'),false);
});

test('cashier command recovery reauthorizes, keeps NOT_FOUND inconclusive and sends only scoped lookup UUID',async()=>{
 const denied=fixture('cashier',{},false);
 assert.notEqual((await denied.invoke('PAYMENT',order,request)).confirmed,true);assert.equal(denied.calls.length,0);
 const a=fixture('cashier',{data:{found:false},error:null});
 const result=await a.invoke('PAYMENT',order,request);
 assert.notEqual(result.confirmed,true);assert.match(result.error,/mungkin masih berjalan/);
 assert.equal(a.calls[0].name,'laundry_pos_g4_command_result');
 assert.equal(a.calls[0].args.p_request_id,request);
 assert.deepEqual(Object.keys(a.calls[0].args).sort(),['p_device_token','p_login_token','p_request_id']);
});

test('cashier recovery requires matching operation, order and a committed result shape',async()=>{
 for(const data of [
  {found:true,operation:'FULL_REFUND',result:{order_id:order,payment_status:'REFUNDED'}},
  {found:true,operation:'PAYMENT',result:{order_id:request,payment_id:request}},
  {found:true,operation:'PAYMENT',result:{order_id:order}},
 ])assert.notEqual((await fixture('cashier',{data,error:null}).invoke('PAYMENT',order,request)).confirmed,true);
 const a=fixture('cashier',{data:{found:true,operation:'PAYMENT',result:{order_id:order,payment_id:request}},error:null});
 const result=await a.invoke('PAYMENT',order,request);
 assert.equal(result.confirmed,true);assert.equal(result.redirectTo,`/kasir/pesanan/${order}?saved=payment`);
});

test('owner order recovery checks live owner authorization and never confirms missing or unrelated results',async()=>{
 const denied=fixture('owner',{},false);await assert.rejects(denied.invoke(request),/reauth/);assert.equal(denied.calls.length,0);
 for(const data of [{found:false},{found:true,operation:'PAYMENT',result:{order_id:order}},{found:true,operation:'CREATE_ORDER',result:{order_id:'bad'}}])
  assert.notEqual((await fixture('owner',{data,error:null}).invoke(request)).confirmed,true);
 const a=fixture('owner',{data:{found:true,operation:'CREATE_ORDER',result:{order_id:order}},error:null});
 const result=await a.invoke(request);
 assert.equal(result.confirmed,true);assert.equal(result.redirectTo,`/admin/pesanan/${order}`);
 assert.equal(a.calls[0].name,'laundry_pos_owner_command_result');
 assert.deepEqual(Object.keys(a.calls[0].args),['p_request_id']);
});
