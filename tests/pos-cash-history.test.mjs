import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as history from '../lib/pos/cash-history.ts';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const req=createRequire(import.meta.url),id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
for(const role of ['admin','kasir'])test(`${role} cash page resolves a selected historical ledger entry outside the recent list`,async()=>{
 const calls=[],output={exports:{}};
 const client={rpc:async(name,args)=>{calls.push({name,args});if(name==='laundry_pos_v3_cash')return {data:{automatic_cash:true,entries:[],expected_cash_idr:'0'}};if(name==='laundry_pos_cash_entry_detail')return {data:{id,amount_idr:'100',direction:'IN',category:'PAYMENT',can_view_order:true}};return {data:null};}};
 const jsx=(type,props)=>({type,props}),panel=()=>null;
 const mocks={'react/jsx-runtime':{jsx,jsxs:jsx},'node:crypto':{randomUUID:()=>id},'next/link':()=>null,'next/navigation':{redirect:p=>{throw Error(p);}},'@/lib/supabase/owner':{requireOwner:async()=>({supabase:client,user:{id}})},'@/lib/pos/g4-server':{cashierRpcAccess:async()=>({client,tokens:{p_login_token:'synthetic'},session:{staff_id:id,permissions:{},write_enabled:true}})},'@/lib/pos/cashier-permissions':{hasCashierGrant:()=>false},'@/components/pos/context-notice':{default:()=>null,readDisplayContext:()=>null},'@/components/pos/cash-panel':{default:panel},'@/components/pos/pos-workspace':()=>null,'@/components/pos/reconcile-cash':()=>null,'@/lib/pos/command-recovery':{commandRecoveryKey:()=>id},'../pesanan/operations-actions':{},'./actions':{},'../pesanan/recovery-actions':{},'../pesanan/orders.module.css':{default:{}}};
 mocks['../pesanan/operations-actions']={postOwnerCash:()=>{},recoverOwnerOperation:()=>{},reconcileOwnerCash:()=>{}};
 mocks['@/lib/pos/cash-history']=history;
 mocks['../pesanan/recovery-actions']={recoverCashierCommand:()=>{}};
 runInNewContext(ts.transpileModule(readFileSync(`app/${role}/kas/page.tsx`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:output,exports:output.exports,require:n=>mocks[n]??req(n),Date});
 const tree=await output.exports.default({searchParams:Promise.resolve({entry:id})});
 assert.equal(calls.some(c=>c.name==='laundry_pos_cash_entry_detail'&&c.args.p_entry_id===id),true);
 function find(n){if(!n||typeof n!=='object')return null;if(n.type===panel)return n;for(const c of [n.props?.children].flat(Infinity)){const r=find(c);if(r)return r;}return null;}
 assert.equal(find(tree).props.overview.entries[0].id,id);
});

test('historical selection stays bounded and never duplicates or accepts another returned ID',()=>{
 const overview={entries:Array.from({length:80},(_,i)=>({id:'row-'+i}))};
 const selected={id};
 assert.equal(history.includeCashEntry(overview,id,{data:selected}).overview.entries.length,81);
 assert.equal(history.includeCashEntry({entries:[selected]},id,{data:selected}).overview.entries.length,1);
 for(const response of [{data:{id:'wrong'}},{data:null},{data:selected,error:{message:'denied'}}])assert.equal(history.includeCashEntry(overview,id,response).overview,overview);
 assert.equal(history.includeCashEntry(overview,'bad',null).overview,overview);
});

test('cashier action rejects forged sensitive categories before a database write',async()=>{
 for(const categoryCode of ['CAPITAL','CASH_TRANSFER']){
  let writes=0;const module={exports:{}};
  const mocks={'next/cache':{revalidatePath:()=>{}},'next/navigation':{},'@/lib/pos/g4-server':{cashierRpcAccess:async()=>({client:{rpc:async()=>{writes++;}},tokens:{}})},'@/lib/pos/g6-cash':{parseStructuredCashEntry:()=>({categoryCode})}};
  runInNewContext(ts.transpileModule(readFileSync('app/kasir/kas/actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,require:n=>mocks[n]??req(n)});
  const result=await module.exports.postNonSaleCash(new FormData());assert.match(result.error,/Owner/);assert.equal(writes,0);
 }
});

test('cash-only UI hides quantities even if an old unfiltered DTO contains them',()=>{
 const module={exports:{}};
 const mocks={'next/link':{default:p=>createElement('a',p)},'@/components/admin/recoverable-form':()=>null,'@/components/admin/pending-submit':()=>null,'./disclosure':()=>null,'./cash-entry-fields':()=>null,'@/lib/pos/g4-order':{formatIdr:v=>'Rp'+v},'@/app/kasir/pesanan/orders.module.css':{default:{}}};
 runInNewContext(ts.transpileModule(readFileSync('components/pos/cash-panel.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,require:n=>mocks[n]??req(n),Date});
 const html=renderToStaticMarkup(createElement(module.exports.default,{role:'cashier',mayEdit:false,canFinance:false,overview:{opening_idr:'0',cash_in_idr:'100',expected_cash_idr:'100',cash_out_idr:'0',entries:[{can_view_order:false,id,amount_idr:'100',direction:'IN',category:'PAYMENT',method:'CASH',occurred_at:'2026-11-06T01:00:00Z',item_count:7,quantity_summary:'9,999 kg',order_id:id}]}}));
 assert.equal(html.includes('9,999'),false);assert.equal(html.includes('7 layanan'),false);assert.equal(html.includes('Lihat Rincian'),false);
});
