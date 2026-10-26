import {formatPrice,groupServices,type PublishedService} from "@/lib/services/catalog";
export default function ServicePricesView({services}:{services:PublishedService[]}){
 return <div className="service-catalog">{groupServices(services).map(category=><section key={category.category} aria-label={category.category} className="service-category">
  <h3>{category.category}</h3><div className="price-grid">{category.groups.map(group=>{
   const duration=group.items[0].duration;
   const sameDuration=group.items.every(s=>s.duration===duration);
   return <article className="price-card" key={group.name}>
    {group.name&&<div className="price-card-top"><h4>{group.name}</h4>{sameDuration&&duration&&<span className="duration">{duration}</span>}</div>}
    <div className="price-rows">{group.items.map(s=><div className="price-row" key={s.id}><div><span>{s.name}</span>{(!sameDuration||!group.name)&&s.duration&&<small>{s.duration}</small>}</div><strong>{formatPrice(s.price_idr,s.unit)}</strong></div>)}</div>
   </article>;
  })}</div>
 </section>)}</div>;
}

