import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const memberId='00000000-0000-4000-8000-000000000012';
const source=ts.transpileModule(readFileSync('app/admin/members/[id]/page.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
async function render(view){
 const calls=[];let historyLoads=0;
 const supabase={from(table){
  calls.push(table);
  if(table==='laundry_member_promotions'&&view!=='promo')throw Error('Hidden promos must not be requested');
  if(table==='laundry_point_rules'&&view!=='transaction')throw Error('Hidden rules must not be requested');
  const data=table==='laundry_members'?{id:memberId,display_name:'Synthetic',member_number:1,is_active:true}:table==='laundry_point_rules'?{tiers:[],revision:1}:[];
  const result={data,error:null,count:0};
  const q={select(){return q},eq(){return q},order(){return q},limit(){return q},maybeSingle(){return q},then(resolve,reject){return Promise.resolve(result).then(resolve,reject)}};return q;
 },rpc:async(name)=>{calls.push(name);return {data:[],error:null}}};
 const jsx=(type,props)=>({type:typeof type==='string'?type:'component',...props});
 const mocks={
  'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':()=>null,'node:crypto':{randomUUID:()=>memberId},'next/navigation':{notFound(){throw Error('not found')}},
  '@/lib/supabase/owner':{requireOwner:async()=>({supabase})},'@/lib/laundry/card':{memberNumber:()=> 'MJL-000001'},
  '@/app/admin/visits/actions':{correctOwnerVisit:()=>{}},'@/components/admin/member-task-nav':()=>null,'@/components/admin/amount-visit-form':()=>null,'@/components/admin/member-promotions':()=>null,
  '@/lib/admin/timing':{timeAdmin:(_name,fn)=>fn()},
  '@/lib/laundry/member-history':{historyPageNumber:()=>1,historyPageHref:()=>'',loadMemberHistory:async()=>{
   historyLoads++;assert.equal(view,'history','history cannot block transaction or promo entry');
   return {events:[],count:0,failed:false,amountsFailed:false,reversalsFailed:false,amounts:new Map(),corrected:new Set(),hasOlder:false};
  }},
 };
 const output={exports:{}};runInNewContext(source,{exports:output.exports,module:output,require:n=>{assert.ok(n in mocks,n);return mocks[n]},Intl,Date,Map,Set,Number,Promise});
 const tree=await output.exports.default({params:Promise.resolve({id:memberId}),searchParams:Promise.resolve(view==='transaction'?{}:{view})});
 return {calls,historyLoads,tree:JSON.stringify(tree)};
}
test('transaction entry needs five reads and never waits for history or promos',async()=>{
 const r=await render('transaction');assert.equal(r.calls.length,5);assert.equal(r.historyLoads,0);assert.match(r.tree,/Catat transaksi/);
});
test('promo tab requests promos without loading the ledger or point rules',async()=>{
 const r=await render('promo');assert.equal(r.calls.length,5);assert.equal(r.historyLoads,0);assert.ok(r.calls.includes('laundry_member_promotions'));assert.doesNotMatch(r.tree,/aria-label":"Catat transaksi/);
});
test('history tab loads its scoped ledger without requesting promos or rules',async()=>{
 const r=await render('history');assert.equal(r.calls.length,4);assert.equal(r.historyLoads,1);assert.match(r.tree,/Riwayat member/);
});
