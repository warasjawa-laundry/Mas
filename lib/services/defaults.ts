import {kiloPackages,curtainPrices} from "@/lib/site";
import type {PublishedService} from "./catalog";
let position=0;
export const defaultServices:PublishedService[]=[
 ...kiloPackages.flatMap(p=>p.items.map(item=>({category:"Laundry kiloan",package_name:p.name,name:item.label,price_idr:Number(item.price.split("/")[0].replace(/\D/g,"")),unit:"kg",duration:p.duration}))),
 ...curtainPrices.map(item=>({category:"Gorden",package_name:"",name:item.label,price_idr:Number(item.price.split("/")[0].replace(/\D/g,"")),unit:"meter",duration:""})),
].map(s=>({...s,id:"00000000-0000-4000-8000-"+String(++position).padStart(12,"0"),position:position*10}));

