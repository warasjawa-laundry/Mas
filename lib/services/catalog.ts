export type Service={id:string;category:string;package_name:string;name:string;price_idr:number;unit:string;duration:string;position:number;is_visible:boolean;revision:number};
export type PublishedService=Omit<Service,"is_visible"|"revision">;
const clean=(v:FormDataEntryValue|null,max:number,required=false)=>{
 const s=typeof v==="string"?v.trim():"";
 return s.length<=max&&(!required||s.length>0)&&!(/[\x00-\x1f\x7f]/.test(s))?s:null;
};
export function parseService(form:FormData){
 const category=clean(form.get("category"),80,true),package_name=clean(form.get("package_name"),80);
 const name=clean(form.get("name"),100,true),unit=clean(form.get("unit"),24,true),duration=clean(form.get("duration"),80);
 const price=String(form.get("price_idr")??""),position=String(form.get("position")??"0");
 if(category===null||package_name===null||name===null||unit===null||duration===null||
 !/^(0|[1-9][0-9]{0,9})$/.test(price)||Number(price)>1_000_000_000||
 !/^[0-9]{1,4}$/.test(position))return null;
 return {category,package_name,name,unit,duration,price_idr:Number(price),position:Number(position),is_visible:form.get("is_visible")==="yes"};
}
export const formatPrice=(price:number,unit:string)=>"Rp"+new Intl.NumberFormat("id-ID").format(price)+"/"+unit;
export function groupServices(services:PublishedService[]){
 const categories=new Map<string,Map<string,PublishedService[]>>();
 for(const s of [...services].sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id))){
  if(!categories.has(s.category))categories.set(s.category,new Map());
  const groups=categories.get(s.category)!;
  if(!groups.has(s.package_name))groups.set(s.package_name,[]);
  groups.get(s.package_name)!.push(s);
 }
 return [...categories].map(([category,groups])=>({category,groups:[...groups].map(([name,items])=>({name,items}))}));
}

