import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as xlsx from '../lib/pos/report-xlsx.ts';
import * as cash from '../lib/pos/g6-cash.ts';
const {buildReportXlsx}=xlsx;

const order={id:'o1',invoice:'NOTA-1',created_at:'2026-11-01T18:30:00Z',customer:'=HYPERLINK("evil")',creator:'Owner',created_in_period:true,total:'71300',paid:'30000',refunded:'1000',remaining:'41300',status:'PARTIAL',is_test_order:false};
function fixture(){return {schema_version:3,start:'2026-11-01T17:00:00Z',end:'2026-11-02T17:00:00Z',balance_scope:'CURRENT',summary:{truncated:false},orders:[order,{...order,id:'old',invoice:'NOTA-OLD',created_in_period:false,total:'90000'}],items:[['kg',1250,'7500'],['m',2350,'18800'],['pcs',3000,'45000']].map(([unit,quantity_milli,subtotal])=>({order_id:'o1',invoice:'NOTA-1',name:'Layanan',package:'Reguler',quantity_milli,unit,price:'6000',subtotal,created_in_period:true})),cash:[{id:'p1',order_id:'o1',invoice:'NOTA-1',customer:'A',at:'2026-11-01T18:30:00Z',direction:'IN',category:'PAYMENT',method:'CASH',amount:'10000',actor:'Kasir',note:'DP'},{id:'p2',order_id:'old',invoice:'NOTA-OLD',at:'2026-11-02T03:00:00Z',direction:'IN',category:'PAYMENT',method:'NONCASH',amount:'20000',actor:'Owner',note:'Pelunasan'},{id:'r',order_id:'o1',invoice:'NOTA-1',at:'2026-11-02T04:00:00Z',direction:'OUT',category:'REFUND',method:'CASH',amount:'1000',actor:'Owner',note:'Refund'}]};}
function entries(buffer){const files={};let at=0;while(buffer.readUInt32LE(at)===0x04034b50){const size=buffer.readUInt32LE(at+18),n=buffer.readUInt16LE(at+26),extra=buffer.readUInt16LE(at+28);const name=buffer.subarray(at+30,at+30+n).toString();const start=at+30+n+extra;files[name]=buffer.subarray(start,start+size).toString();at=start+size;}return files;}
test('four sheets keep amounts, quantities, independent cash events and CURRENT balances',()=>{
 const f=entries(buildReportXlsx(fixture()));
 for(const name of ['Ringkasan','Daftar Nota','Rincian Layanan','Mutasi Kas'])assert.ok(f['xl/workbook.xml'].includes(name));
 const summary=f['xl/worksheets/sheet1.xml'];
 assert.match(summary,/Kondisi terkini/);assert.match(summary,/<v>71300<\/v>/);assert.match(summary,/<v>30000<\/v>/);assert.match(summary,/<v>1\.25<\/v>/);assert.match(summary,/<v>2\.35<\/v>/);assert.match(summary,/<v>3<\/v>/);
 assert.equal((f['xl/worksheets/sheet3.xml'].match(/<row /g)||[]).length,4);
 assert.equal((f['xl/worksheets/sheet4.xml'].match(/<row /g)||[]).length,4);
 assert.match(f['xl/worksheets/sheet2.xml'],/t="inlineStr"[^]*=HYPERLINK/);assert.ok(!Object.values(f).some(x=>x.includes('<f>')));
 assert.match(f['xl/styles.xml'],/WIB/);assert.match(f['xl/styles.xml'],/0\.###/);
 const dateSerial=Number(f['xl/worksheets/sheet4.xml'].match(/r="A2" s="4"><v>([^<]+)/)[1]);
 assert.equal(new Date((dateSerial-25569)*86400000).toISOString(),'2026-11-02T01:30:00.000Z');
 assert.match(f['xl/worksheets/sheet3.xml'],/r="D2" s="3"><v>1.25<\/v>/);
 for(let i=1;i<=4;i++)assert.match(f[`xl/worksheets/sheet${i}.xml`],/<autoFilter/);
});
function route(role,authorized=true,error=null){
 const calls=[];const rpc=async(name,args)=>{calls.push({name,args});return {data:fixture(),error};};const tokens={p_device_token:'device',p_login_token:'login'};
 const mocks={'@/lib/supabase/owner':{getVerifiedOwner:async()=>authorized?{supabase:{rpc}}:null},'@/lib/pos/g4-server':{cashierRpcAccess:async(permission)=>{assert.equal(permission,'reports_view');return authorized?{client:{rpc},tokens}:null;}},'@/lib/pos/g6-cash':cash,'@/lib/pos/g6-import':{escapeCsv:v=>String(v)},'@/lib/pos/report-xlsx':xlsx};
 const module={exports:{}};runInNewContext(ts.transpileModule(readFileSync(`app/${role}/laporan/export/route.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{exports:module.exports,module,require:n=>mocks[n],URL,Response,Date});
 return {get:module.exports.GET,calls};
}
test('owner and cashier Excel routes authorize before calling the read-only reporting RPC',async()=>{
 for(const role of ['admin','kasir']){
  const url='https://example.test/laporan/export?format=xlsx&start=2026-11-02&end=2026-11-03';
  const denied=route(role,false);assert.equal((await denied.get(new Request(url))).status,403);assert.equal(denied.calls.length,0);
  const allowed=route(role);const response=await allowed.get(new Request(url));assert.equal(response.status,200);assert.match(response.headers.get('Content-Type'),/spreadsheetml/);assert.match(response.headers.get('Cache-Control'),/no-store/);assert.equal(allowed.calls.length,1);assert.equal(allowed.calls[0].name,'laundry_pos_v3_report');
  if(role==='kasir')assert.equal(allowed.calls[0].args.p_login_token,'login');
  const bad=route(role);assert.equal((await bad.get(new Request(url.replace('2026-11-03','2026-11-01')))).status,400);assert.equal(bad.calls.length,0);
 }
});
test('invalid exports return a safe 422 response without leaking content',async()=>{
 const response=xlsx.reportXlsxResponse({...fixture(),truncated:true},'2026-11-02','2026-11-03');assert.equal(response.status,422);assert.match(await response.text(),/Persempit/);
});

test('database report cap asks for a smaller range rather than a service outage',async()=>{
 for(const role of ['admin','kasir']){
  const capped=route(role,true,{message:'POS_REPORT_LIMIT'});
  const response=await capped.get(new Request('https://fixture.invalid/'+role+'/laporan/export?format=xlsx&start=2026-11-02&end=2026-11-03'));
  assert.equal(response.status,422);assert.match(await response.text(),/Persempit periode/);
 }
});

test('pilot Excel summaries cannot be mistaken for real receipts',()=>{
 const f=entries(buildReportXlsx({...fixture(),pilot_test_only:true}));assert.match(f['xl/worksheets/sheet1.xml'],/MODE UJI/);assert.match(f['xl/worksheets/sheet1.xml'],/Bukan bukti penerimaan uang nyata/);
});
test('incomplete, excessive and malformed exports fail instead of yielding partial workbooks',()=>{
 for(const change of [{truncated:true},{items:null},{schema_version:1},{balance_scope:'END'}])assert.throws(()=>buildReportXlsx({...fixture(),...change}));
 assert.throws(()=>buildReportXlsx({...fixture(),summary:{truncated:true}}));
 assert.throws(()=>buildReportXlsx({...fixture(),cash:Array(10001).fill(fixture().cash[0])}));
 assert.throws(()=>buildReportXlsx({...fixture(),orders:[{...order,total:'9007199254740992'}]}));
});
test('cash categories distinguish expenses, capital, transfers and unclassified history without duplicating money',()=>{
 const d=fixture();
 for(const [id,code,classification,amount] of [['e','PACKAGING','EXPENSE','5000'],['c','CAPITAL','EQUITY','6000'],['t','CASH_TRANSFER','TRANSFER','7000'],['l',null,null,'8000']])d.cash.push({id,at:order.created_at,direction:'OUT',category:'NON_SALE_OUT',method:'CASH',amount,expense_category_code:code,expense_category_label:code==='PACKAGING'?'Plastik/kemasan':code,accounting_classification:classification});
 const files=entries(buildReportXlsx(d)),s=files['xl/worksheets/sheet1.xml'],m=files['xl/worksheets/sheet4.xml'];
 assert.match(s,/Pengeluaran operasional terklasifikasi/);assert.match(s,/Plastik\/kemasan/);assert.match(s,/Belum dikategorikan/);
 assert.match(m,/Kode kategori/);assert.match(m,/EQUITY/);assert.match(m,/TRANSFER/);
 assert.equal((m.match(/<row /g)||[]).length,8);
 assert.equal((files['xl/workbook.xml'].match(/<sheet /g)||[]).length,4);
});
test('export rejects mismatched invoice references and fractional pcs instead of presenting conflicting records',()=>{
 for(const change of [d=>{d.items[0].invoice='NOTA-WRONG';},d=>{d.cash[0].invoice='NOTA-WRONG';},d=>{d.items[2].quantity_milli=2375;},d=>{d.items[0].created_in_period=false;}]){const d=fixture();change(d);assert.throws(()=>buildReportXlsx(d));}
});
