/** Server form boundary: only identifiers and quantities reach the authoritative SQL RPC. */
export type G4ItemInput = {service_id:string; quantity:string; revision:number};
export type G4OrderInput = {
  requestId:string;
  guestName:string|null;
  memberNumber:string|null;
  items:G4ItemInput[];
  perfume:string|null;
  notes:string|null;
  deliveryCode:string;
  deliveryRevision:number;
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const QTY=/^(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,3})?$/;
const MEMBER=/^[1-9][0-9]{0,11}$/;
function field(form:FormData,key:string,max:number):string|null{
  const value=form.get(key);
  if (typeof value!=="string"||value.length>max||/[\u0000-\u001f\u007f]/.test(value))return null;
  return value.trim();
}
export function parseG4OrderForm(form:FormData):G4OrderInput|null{
  const requestId=field(form,"requestId",36),kind=field(form,"kind",8);
  const name=field(form,"guestName",120),member=field(form,"memberNumber",12);
  const perfume=field(form,"perfume",80),notes=field(form,"notes",500);
  const deliveryCode=field(form,"deliveryCode",8),deliveryRevision=field(form,"deliveryRevision",12);
  const raw=field(form,"items",30000);
  if(!requestId||!UUID.test(requestId)||!raw||name===null||member===null||perfume===null||notes===null||
   !deliveryCode||!['NONE','FREE','NEAR','FAR'].includes(deliveryCode)||
   deliveryRevision===null||!/^([1-9][0-9]{0,11})$/.test(deliveryRevision)||
   !["","Akasia","Junjung Buih","Lavender","Ocean","Sakura"].includes(perfume))return null;
  if(kind!=="guest"&&kind!=="member")return null;
  if(kind==="guest" && (name.length<2||member!==""))return null;
  if(kind==="member" && (!MEMBER.test(member)||name!==""))return null;
  let items:unknown;
  try{items=JSON.parse(raw)}catch{return null}
  if(!Array.isArray(items)||items.length<1||items.length>30)return null;
  const parsed:G4ItemInput[]=[];
  for(const item of items){
    if(!item||typeof item!=="object"||Array.isArray(item))return null;
    const value=item as Record<string,unknown>;
    if(Object.keys(value).sort().join(",")!=="quantity,revision,service_id"||
      typeof value.service_id!=="string"||!UUID.test(value.service_id)||
      typeof value.quantity!=="string"||!QTY.test(value.quantity)||
      /^0(?:\.0{1,3})?$/.test(value.quantity)||
      typeof value.revision!=="number"||!Number.isSafeInteger(value.revision)||value.revision<1)return null;
    parsed.push({service_id:value.service_id,quantity:value.quantity,revision:value.revision});
  }
  return {requestId,guestName:kind==="guest"?name:null,memberNumber:kind==="member"?member:null,
    items:parsed,perfume:perfume||null,notes:notes||null,deliveryCode,deliveryRevision:Number(deliveryRevision)};
}
export const formatIdr=(value:string|number|bigint)=>`Rp${BigInt(value).toLocaleString("id-ID")}`;