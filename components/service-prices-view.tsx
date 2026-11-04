"use client";
import {useState} from "react";
import {formatPrice,groupServices,serviceHours,type PublishedService} from "@/lib/services/catalog";
export default function ServicePricesView({services}:{services:PublishedService[]}){
 const keyOf=(s:PublishedService)=>s.duration_package_code??'legacy:'+s.package_name;
 const packages=[...new Map(services.map(s=>[keyOf(s),{key:keyOf(s),name:s.package_name}])).values()];
 const [choice,setChoice]=useState(packages[0]?.key??'');
 const selected=packages.some(p=>p.key===choice)?choice:packages[0]?.key;
 const visible=services.filter(s=>keyOf(s)===selected);
 const names:Record<string,string>={REGULAR:'Reguler',EXPRESS:'Ekspres',FLASH:'Kilat'};
 return <div className="service-catalog">
  {packages.length>1&&<div className="catalog-packages" role="group" aria-label="Pilih paket layanan">{packages.map(p=><button type="button" key={p.key} aria-pressed={p.key===selected} onClick={()=>setChoice(p.key)}>{p.name||'Layanan lainnya'}{packages.some(other=>other.key!==p.key&&other.name===p.name)?' ('+(names[p.key]??p.key)+')':''}</button>)}</div>}
  {groupServices(visible).map(category=><section key={category.category} aria-label={category.category} className="service-category">
  <h3>{category.category}</h3><div className="price-grid">{category.groups.map(group=>{
   const duration=serviceHours(group.items[0]);
   const sameDuration=group.items.every(s=>serviceHours(s)===duration);
   return <article className="price-card" key={group.name}>
    {group.name&&<div className="price-card-top"><h4>{group.name}</h4>{sameDuration&&duration&&<span className="duration">{duration}</span>}</div>}
    <div className="price-rows">{group.items.map(s=><div className="price-row" key={s.id}><div><span>{s.name}</span>{(!sameDuration||!group.name)&&<small>{serviceHours(s)}</small>}</div><strong>{formatPrice(s.price_idr,s.unit)}</strong></div>)}</div>
   </article>;
  })}</div>
 </section>)}</div>;
}

