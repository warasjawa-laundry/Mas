/** G6 form and reporting boundaries: never trust browser amounts or timestamps. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONEY=/^(0|[1-9][0-9]{0,9})$/;
const POSITIVE=/^[1-9][0-9]{0,9}$/;
function value(form:FormData,key:string,max:number):string|null{
 const v=form.get(key);if(typeof v!=="string"||v.length>max||/[\x00-\x1f\x7f]/.test(v))return null;
 return v.trim();
}
export function parseCashEntry(form:FormData){
 const requestId=value(form,"requestId",36),direction=value(form,"direction",3),
  amountIdr=value(form,"amountIdr",10),reason=value(form,"reason",300);
 if(!requestId||!UUID.test(requestId)||!direction||!["IN","OUT"].includes(direction)||
    !amountIdr||!POSITIVE.test(amountIdr)||BigInt(amountIdr)>1000000000n||
    !reason||reason.length<3)return null;
 return {requestId,direction,amountIdr,reason};
}
export function parseCloseShift(form:FormData){
 const requestId=value(form,"requestId",36),countedIdr=value(form,"countedIdr",10),reason=value(form,"reason",300);
 if(!requestId||!UUID.test(requestId)||countedIdr===null||!MONEY.test(countedIdr)||
   BigInt(countedIdr)>1000000000n||reason===null)return null;
 return {requestId,countedIdr,reason};
}
const DAY=/^\d{4}-\d{2}-\d{2}$/;
export function reportingPeriod(start:string,end:string):{p_start:string;p_end:string}|null{
 if(!DAY.test(start)||!DAY.test(end))return null;
 const begin=new Date(start+"T00:00:00+07:00");
 const finish=new Date(end+"T00:00:00+07:00");
 if(Number.isNaN(begin.getTime())||Number.isNaN(finish.getTime())||
   new Date(begin.getTime()+7*3600_000).toISOString().slice(0,10)!==start||
   new Date(finish.getTime()+7*3600_000).toISOString().slice(0,10)!==end||
   finish.getTime()<=begin.getTime()||finish.getTime()-begin.getTime()>93*86400_000)return null;
 return {p_start:begin.toISOString(),p_end:finish.toISOString()};
}
export const isReport=(value:unknown):value is {
 schema_version:number;orders_created:number;cash_in_idr:string;cash_out_idr:string;
 noncash_in_idr:string;noncash_out_idr:string;receivables_as_of_end_idr:string;
 net_pos_points:number;truncated:boolean;
 rows:{type:string;method:string;category:string;amount_idr:string;invoice_no:string|null;occurred_at:string;note:string|null}[];
}=> typeof value==="object"&&value!==null&&
 (value as {schema_version?:unknown}).schema_version===1&&Array.isArray((value as {rows?:unknown}).rows);