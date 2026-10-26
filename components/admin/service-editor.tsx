"use client";
import {useActionState} from "react";
import {formatPrice,type Service} from "@/lib/services/catalog";
import {saveService} from "@/app/admin/settings/services/actions";
import PendingSubmit from "@/components/admin/pending-submit";
type Props={service:Partial<Service>;newId?:string;categories:string[]};
export default function ServiceEditor({service:s,newId,categories}:Props){
 const id=s.id??newId!;
 const [state,action,pending]=useActionState(saveService,{error:""});
 return <form action={action} className="service-editor admin-form">
  {state.error&&<p className="admin-error" role="alert">{state.error}</p>}
  <fieldset className="service-fields" disabled={pending}>
  <input type="hidden" name="id" value={id}/><input type="hidden" name="revision" value={s.revision??0}/>
  <label htmlFor={"category-"+id}>Kategori *</label><input id={"category-"+id} name="category" list={"categories-"+id} defaultValue={s.category} required maxLength={80} placeholder="Contoh: Cuci sepatu"/>
  <datalist id={"categories-"+id}>{categories.map(c=><option value={c} key={c}/>)}</datalist>
  <label htmlFor={"package-"+id}>Paket (opsional)</label><input id={"package-"+id} name="package_name" defaultValue={s.package_name} maxLength={80} placeholder="Contoh: Reguler"/>
  <label htmlFor={"name-"+id}>Nama layanan *</label><input id={"name-"+id} name="name" defaultValue={s.name} required maxLength={100} placeholder="Contoh: Cuci sneakers"/>
  <div className="service-price-fields"><div><label htmlFor={"price-"+id}>Harga (Rp) *</label><input id={"price-"+id} name="price_idr" type="number" inputMode="numeric" min={0} max={1000000000} step={1} required defaultValue={s.price_idr} placeholder="35000"/></div>
  <div><label htmlFor={"unit-"+id}>Satuan *</label><input id={"unit-"+id} name="unit" required maxLength={24} defaultValue={s.unit} placeholder="kg, pasang, m²"/></div></div>
  <label htmlFor={"duration-"+id}>Estimasi pengerjaan (opsional)</label><input id={"duration-"+id} name="duration" defaultValue={s.duration} maxLength={80} placeholder="Contoh: 2–3 hari"/>
  <label htmlFor={"position-"+id}>Urutan tampil</label><input id={"position-"+id} name="position" type="number" min={0} max={9999} step={1} required defaultValue={s.position??100}/>
  <small>Angka lebih kecil tampil lebih awal. Layanan dalam kategori dan paket yang sama dikelompokkan otomatis.</small>
  <label className="service-visible"><input type="checkbox" name="is_visible" value="yes" defaultChecked={s.is_visible??true}/><span>Tampilkan di homepage</span></label>
  {s.id&&<p className="member-note">Saat ini: {formatPrice(s.price_idr!,s.unit!)}. Menyimpan perubahan langsung memperbarui harga yang ditampilkan.</p>}
  <PendingSubmit label={s.id?"Simpan perubahan":"Tambahkan layanan"}/>
 </fieldset></form>;
}

