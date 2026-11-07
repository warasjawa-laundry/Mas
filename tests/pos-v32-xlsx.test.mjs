import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildPosV32ReportXlsx,reportV32XlsxResponse} from '../lib/pos/report-xlsx.ts';
import {resolveReportPeriod,reportPeriodBounds,aggregatePosV32Report} from '../lib/pos/report-v32.ts';

export function fixture(){
 const o={id:'o1',invoice:'0001',created_at:'2026-10-30T16:59:00Z',customer:'=HYPERLINK("evil")',creator:'Owner',created_in_period:true,total:'100000',subtotal:'100000',discount:'0',fees:'0',paid:'100000',refunded:'5000',remaining:'0',status:'PAID',is_test_order:true,customer_id:'c1'};
 const cash=[['dp','2026-10-30T16:59:00Z','IN','PAYMENT','30000'],['paid','2026-11-02T03:00:00Z','IN','PAYMENT','70000'],['refund','2026-11-05T03:00:00Z','OUT','REFUND','5000']].map(([id,at,direction,category,amount])=>({id,at,direction,category,amount,order_id:'o1',invoice:'0001',method:'CASH',accounting_classification:category,is_test_order:true}));
 return {schema_version:32,start:'2026-10-29T17:00:00Z',end:'2026-11-06T17:00:00Z',snapshot_at:'2026-11-07T04:00:00Z',timezone:'Asia/Jakarta',outlet:{name:'MAS JAWA LAUNDRY KRAKSAAN'},can_view_orders:true,balance_scope:'CURRENT',pilot_test_only:true,completeness:{complete:true,truncated:false},orders:[o],items:[['kg',1250,'6000','7500'],['m',2375,'8000','19000'],['pcs',3000,'24500','73500']].map(([unit,quantity_milli,price,subtotal],i)=>({id:'i'+i,order_id:'o1',invoice:'0001',name:'Cuci',package:'Reguler',unit,quantity_milli,price,subtotal,created_in_period:true})),cash,cash_reconciliation:{available:true,scope:'PERIOD_CASH_BOOK',opening_cash:'20000',opening_seed_in_period:'0',closing_cash:'115000',cash_in:'100000',cash_out:'5000',physical_checks:[],physical_scope:'OBSERVATION_TIME',status:'BELUM DIVERIFIKASI'}};
}
export function entries(buffer){const files={};let at=0;while(at+30<buffer.length&&buffer.readUInt32LE(at)===0x04034b50){const size=buffer.readUInt32LE(at+18),n=buffer.readUInt16LE(at+26),extra=buffer.readUInt16LE(at+28),start=at+30+n+extra;files[buffer.subarray(at+30,at+30+n).toString()]=buffer.subarray(start,start+size).toString();at=start+size;}return files;}
test('WIB inclusive periods, leap months, Monday weeks and 93 day cap',()=>{
 assert.deepEqual(resolveReportPeriod('today','2026-12-31T17:00:00Z'),{startDate:'2027-01-01',endDate:'2027-01-01'});
 assert.deepEqual(resolveReportPeriod('this_week','2026-11-01T05:00:00Z'),{startDate:'2026-10-26',endDate:'2026-11-01'});
 assert.deepEqual(resolveReportPeriod('last_month','2024-03-15T05:00:00Z'),{startDate:'2024-02-01',endDate:'2024-02-29'});
 assert.equal(reportPeriodBounds('2024-02-29','2024-02-29').start,'2024-02-28T17:00:00.000Z');
 assert.equal(reportPeriodBounds('2026-01-01','2026-04-03').days,93);
 for(const dates of [['2026-02-29','2026-03-01'],['2026-01-02','2026-01-01'],['2026-01-01','2026-04-04']])assert.throws(()=>reportPeriodBounds(...dates));
});
test('event aggregation separates crossmonth receipts, refunds, quantities, capital and transfers',()=>{
 const d=fixture();d.cash.push({id:'capital',at:'2026-11-02T03:00:00Z',direction:'IN',category:'NON_SALE_IN',method:'NONCASH',amount:'9000',accounting_classification:'EQUITY'},{id:'transfer',at:'2026-11-02T03:00:00Z',direction:'OUT',category:'NON_SALE_OUT',method:'NONCASH',amount:'7000',accounting_classification:'TRANSFER'});
 const a=aggregatePosV32Report(d,'month');assert.equal(a.totals.order_total,100000);assert.equal(a.totals.payments,100000);assert.equal(a.totals.refunds,5000);assert.equal(a.totals.expenses,0);assert.deepEqual(a.totals.quantities_milli,{kg:1250,m:2375,pcs:3000});
 assert.equal(a.periods[0].payments,30000);assert.equal(a.periods[1].payments,70000);assert.equal(a.periods[1].order_total,0);assert.equal(a.periods[1].net_receipts,65000);assert.equal(a.services.length,3);assert.equal(a.periods[0].partial,true);
});
test('six native tables, formatted numeric values and dates, freeze/filter/A4 and safe inline text',()=>{
 const f=entries(buildPosV32ReportXlsx(fixture(),{granularity:'week',generatedAt:'2026-11-07T04:10:00Z'}));
 const names=['Ringkasan','Rekap Periode','Daftar Nota','Rincian Layanan','Mutasi Keuangan','Rekonsiliasi Kas'];for(const name of names)assert.ok(f['xl/workbook.xml'].includes(name));
 assert.equal(Object.keys(f).filter(n=>/^xl\/tables\/table\d.xml$/.test(n)).length,6);
 for(let i=1;i<=6;i++){const s=f[`xl/worksheets/sheet${i}.xml`];for(const pattern of [/<pane .*state="frozen"/,/<autoFilter /,/<pageSetup .*paperSize="9"/,/<tableParts count="1"/,/<row /])assert.match(s,pattern);assert.ok(f[`xl/worksheets/_rels/sheet${i}.xml.rels`]);}
 assert.match(f['xl/worksheets/sheet3.xml'],/t="inlineStr"[^]*=HYPERLINK/);assert.match(f['xl/worksheets/sheet4.xml'],/<v>2.375<\/v>/);
 assert.match(f['xl/worksheets/sheet6.xml'],/BELUM DIVERIFIKASI/);assert.match(f['xl/worksheets/sheet1.xml'],/Piutang akhir periode belum tersedia/);
 assert.ok(!Object.values(f).some(s=>/<f[ >]|externalLink|vbaProject|TargetMode="External"/.test(s)));
 assert.match(f['xl/styles.xml'],/horizontal="right"/);assert.match(f['xl/styles.xml'],/#,##0.###/);assert.match(f['xl/workbook.xml'],/Print_Titles/);
});
test('empty report remains a complete six sheet workbook',()=>{const d=fixture();d.orders=[];d.items=[];d.cash=[];d.cash_reconciliation={available:false,physical_checks:[]};const a=aggregatePosV32Report(d);assert.equal(a.totals.payments,0);assert.equal(a.periods.length,8);assert.equal(Object.keys(entries(buildPosV32ReportXlsx(d))).filter(x=>/^xl\/tables\/table/.test(x)).length,6);});
test('reject duplicates, invalid references, mismatch flags, outside events, incomplete and malformed data',()=>{
 for(const edit of [d=>d.cash.push(d.cash[0]),d=>d.items.push(d.items[0]),d=>d.items.pop(),d=>d.items[0].price='999',d=>d.orders[0].fees='1',d=>d.items[0].invoice='bad',d=>d.items[0].created_in_period=false,d=>d.cash[0].at=d.end,d=>d.completeness.complete=false,d=>d.items[2].quantity_milli=1250,d=>d.cash[0].amount='-1',d=>d.cash[0].method='CRYPTO',d=>d.cash_reconciliation.closing_cash='1']){const d=fixture();edit(d);assert.throws(()=>buildPosV32ReportXlsx(d));}
});
test('safe export error is reviewable and never leaks source text',async()=>{const d=fixture();d.completeness.truncated=true;const r=reportV32XlsxResponse(d,'2026-10-30','2026-11-06');assert.equal(r.status,422);assert.match(await r.text(),/Persempit/);});
test('restricted report uses safe period aggregates without customer detail or lost receipts',()=>{
 const d=fixture();d.can_view_orders=false;d.orders=[];d.items=[];d.cash=d.cash.map(c=>({...c,order_id:null,invoice:null,payment_id:null}));
 d.summary={order_count:1,order_total:'100000',service_item_count:3,unique_customer_count:null,quantities_milli:{kg:1250,m:2375,pcs:3000}};
 d.period_activity=[{date:'2026-10-30',...d.summary}];
 const a=aggregatePosV32Report(d,'month');assert.equal(a.totals.order_total,100000);assert.equal(a.totals.payments,100000);assert.equal(a.periods[0].order_count,1);
 const files=entries(buildPosV32ReportXlsx(d));assert.ok(!JSON.stringify(files).includes('HYPERLINK'));assert.match(files['xl/worksheets/sheet3.xml'],/dibatasi oleh izin/);assert.match(files['xl/worksheets/sheet1.xml'],/Pelanggan unik[^]*BELUM TERSEDIA/);
 d.summary.order_count=2;assert.throws(()=>buildPosV32ReportXlsx(d));
});
test('opening seed is distinct from receipts and physical count remains an observation',()=>{
 const d=fixture();d.cash_reconciliation.opening_seed_in_period='1000';d.cash_reconciliation.closing_cash='116000';
 d.cash_reconciliation.physical_checks=[{id:'check',at:'2026-11-07T03:00:00Z',owner:'Owner',expected:'116000',counted:'115500',difference:'-500',reason:'Selisih dihitung'}];
 const a=aggregatePosV32Report(d);assert.equal(a.totals.payments,100000);const s=entries(buildPosV32ReportXlsx(d))['xl/worksheets/sheet6.xml'];assert.match(s,/Saldo pembukaan laci dalam periode/);assert.match(s,/waktu observasi/);assert.match(s,/<v>-500<\/v>/);
 d.cash_reconciliation.physical_checks[0].difference='0';assert.throws(()=>buildPosV32ReportXlsx(d));
});
test('month lengths, year boundary and exactly midnight WIB avoid duplicate buckets',()=>{
 for(const [now,last] of [['2023-02-15','2023-02-28'],['2024-02-15','2024-02-29'],['2026-04-15','2026-04-30'],['2026-01-15','2026-01-31']])assert.equal(resolveReportPeriod('this_month',now+'T00:00:00Z').endDate,last);
 assert.deepEqual(resolveReportPeriod('last_week','2027-01-04T00:00:00Z'),{startDate:'2026-12-28',endDate:'2027-01-03'});
 const d=fixture();d.cash[0].at='2026-10-30T17:00:00Z';const a=aggregatePosV32Report(d);assert.equal(a.periods[0].payments,0);assert.equal(a.periods[1].payments,30000);assert.equal(a.periods.length,8);
 const s=entries(buildPosV32ReportXlsx(d))['xl/worksheets/sheet2.xml'];assert.match(s,/r="B8" s="12"><v>/);
});
test('backend half-up line rounding is checked without binary multiplication errors',()=>{
 const d=fixture();d.orders[0]={...d.orders[0],subtotal:'1',total:'1'};d.items=[{...d.items[0],quantity_milli:500,price:'1',subtotal:'1'}];assert.equal(aggregatePosV32Report(d).totals.order_total,1);
 d.items[0].subtotal='0';assert.throws(()=>buildPosV32ReportXlsx(d));
});
test('unknown test mode and unclassified historical money stay explicit',()=>{
 const d=fixture();d.pilot_test_only=undefined;d.orders[0].is_test_order=false;d.cash=d.cash.map(c=>({...c,is_test_order:false}));d.cash.push({id:'historic',at:'2026-11-02T03:00:00Z',direction:'OUT',category:'NON_SALE_OUT',amount:'250',method:'NONCASH',accounting_classification:'UNCLASSIFIED'});
 const a=aggregatePosV32Report(d);assert.equal(a.totals.expenses,0);const s=entries(buildPosV32ReportXlsx(d))['xl/worksheets/sheet1.xml'];assert.match(s,/Status mode belum dipastikan/);assert.match(s,/Mutasi historis belum terklasifikasi/);
});
