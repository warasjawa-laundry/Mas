export type PublicTransaction = {
 event_id:string; occurred_at:string; amount_idr:number|null;
 program_year:number|null; awarded_points:number; cancelled:boolean;
};
export type PublicHistory = {transactions:PublicTransaction[]; has_older:boolean; page:number};
export function memberHistoryPage(value?:string):number {
 const n=Number(value??1);return Number.isSafeInteger(n)&&n>=1&&n<=10000?n:1;
}
export function memberHistoryYear(value:string|undefined,current:number):number {
 const n=Number(value);return Number.isSafeInteger(n)&&n>=2026&&n<=2100?n:current;
}
export function memberHistoryHref(base:string,year:number,page:number):string {
 return base+"?"+new URLSearchParams({year:String(year),page:String(page)}).toString()+"#transaction-history";
}
