import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as history from "../lib/laundry/member-history.ts";

const memberId="00000000-0000-4000-8000-000000000012";
const source=readFileSync("app/admin/members/[id]/page.tsx","utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
async function render({ amountsFailed=false,reversalsFailed=false,hasOlder=false,page="1",corrected=false }={}) {
  const jsx=(type,props)=>({type:typeof type==="string"?type:"component",...props});
  const q={select(){return q},eq(){return q},order(){return q},limit(){return q},maybeSingle(){return q},
    then(resolve){return Promise.resolve({data:{id:memberId,display_name:"Synthetic fixture",member_number:1,is_active:true,tiers:[]},count:1,error:null}).then(resolve)}};
  const mocks={
    "react/jsx-runtime":{jsx,jsxs:jsx},"next/link":()=>null,"node:crypto":{randomUUID:()=>memberId},
    "next/navigation":{notFound(){throw Error("NOT_FOUND")}},
    "@/lib/supabase/owner":{requireOwner:async()=>({supabase:{from:()=>q,rpc:async()=>({data:[],error:null})}})},
    "@/lib/laundry/card":{memberNumber:()=>"MJL-000001"},
    "@/app/admin/visits/actions":{correctOwnerVisit:()=>{}},
    "@/components/admin/member-task-nav":()=>null,"@/components/admin/amount-visit-form":()=>null,"@/components/admin/member-promotions":()=>null,
    "@/lib/admin/timing":{timeAdmin:(_name,fn)=>fn()},
    "@/lib/laundry/member-history":{...history,loadMemberHistory:async()=>({
      events:[{id:"event-1",event_type:"ADD",occurred_at:"2026-10-17T01:00:00Z"}],
      count:65,failed:false,amountsFailed,reversalsFailed,amounts:new Map(),
      corrected:new Set(corrected?["event-1"]:[]),hasOlder,
    })},
  };
  const output={exports:{}};
  runInNewContext(compiled,{require:name=>{assert.ok(name in mocks,name);return mocks[name]},exports:output.exports,module:output,Intl,Date,Map,Set,Number,Array,Promise});
  const tree=await output.exports.default({params:Promise.resolve({id:memberId}),searchParams:Promise.resolve({historyPage:page})});
  return JSON.stringify(tree);
}

test("failed amounts render unavailable, never the false legacy zero-point label",async()=>{
  const result=await render({amountsFailed:true});
  assert.match(result,/Nominal dan poin transaksi belum dapat dimuat/);
  assert.doesNotMatch(result,/Catatan lama tanpa nominal · 0 poin/);
  assert.match(await render(),/Catatan lama tanpa nominal · 0 poin/);
});
test("uncertain or confirmed VOID cannot expose another cancellation form",async()=>{
  const unavailable=await render({reversalsFailed:true});
  assert.match(unavailable,/Status pembatalan belum dapat dimuat/);
  assert.doesNotMatch(unavailable,/Konfirmasi Pembatalan/);
  assert.doesNotMatch(await render({corrected:true}),/Konfirmasi Pembatalan/);
  assert.match(await render(),/Konfirmasi Pembatalan/);
});
test("older history page opens and offers scoped navigation in both directions",async()=>{
  const result=await render({hasOlder:true,page:"2"});
  assert.match(result,/"open":true/);
  assert.match(result,/Halaman riwayat transaksi/);
  assert.ok(result.includes(history.historyPageHref(memberId,1)));
  assert.ok(result.includes(history.historyPageHref(memberId,3)));
});
