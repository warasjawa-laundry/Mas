"use client";
import {useState} from 'react';
export default function LegacyServiceSelector({code,services}:{code:string;services:{id:string;name:string;package_name:string;price_idr:number;revision:number}[]}){
 const [id,setId]=useState('');const selected=services.find(s=>s.id===id);
 return <><label>Gunakan record katalog lama (opsional)<select name={'existing-'+code} value={id} onChange={e=>setId(e.target.value)}>
  <option value="">Buat tarif paket baru</option>{services.map(s=><option key={s.id} value={s.id}>{s.name} · {s.package_name||'Tanpa paket'} · Rp{s.price_idr.toLocaleString('id-ID')}</option>)}
 </select></label><input type="hidden" name={'existing-revision-'+code} value={selected?.revision??0}/>
 <small>Record terpilih dipetakan tanpa mengubah rincian nota lama. Isi harga resmi paket sebelum menyimpan.</small></>;
}
