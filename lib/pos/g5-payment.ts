/** Strict cashier form boundary; all authoritative amounts and permissions are rechecked by Postgres. */
export type G5PaymentInput={orderId:string;requestId:string;amountIdr:string;method:'CASH'|'NONCASH'|'TRANSFER'|'QRIS';expectedVersion:number};
export type G5RefundInput={orderId:string;requestId:string;reason:string;expectedVersion:number};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AMOUNT=/^[1-9][0-9]{0,9}$/;
const VERSION=/^[1-9][0-9]{0,14}$/;
function get(form:FormData,name:string):string|null{
 const value=form.get(name);
 return typeof value==='string'?value:null;
}
function common(form:FormData):{orderId:string;requestId:string;expectedVersion:number}|null{
 const orderId=get(form,'orderId'),requestId=get(form,'requestId'),rawVersion=get(form,'expectedVersion');
 if(!orderId||!UUID.test(orderId)||!requestId||!UUID.test(requestId)||!rawVersion||!VERSION.test(rawVersion))return null;
 const expectedVersion=Number(rawVersion);
 if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1)return null;
 return {orderId,requestId,expectedVersion};
}
export function parseG5Payment(form:FormData):G5PaymentInput|null{
 const base=common(form),amountIdr=get(form,'amountIdr'),method=get(form,'method');
 if(!base||!amountIdr||!AMOUNT.test(amountIdr)||BigInt(amountIdr)>BigInt("1000000000")||
 (method!=='CASH'&&method!=='NONCASH'&&method!=='TRANSFER'&&method!=='QRIS'))return null;
 return {...base,amountIdr,method};
}
export function parseG5Refund(form:FormData):G5RefundInput|null{
 const base=common(form),raw=get(form,'reason');
 const reason=raw?.trim();
 if(!base||!reason||reason.length<3||reason.length>300||/[\u0000-\u001f\u007f]/.test(reason))return null;
 return {...base,reason};
}
export function parseG5Shift(form:FormData):{orderId:string;requestId:string}|null{
 const orderId=get(form,'orderId'),requestId=get(form,'requestId');
 if(!orderId||!UUID.test(orderId)||!requestId||!UUID.test(requestId))return null;
 return {orderId,requestId};
}
