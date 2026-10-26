import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {createHash} from "node:crypto";
import ts from "typescript";
import {memberHistoryPage,memberHistoryYear,memberHistoryHref} from "../lib/laundry/public-history.ts";
const compiled=ts.transpileModule(readFileSync("app/k/[token]/page.tsx","utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
async function render({search={},historyError=false,balancesError=false,unknown=false}={}){
 const calls=[];const token="A".repeat(43);
 const results={laundry_public_member_name:{data:"Nama Contoh",error:null},laundry_public_card_progress:{data:unknown?[]:[{member_number:4,visit_count:2,promos:[]}],error:null},
  laundry_public_point_balances:{data:[{program_year:2026,points_total:5},{program_year:2027,points_total:0}],error:balancesError?{}:null},
  laundry_public_transaction_history:{data:{transactions:[],has_older:true,page:1},error:historyError?{}:null}};
 const mocks={"./progress.css":{},"node:crypto":{createHash},"next/navigation":{notFound(){throw Error("NOT_FOUND")}},
  "@supabase/supabase-js":{createClient:()=>({rpc:async(name,args)=>{calls.push([name,args]);return results[name]}})},
  "@/lib/laundry/card":{validCardToken:s=>s.length===43,memberNumber:()=>"MJL-000004"},
  "@/lib/laundry/program-years":{currentProgramYear:()=>2026},
  "@/lib/supabase/qa-preview-isolation":{assertQaPreviewIsolation:()=>{}},
  "@/lib/laundry/public-history":{memberHistoryPage,memberHistoryYear,memberHistoryHref},
  "@/components/member-progress-view":()=>null,"react/jsx-runtime":{jsx:(_type,props)=>props},};
 const out={exports:{}};
 runInNewContext(compiled,{require:n=>{assert.ok(n in mocks,n);return mocks[n]},exports:out.exports,module:out,process:{env:{SUPABASE_URL:"https://example.invalid",SUPABASE_PUBLISHABLE_KEY:"fixture"}},Promise,Array,Set,Number});
 return {props:await out.exports.default({params:Promise.resolve({token}),searchParams:Promise.resolve(search)}),calls};
}
test("customer defaults to the current WIB year instead of prioritizing empty future points",async()=>{
 const {props,calls}=await render();assert.equal(props.name,"Nama Contoh");assert.equal(props.year,2026);assert.equal(props.points,5);assert.equal(props.years[0].year,2026);
 const [,args]=calls.find(([name])=>name==="laundry_public_transaction_history");
 assert.equal(args.p_year,2026);assert.equal(args.p_page,1);assert.match(args.p_digest_hex,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(args).includes("A".repeat(43)));
});
test("history failures remain unavailable rather than displaying a false empty ledger",async()=>{
 assert.equal((await render({historyError:true})).props.historyFailed,true);
 assert.equal((await render({balancesError:true})).props.balancesFailed,true);
 await assert.rejects(render({unknown:true}),/NOT_FOUND/);
});
test("history pagination preserves the selected year and never generates an out-of-bound next page",async()=>{
 const {props}=await render({search:{year:"2027",page:"2"}});
 assert.equal(props.year,2027);assert.equal(props.points,0);assert.match(props.previousHref,/year=2027&page=1#transaction-history$/);assert.match(props.nextHref,/page=3/);
 assert.equal((await render({search:{page:"10000"}})).props.nextHref,undefined);
 for(const bad of ["0","10001","1.5","NaN"])assert.equal(memberHistoryPage(bad),1);
 assert.equal(memberHistoryYear("2025",2026),2026);assert.equal(memberHistoryYear("2027",2026),2027);
});
