/** Only printed membership numbers, never arbitrary URLs or cashier IDs. */
export function normalizeMemberBarcode(value:unknown):string|null {
 if(typeof value!=="string"||value.length>24)return null;
 const match=/^(?:MJL-)?0*([1-9][0-9]{0,11})$/.exec(value.trim().toUpperCase());
 return match?match[1]:null;
}
