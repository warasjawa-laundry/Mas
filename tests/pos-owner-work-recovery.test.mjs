import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const order='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const request='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function recovery(command){
 const module={exports:{}};
 const mocks={
  'next/cache':{revalidatePath:()=>{}},
  '@/lib/supabase/owner':{requireOwner:async()=>({supabase:{rpc:async()=>({data:command,error:null})}})},
  '@/lib/pos/g5-payment':{},'@/lib/pos/g6-cash':{},
  '@/lib/pos/command-recovery':{commandUuid:/^[0-9a-f-]{36}$/i},
 };
 const source=readFileSync(new URL('../app/admin/pesanan/operations-actions.ts',import.meta.url),'utf8');
 runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,
  {module,exports:module.exports,require:name=>mocks[name]});
 return module.exports.recoverOwnerOperation;
}
test('Owner terminal work command can be reconciled after reload',async()=>{
 const recover=recovery({found:true,operation:'SET_WORK',result:{order_id:order,work_status:'COLLECTED'}});
 const result=await recover('SET_WORK',order,request);
 assert.equal(result.confirmed,true);
 assert.equal(result.redirectTo,`/admin/pesanan/${order}?saved=1`);
});
test('Owner cancellation can be reconciled after detail stops showing cancelled order',async()=>{
 const recover=recovery({found:true,operation:'CANCEL',result:{order_id:order,lifecycle_status:'CANCELLED'}});
 const result=await recover('CANCEL',order,request);
 assert.equal(result.confirmed,true);assert.equal(result.redirectTo,'/admin?saved=cancelled');
});
test('Owner recovery rejects a different order and incomplete work result',async()=>{
 for(const result of [{order_id:request,work_status:'READY'},{order_id:order,work_status:'QUEUED'}]){
  const actual=await recovery({found:true,operation:'SET_WORK',result})('SET_WORK',order,request);
  assert.notEqual(actual.confirmed,true);assert.ok(actual.error);
 }
});
