import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(file,mocks){const module={exports:{}};runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,require:n=>mocks[n]??(n==='@/lib/pos/cashier-permissions'?{hasCashierGrant:()=>true}:require(n)),Date,URL,Response});return module.exports;}
for(const role of ['admin','kasir']){
 test(`${role} Excel export requests fresh V32 snapshot with inclusive WIB end and granularity`,async()=>{
  const calls=[];const client={rpc:async(name,args)=>{calls.push({name,args});return {data:{schema_version:32},error:null};}};
  const bounds={start:'2026-10-31T17:00:00.000Z',end:'2026-11-05T17:00:00.000Z',days:5};
  const route=load(`app/${role}/laporan/export/route.ts`,{
   '@/lib/supabase/owner':{getVerifiedOwner:async()=>({supabase:client})},
   '@/lib/pos/g4-server':{cashierRpcAccess:async grant=>{assert.equal(grant,'reports_view');return {client,tokens:{p_login_token:'synthetic'}};}},
   '@/lib/pos/g6-cash':{reportingPeriod:()=>({p_start:'legacy-start',p_end:'legacy-end'}),isReport:()=>true},
   '@/lib/pos/g6-import':{escapeCsv:String},
   '@/lib/pos/report-v32':{reportPeriodBounds:(start,end)=>{assert.equal(start,'2026-11-01');assert.equal(end,'2026-11-05');return bounds;}},
   '@/lib/pos/report-xlsx':{reportXlsxResponse:()=>new Response('old'),reportV32XlsxResponse:(data,start,end,granularity)=>{assert.equal(data.schema_version,32);assert.equal(start,'2026-11-01');assert.equal(end,'2026-11-05');assert.equal(granularity,'week');return new Response('xlsx');}}
  });
  const response=await route.GET(new Request(`https://example.invalid/${role}/laporan/export?format=xlsx&period=custom&start=2026-11-01&end=2026-11-05&granularity=week`));
  assert.equal(response.status,200);assert.equal(calls[0].name,'laundry_pos_v32_report');assert.equal(calls[0].args.p_start,bounds.start);assert.equal(calls[0].args.p_end,bounds.end);
 });
 test(`${role} Excel export rejects invalid granularity before database read`,async()=>{
  let reads=0;const client={rpc:async()=>{reads++;return {data:null,error:null};}};
  const route=load(`app/${role}/laporan/export/route.ts`,{
   '@/lib/supabase/owner':{getVerifiedOwner:async()=>({supabase:client})},'@/lib/pos/g4-server':{cashierRpcAccess:async()=>({client,tokens:{}})},
   '@/lib/pos/g6-cash':{reportingPeriod:()=>({p_start:'start',p_end:'end'})},'@/lib/pos/g6-import':{},'@/lib/pos/report-v32':{reportPeriodBounds:()=>({start:'start',end:'end'})},'@/lib/pos/report-xlsx':{reportXlsxResponse:()=>new Response('old')}
  });
  const response=await route.GET(new Request(`https://example.invalid/${role}/laporan/export?format=xlsx&period=custom&start=2026-11-01&end=2026-11-05&granularity=year`));
  assert.equal(response.status,400);assert.equal(reads,0);
 });
}

test('cashier CSV preserves legacy exclusive dates and redacts invoice and notes without order access',async()=>{
 const calls=[];const client={rpc:async(name,args)=>{calls.push({name,args});return {data:{orders_created:1,cash_in_idr:'10000',cash_out_idr:'0',noncash_in_idr:'0',noncash_out_idr:'0',receivables_as_of_end_idr:'0',net_pos_points:0,truncated:false,rows:[{category:'PAYMENT',type:'IN',method:'CASH',invoice_no:'PRIVATE-INVOICE',amount_idr:'10000',note:'PRIVATE CUSTOMER NOTE',occurred_at:'2026-11-01T01:00:00Z'}]},error:null};}};
 const route=load('app/kasir/laporan/export/route.ts',{
  '@/lib/pos/cashier-permissions':{hasCashierGrant:()=>false},
  '@/lib/pos/g4-server':{cashierRpcAccess:async()=>({client,tokens:{p_login_token:'synthetic'},session:{permissions:{reports_view:true}}})},
  '@/lib/pos/g6-cash':{reportingPeriod:(start,end)=>{assert.equal(start,'2026-11-01');assert.equal(end,'2026-11-05');return {p_start:'2026-10-31T17:00:00Z',p_end:'2026-11-04T17:00:00Z'};},isReport:()=>true},
  '@/lib/pos/g6-import':{escapeCsv:v=>v==null?'':String(v)},'@/lib/pos/report-v32':{},'@/lib/pos/report-xlsx':{}
 });
 const response=await route.GET(new Request('https://example.invalid/kasir/laporan/export?start=2026-11-01&end=2026-11-05'));
 assert.equal(response.status,200);const csv=await response.text();assert.match(csv,/date_end_exclusive/);assert.match(csv,/SUMMARY,1,2026-11-01,2026-11-05/);assert.doesNotMatch(csv,/PRIVATE/);assert.match(csv,/PAYMENT,IN,CASH,,10000,,2026-11-01T01:00:00Z/);assert.equal(calls[0].name,'laundry_pos_g6_report');
});

for(const role of ['admin','kasir']){
 test(`${role} direct export denies a missing report session`,async()=>{
  const route=load(`app/${role}/laporan/export/route.ts`,{'@/lib/supabase/owner':{getVerifiedOwner:async()=>null},'@/lib/pos/g4-server':{cashierRpcAccess:async()=>null},'@/lib/pos/g6-cash':{},'@/lib/pos/g6-import':{},'@/lib/pos/report-v32':{},'@/lib/pos/report-xlsx':{}});
  assert.equal((await route.GET(new Request(`https://example.invalid/${role}/laporan/export?format=xlsx`))).status,403);
 });
 test(`${role} oversized V32 snapshot fails instead of downloading partial rows`,async()=>{
  const client={rpc:async()=>({data:null,error:{message:'POS_REPORT_LIMIT'}})};
  const route=load(`app/${role}/laporan/export/route.ts`,{'@/lib/supabase/owner':{getVerifiedOwner:async()=>({supabase:client})},'@/lib/pos/g4-server':{cashierRpcAccess:async()=>({client,tokens:{}})},'@/lib/pos/g6-cash':{},'@/lib/pos/g6-import':{},'@/lib/pos/report-v32':{reportPeriodBounds:()=>({start:'start',end:'end'})},'@/lib/pos/report-xlsx':{}});
  const response=await route.GET(new Request(`https://example.invalid/${role}/laporan/export?format=xlsx&period=custom&start=2026-11-01&end=2026-11-05`));assert.equal(response.status,422);assert.match(await response.text(),/Persempit/);
 });
}
