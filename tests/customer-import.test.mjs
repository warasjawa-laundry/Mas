import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {buildCustomerImport} from '../scripts/customer-import-sql.mjs';

const id='00000000-0000-4000-8000-000000000012';
const compiled=ts.transpileModule(readFileSync('app/admin/members/[id]/card/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
async function cardPage({rpcError=false,missing=true,imported=true,active=true}={}){
 const calls=[];const jsx=(type,props)=>({type:typeof type==='string'?type:'component',...props});
 const supabase={rpc:async(name)=>{calls.push(name);return {error:rpcError?{}:null,data:missing?[]:[{display_name:'Synthetic',member_number:1,token_ciphertext_hex:'encrypted'}]}},from(table){
  calls.push(table);const data=table==='laundry_members'?{display_name:'Synthetic',member_number:1,is_active:active}:imported?[{member_id:id}]:[];
  const q={select(){return q},eq(){return q},limit(){return q},maybeSingle(){return q},then(resolve){return Promise.resolve({data,error:null}).then(resolve)}};return q;
 }};
 const mocks={
  'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':()=>null,'node:crypto':{randomUUID:()=>id},'next/navigation':{notFound(){throw Error('NOT_FOUND')}},
  'qrcode':{toString:async()=>'<svg></svg>'},'@/lib/supabase/owner':{requireOwner:async()=>({supabase})},
  '@/lib/laundry/card':{memberNumber:()=> 'MJL-000001',decryptCardToken:()=> 'synthetic',publicCardOrigin:()=> 'https://example.invalid',cardIssuanceReady:()=>true},
  '@/components/admin/member-print-card':()=>null,'@/lib/site':{assets:{logo:'synthetic'}},'@/components/admin/print-card-button':()=>null,
  '@/app/admin/members/card/actions':{reissueOwnerCard:()=>{},issueImportedMemberCard:()=>{}},
 };
 const output={exports:{}};runInNewContext(compiled,{require:n=>{assert.ok(n in mocks,n);return mocks[n]},exports:output.exports,module:output,process:{env:{}}});
 const tree=await output.exports.default({params:Promise.resolve({id}),searchParams:Promise.resolve({})});
 return {tree:JSON.stringify(tree),calls};
}
test('imported member has an explicit first-card action; GET never creates card material',async()=>{
 const r=await cardPage();assert.match(r.tree,/Terbitkan Kartu/);assert.match(r.tree,/MJL-000001/);
 assert.deepEqual(r.calls,['laundry_owner_card_material','laundry_members','laundry_member_import_rows']);
});
test('inactive and nonimported members cannot use the first-card screen',async()=>{
 assert.doesNotMatch((await cardPage({active:false})).tree,/Terbitkan Kartu/);
 assert.doesNotMatch((await cardPage({imported:false})).tree,/Terbitkan Kartu/);
});
test('card lookup failure shows retry guidance and never becomes new issuance',async()=>{
 const r=await cardPage({rpcError:true});assert.match(r.tree,/Kartu belum dapat dimuat/);assert.equal(r.calls.length,1);
});
test('existing cards remain on the print flow with no new import lookups',async()=>{
 const r=await cardPage({missing:false});assert.match(r.tree,/Kartu Siap Cetak/);assert.doesNotMatch(r.tree,/Terbitkan Kartu/);assert.equal(r.calls.length,1);
});
test('source generator preserves duplicate names, null address, original invalid phone and safe quoting',()=>{
 const source=[{row:2,name:"O'Neil",raw_phone:'628123456789',phone:'+628123456789',valid_phone:true,address:null},{row:3,name:"O'Neil",raw_phone:'123',phone:null,valid_phone:false,address:'Synthetic'}];
 const sql=buildCustomerImport(source,'a'.repeat(64));assert.match(sql,/rollback;\n$/);assert.match(sql,/O''Neil/);assert.match(sql,/"phone_needs_review":true/);assert.match(sql,/"address":null/);
 assert.match(buildCustomerImport(source,'a'.repeat(64),{dryRun:false}),/commit;\n$/);
 assert.throws(()=>buildCustomerImport([...source,source[0]],'a'.repeat(64)),/source row/);
 assert.throws(()=>buildCustomerImport([{...source[0],phone:'123'}],'a'.repeat(64)),/normalized phone/);
});
