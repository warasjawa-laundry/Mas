import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

function page(file,grants){
 const calls=[],output={exports:{}};
 const jsx=(type,props)=>({type,props});
 const access={session:{staff_id:'qa',username:'MAS-2001',permissions:grants,write_enabled:true},tokens:{},client:{rpc:async()=>({data:{enabled:true,services:[],delivery_options:[{code:'NONE',amount_idr:0}]},error:null})}};
 const mocks={'react/jsx-runtime':{jsx,jsxs:jsx},'node:crypto':{randomUUID:()=> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},'next/navigation':{redirect:()=>{throw Error('REDIRECT')}},'@/lib/pos/g4-server':{cashierRpcAccess:async permission=>{calls.push(permission);return grants[permission]?access:null}},'@/lib/pos/cashier-permissions':{hasCashierGrant:(g,p)=>g[p]===true},'@/lib/pos/command-recovery':{commandRecoveryKey:()=> 'qa'},'../recovery-actions':{recoverCashierCommand:()=>{}},'./order-form':{OrderForm:()=>null},'./wizard.module.css':{default:{}},'next/link':()=>null};
 runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:output.exports,module:output,require:n=>mocks[n]??(n.startsWith('@/components/')?{default:()=>null}:assert.fail(n)),Date});
 return {render:()=>output.exports.default({searchParams:Promise.resolve({})}),calls};
}
test('new order page admits create-only staff and rejects view-only staff before reading catalog',async()=>{
 const create=page('app/kasir/pesanan/baru/page.tsx',{order_create:true});await create.render();assert.deepEqual(create.calls,['order_create']);
 const view=page('app/kasir/pesanan/baru/page.tsx',{order_view:true});await assert.rejects(view.render(),/REDIRECT/);
});
test('pilot blocks manual member point posting before any ledger RPC',async()=>{
 const calls=[],mod={exports:{}};
 const mocks={'next/navigation':{redirect:()=>{throw Error('REDIRECT')}},'@/lib/supabase/owner':{requireOwner:async()=>({supabase:{rpc:async name=>{calls.push(name);return {data:{pilot_test_only:true,write_enabled:true,finance_enabled:true},error:null}}}})}};
 runInNewContext(ts.transpileModule(readFileSync('app/admin/points/actions.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{module:mod,exports:mod.exports,require:n=>mocks[n]??assert.fail(n)});
 const data=new FormData();for(const [k,v] of Object.entries({memberId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',requestId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',amountIdr:'75000',description:'QA pilot guard'}))data.set(k,v);
 const result=await mod.exports.recordAmountVisit(data);
 assert.match(result.error,/uji/);assert.deepEqual(calls,['laundry_pos_display_context']);
});
test('pilot blocks granting and consuming real member promos before mutation RPCs',async()=>{
 const calls=[],mod={exports:{}};
 const mocks={'next/navigation':{redirect:()=>{throw Error('REDIRECT')}},'@/lib/supabase/owner':{requireOwner:async()=>({supabase:{rpc:async name=>{calls.push(name);return {data:{pilot_test_only:true},error:null}}}})}};
 runInNewContext(ts.transpileModule(readFileSync('app/admin/promotions/actions.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{module:mod,exports:mod.exports,require:n=>mocks[n]??assert.fail(n),Date});
 const data=new FormData();for(const [k,v] of Object.entries({memberId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',promoId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',requestId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',title:'QA promo guard',action:'USE'}))data.set(k,v);
 assert.match((await mod.exports.grantManualPromo(data)).error,/uji/);assert.match((await mod.exports.finishManualPromo(data)).error,/uji/);
 assert.deepEqual(calls,['laundry_pos_display_context','laundry_pos_display_context']);
});

 test('operational report identifies both directions of non-sale cash',async()=>{const {cashCategoryLabel}=await import('../lib/pos/ui-labels.ts');assert.equal(cashCategoryLabel('NON_SALE_IN'),'Kas masuk non-penjualan');assert.equal(cashCategoryLabel('NON_SALE_OUT'),'Kas keluar non-penjualan');});
