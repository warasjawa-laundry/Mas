export type ReportGranularity = 'day' | 'week' | 'month';
export type ReportPeriodPreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';
export type ReportRow = Record<string, unknown>;
export class ReportV32Error extends Error {
 constructor(){super('Data ekspor tidak lengkap atau terlalu banyak. Persempit periode laporan.');this.name='ReportV32Error';}
}
function fail():never{throw new ReportV32Error();}
const DAY=86400000, WIB=7*3600000;
export function reportText(v:unknown):string{if(v==null)return '';if(typeof v!=='string'||v.length>32767)fail();return v;}
export function reportNumber(v:unknown,signed=false):number{
 if(typeof v!=='number'&&typeof v!=='string')fail();
 if(!(signed?/^-?\d+(\.\d{1,3})?$/:/^\d+(\.\d{1,3})?$/).test(String(v)))fail();
 const n=Number(v);if(!Number.isFinite(n)||Math.abs(n)>999999999999999)fail();return n;
}
export function reportRecord(v:unknown):ReportRow{if(!v||typeof v!=='object'||Array.isArray(v))fail();return v as ReportRow;}
function rows(v:unknown,limit:number):ReportRow[]{if(!Array.isArray(v)||v.length>limit)fail();return v.map(reportRecord);}
function isoDay(ms:number){return new Date(ms).toISOString().slice(0,10);}
function dayMs(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))fail();const ms=Date.parse(value+'T00:00:00Z');if(!Number.isFinite(ms)||isoDay(ms)!==value||value<'1900-03-01'||value>'9999-01-01')fail();return ms;}
export function reportInstant(value:unknown):number{const v=reportText(value);if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)||!/(?:Z|[+-]\d{2}:\d{2})$/.test(v))fail();dayMs(v.slice(0,10));const ms=Date.parse(v);if(!Number.isFinite(ms)||ms<Date.parse('1900-03-01')||ms>Date.parse('9999-01-01'))fail();return ms;}
export function reportPeriodBounds(startDate:string,endDate:string){const start=dayMs(startDate),last=dayMs(endDate),days=(last-start)/DAY+1;if(days<1||days>93)fail();return {start:new Date(start-WIB).toISOString(),end:new Date(last+DAY-WIB).toISOString(),days};}
export function resolveReportPeriod(preset:ReportPeriodPreset,now:Date|string=new Date()):{startDate:string;endDate:string}{
 const ms=now instanceof Date?now.getTime():Date.parse(now);if(!Number.isFinite(ms))fail();const today=dayMs(isoDay(ms+WIB)),d=new Date(today),monday=today-((d.getUTCDay()+6)%7)*DAY;
 let start=today,end=today;
 if(preset==='yesterday')start=end=today-DAY;
 else if(preset==='this_week'){start=monday;end=monday+6*DAY;}
 else if(preset==='last_week'){start=monday-7*DAY;end=monday-DAY;}
 else if(preset==='this_month'||preset==='last_month'){const month=d.getUTCMonth()-(preset==='last_month'?1:0);start=Date.UTC(d.getUTCFullYear(),month,1);end=Date.UTC(d.getUTCFullYear(),month+1,1)-DAY;}
 else if(preset!=='today')fail();
 return {startDate:isoDay(start),endDate:isoDay(end)};
}
export type ReportMetrics={order_count:number;order_total:number;service_item_count:number;payments:number;cash_payments:number;noncash_payments:number;refunds:number;expenses:number;net_receipts:number;quantities_milli:{kg:number;m:number;pcs:number}};
function metrics():ReportMetrics{return {order_count:0,order_total:0,service_item_count:0,payments:0,cash_payments:0,noncash_payments:0,refunds:0,expenses:0,net_receipts:0,quantities_milli:{kg:0,m:0,pcs:0}};}
export type PeriodMetrics=ReportMetrics&{startDate:string;endDate:string;partial:boolean;label:string};
function add(a:ReportMetrics,b:ReportMetrics){for(const key of ['order_count','order_total','service_item_count','payments','cash_payments','noncash_payments','refunds','expenses','net_receipts'] as const){a[key]+=b[key];if(!Number.isSafeInteger(a[key]))fail();}for(const unit of ['kg','m','pcs'] as const){a.quantities_milli[unit]+=b.quantities_milli[unit];if(!Number.isSafeInteger(a.quantities_milli[unit]))fail();}}
export function aggregatePosV32Report(value:unknown,granularity:ReportGranularity='day'){
 const data=reportRecord(value),complete=reportRecord(data.completeness);
 if(data.schema_version!==32||complete.complete!==true||complete.truncated!==false||data.truncated===true||data.timezone!=='Asia/Jakarta'||!['day','week','month'].includes(granularity)||typeof data.can_view_orders!=='boolean')fail();
 const start=reportInstant(data.start),end=reportInstant(data.end);if((start+WIB)%DAY!==0||(end+WIB)%DAY!==0)fail();const startDate=isoDay(start+WIB),endDate=isoDay(end+WIB-DAY);reportPeriodBounds(startDate,endDate);reportInstant(data.snapshot_at);
 const orders=rows(data.orders,1000),items=rows(data.items,30000),cash=rows(data.cash,5000),ids=new Map<string,ReportRow>(),invoices=new Set<string>(),itemIds=new Set<string>(),cashIds=new Set<string>();
 if(!data.can_view_orders&&(orders.length||items.length))fail();
 const periods:PeriodMetrics[]=[];
 for(let cursor=start+WIB;cursor<end+WIB;){const d=new Date(cursor),fullStart=granularity==='day'?cursor:granularity==='week'?cursor-((d.getUTCDay()+6)%7)*DAY:Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1),fullEnd=granularity==='day'?fullStart+DAY:granularity==='week'?fullStart+7*DAY:Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1),last=Math.min(fullEnd,end+WIB);periods.push({...metrics(),startDate:isoDay(cursor),endDate:isoDay(last-DAY),partial:cursor!==fullStart||last!==fullEnd,label:granularity==='month'?isoDay(fullStart).slice(0,7):`${isoDay(cursor)}${last-cursor>DAY?' s.d. '+isoDay(last-DAY):''}`});cursor=last;}
 const locate=(at:number)=>{if(at<start||at>=end)fail();const date=isoDay(at+WIB),p=periods.find(p=>date>=p.startDate&&date<=p.endDate);if(!p)fail();return p;};
 for(const o of orders){const id=reportText(o.id),invoice=reportText(o.invoice),at=reportInstant(o.created_at);if(!id||!invoice||ids.has(id)||invoices.has(invoice)||typeof o.created_in_period!=='boolean'||o.created_in_period!==(at>=start&&at<end)||typeof o.is_test_order!=='boolean')fail();ids.set(id,o);invoices.add(invoice);for(const field of ['subtotal','fees','discount','total','paid','remaining','refunded'])if(!Number.isSafeInteger(reportNumber(o[field])))fail();if(reportNumber(o.subtotal)+reportNumber(o.fees)-reportNumber(o.discount)!==reportNumber(o.total))fail();if(o.created_in_period){const p=locate(at);p.order_count++;p.order_total+=reportNumber(o.total);}}
 const services=new Map<string,{name:string;unit:string;item_count:number;quantity_milli:number;subtotal:number}>();
 const orderSubtotals=new Map<string,bigint>();
 for(const i of items){const id=reportText(i.id),orderId=reportText(i.order_id),o=ids.get(orderId),unit=reportText(i.unit),q=reportNumber(i.quantity_milli),price=reportNumber(i.price),subtotal=reportNumber(i.subtotal);if(!id||itemIds.has(id)||!o||i.invoice!==o.invoice||i.created_in_period!==o.created_in_period||!['kg','m','pcs'].includes(unit)||!Number.isSafeInteger(q)||q<=0||unit==='pcs'&&q%1000!==0||!Number.isSafeInteger(price)||!Number.isSafeInteger(subtotal))fail();if((BigInt(price)*BigInt(q)+BigInt(500))/BigInt(1000)!==BigInt(subtotal))fail();itemIds.add(id);orderSubtotals.set(orderId,(orderSubtotals.get(orderId)??BigInt(0))+BigInt(subtotal));if(i.created_in_period){const p=locate(reportInstant(o.created_at));p.quantities_milli[unit as 'kg'|'m'|'pcs']+=q;p.service_item_count++;const name=reportText(i.name),key=JSON.stringify([name,unit]),s=services.get(key)??{name,unit,item_count:0,quantity_milli:0,subtotal:0};s.item_count++;s.quantity_milli+=q;s.subtotal+=subtotal;services.set(key,s);}}
 for(const o of orders)if(!orderSubtotals.has(reportText(o.id))||orderSubtotals.get(reportText(o.id))!==BigInt(reportNumber(o.subtotal)))fail();
 const activity=data.period_activity==null?null:rows(data.period_activity,93);
 if(activity){const seen=new Set<string>();for(const row of activity){const date=reportText(row.date);dayMs(date);if(seen.has(date))fail();seen.add(date);const p=locate(dayMs(date)-WIB);if(!data.can_view_orders){p.order_count+=reportNumber(row.order_count);p.order_total+=reportNumber(row.order_total);p.service_item_count+=reportNumber(row.service_item_count);const q=reportRecord(row.quantities_milli);for(const unit of ['kg','m','pcs'] as const)p.quantities_milli[unit]+=reportNumber(q[unit]);}}}
 else if(!data.can_view_orders)fail();
 for(const c of cash){const id=reportText(c.id),at=reportInstant(c.at),direction=reportText(c.direction),amount=reportNumber(c.amount),category=reportText(c.category),classification=reportText(c.accounting_classification);if(!id||cashIds.has(id)||!['IN','OUT'].includes(direction)||!['CASH','NONCASH','TRANSFER','QRIS'].includes(reportText(c.method))||!['PAYMENT','REFUND','NON_SALE_IN','NON_SALE_OUT'].includes(category)||!['PAYMENT','REFUND','EXPENSE','EQUITY','TRANSFER','UNCLASSIFIED'].includes(classification)||!Number.isSafeInteger(amount)||amount<=0)fail();cashIds.add(id);if(c.order_id!=null){const o=ids.get(reportText(c.order_id));if(!o||c.invoice!==o.invoice)fail();}else if(c.invoice!=null&&c.invoice!=='')fail();const p=locate(at);if(category==='PAYMENT'){if(direction!=='IN'||classification!=='PAYMENT')fail();p.payments+=amount;if(c.method==='CASH')p.cash_payments+=amount;else p.noncash_payments+=amount;}else if(category==='REFUND'){if(direction!=='OUT'||classification!=='REFUND')fail();p.refunds+=amount;}else if(classification==='EXPENSE'){if(direction!=='OUT')fail();p.expenses+=amount;}}
 const totals=metrics();for(const p of periods){p.net_receipts=p.payments-p.refunds;add(totals,p);}
 if(data.summary!=null){const s=reportRecord(data.summary),q=reportRecord(s.quantities_milli);if(reportNumber(s.order_count)!==totals.order_count||reportNumber(s.order_total)!==totals.order_total||reportNumber(s.service_item_count)!==totals.service_item_count)fail();for(const unit of ['kg','m','pcs'] as const)if(reportNumber(q[unit])!==totals.quantities_milli[unit])fail();}
 const reconciliation=reportRecord(data.cash_reconciliation),checks=rows(reconciliation.physical_checks,1000);
 if(reconciliation.available===true){const opening=reportNumber(reconciliation.opening_cash,true),seed=reportNumber(reconciliation.opening_seed_in_period),closing=reportNumber(reconciliation.closing_cash,true),cashIn=cash.filter(c=>c.method==='CASH'&&c.direction==='IN').reduce((n,c)=>n+reportNumber(c.amount),0),cashOut=cash.filter(c=>c.method==='CASH'&&c.direction==='OUT').reduce((n,c)=>n+reportNumber(c.amount),0);if(opening+seed+cashIn-cashOut!==closing||cashIn!==reportNumber(reconciliation.cash_in)||cashOut!==reportNumber(reconciliation.cash_out))fail();}
 for(const c of checks){reportInstant(c.at);if(reportNumber(c.counted,true)-reportNumber(c.expected,true)!==reportNumber(c.difference,true))fail();}
 return {data,startDate,endDate,orders,items,cash,periods,totals,services:[...services.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.unit.localeCompare(b.unit)),reconciliation,checks};
}
