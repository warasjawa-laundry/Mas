export type Service={id:string;category:string;package_name:string;name:string;price_idr:number;unit:string;duration:string;duration_minutes?:number|null;position:number;is_visible:boolean;revision:number};
export type PublishedService=Omit<Service,"is_visible"|"revision">&{duration_package_code?:string};
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
 const minutes=form.get("duration_minutes");
 if(minutes!==null&&(typeof minutes!=="string"||(minutes!==""&&(!/^[1-9][0-9]{0,5}$/.test(minutes)||Number(minutes)>525600))))return null;
 return {category,package_name,name,unit,duration,price_idr:Number(price),position:Number(position),is_visible:form.get("is_visible")==="yes",
  ...(minutes===null?{}:{duration_minutes:minutes===""?null:Number(minutes)})};
}
export const formatPrice=(price:number,unit:string)=>"Rp"+new Intl.NumberFormat("id-ID").format(price)+"/"+unit;
export function serviceHours(service:{duration_minutes?:number|null;duration:string}){
 const minutes=service.duration_minutes;
 if(typeof minutes==='number'&&Number.isFinite(minutes)&&minutes>0){
  const hours=new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}).format(minutes/60);
  return (minutes%3===0?'':'Sekitar ')+hours+' jam';
 }
 const legacy=service.duration.trim().match(/^(\d+)(?:\s*[–-]\s*(\d+))?\s*(hari|jam|menit)$/i);
 if(!legacy)return 'Konfirmasi durasi';
 const factor=legacy[3].toLowerCase()==='hari'?24:legacy[3].toLowerCase()==='menit'?1/60:1;
 const format=(value:string)=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}).format(Number(value)*factor);
 return (legacy[3].toLowerCase()==='menit'&&Number(legacy[1])%3!==0?'Sekitar ':'')+format(legacy[1])+(legacy[2]?'–'+format(legacy[2]):'')+' jam';
}
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

