import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const payload={requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',guestName:'Tamu QA',memberNumber:null,items:[],perfume:null,notes:null};
function action(path,rpcName){
 const out={exports:{}};const calls=[];
 const client={rpc:async(name,args)=>{calls.push({name,args});return {data:null,error:{message:'network'}}}};
 const access={client,tokens:{},session:{write_enabled:true}};
 const mocks={
  'next/cache':{revalidatePath:()=>{}},'next/navigation':{redirect:to=>{throw Error('REDIRECT '+to)}},
  '@/lib/pos/g4-server':{cashierRpcAccess:async()=>access},
  '@/lib/supabase/owner':{requireOwner:async()=>({supabase:client})},
  '@/lib/pos/g4-order':{parseG4OrderForm:()=>payload},
  '@/lib/pos/g6-cash':{parseCashEntry:()=>({...payload,direction:'OUT',amountIdr:'5000',reason:'Beli plastik'}),parseCloseShift:()=>({...payload,countedIdr:'0',reason:'Hitung QA'})},
  '@/lib/pos/g5-payment':{parseG5Payment:()=>payload,parseG5Refund:()=>({...payload,orderId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',expectedVersion:2,reason:'Koreksi nota'}),parseG5Shift:()=>payload},
 };
 runInNewContext(ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:out.exports,module:out,URLSearchParams,require:n=>{if(!(n in mocks))throw Error(n);return mocks[n]}});
 return {invoke:out.exports[rpcName],calls};
}
test('cashier unknown order commit returns to mounted form with original UUID',async()=>{
 const a=action('app/kasir/pesanan/actions.ts','createCashierOrder');
 const result=await a.invoke(new FormData());
 assert.equal(typeof result.error,'string');assert.ok(result.error.length>10);
 assert.equal(a.calls[0].args.p_request_id,payload.requestId);
});
for(const [path,fn] of [['app/kasir/kas/actions.ts','postNonSaleCash'],['app/kasir/kas/actions.ts','closeCashRegister'],['app/kasir/pesanan/payment-actions.ts','refundCashierOrder']])test(fn+' preserves exact request on unknown result',async()=>{
 const a=action(path,fn);const result=await a.invoke(new FormData());
 assert.equal(typeof result.error,'string');assert.equal(a.calls[0].args.p_request_id,payload.requestId);
});
test('owner create uses owner RPC and same recovery without a cashier identity',async()=>{
 const a=action('app/admin/pesanan/actions.ts','createOwnerOrder');
 assert.equal(typeof a.invoke,'function');
 const result=await a.invoke(new FormData());
 assert.equal(typeof result.error,'string');
 assert.equal(a.calls[0].name,'laundry_pos_owner_create_order');
 assert.equal(a.calls[0].args.p_request_id,payload.requestId);
 assert.equal('p_device_token' in a.calls[0].args,false);
});
