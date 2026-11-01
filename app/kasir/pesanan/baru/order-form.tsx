"use client";
import { useMemo,useState } from "react";
import { calculateOrderTotals } from "@/lib/pos/money";
import { posUnitFromCatalog } from "@/lib/pos/catalog-units";
import { formatIdr } from "@/lib/pos/g4-order";
import { createCashierOrder } from "../actions";
import { CashierQrScanner } from "./cashier-qr-scanner";
import { MemberNamePicker } from "./member-name-picker";
import { DurationSheet } from "./duration-sheet";
import {ALL_DURATIONS,durationOptions,servicesForDuration} from "@/lib/pos/g7-catalog";
import styles from "./wizard.module.css";

export type CatalogService={id:string;category:string;package_name:string;name:string;price_idr:number;unit:string;duration:string;revision:number};
const money=(n:string|number|bigint)=>formatIdr(n);
const steps=["Pelanggan","Durasi","Layanan","Konfirmasi"];

export function OrderForm({services,requestId,canWrite,canLookup}:{services:CatalogService[];requestId:string;canWrite:boolean;canLookup:boolean}){
 const [step,setStep]=useState(0);
 const [customerType,setCustomerType]=useState<"guest"|"member">("guest");
 const [name,setName]=useState("");
 const [member,setMember]=useState("");
 const [scannedName,setScannedName]=useState("");
 const [quantities,setQuantities]=useState<Record<string,string>>({});
 const [duration,setDuration]=useState(ALL_DURATIONS);
 const [perfume,setPerfume]=useState("");
 const [notes,setNotes]=useState("");
 const options=useMemo(()=>durationOptions(services),[services]);
 const available=useMemo(()=>servicesForDuration(services,duration),[services,duration]);
 const chosen=useMemo(()=>available.filter(s=>(quantities[s.id]??"")!==""),[available,quantities]);
 const quote=useMemo(()=>{
   if(!chosen.length||chosen.length>30)return null;
   try{return calculateOrderTotals(chosen.map(s=>({priceIdr:String(s.price_idr),quantity:quantities[s.id],unit:posUnitFromCatalog(s.unit)})))}
   catch{return null}
 },[chosen,quantities]);
 const customerValid=customerType==="guest"?name.trim().length>=2:/^[1-9][0-9]{0,11}$/.test(member);
 const items=JSON.stringify(chosen.map(s=>({service_id:s.id,quantity:quantities[s.id],revision:Number(s.revision)})));
 function changeQuantity(id:string,value:string){setQuantities(prev=>({...prev,[id]:value}))}
 function inc(id:string){
   const s=services.find(x=>x.id===id);if(!s)return;
   const cur=quantities[id]||"0";
   try{const n=BigInt(cur.split(".")[0]||"0")+BigInt(1); if(n<=BigInt(1000000))changeQuantity(id,String(n));}catch{changeQuantity(id,"1")}
 }
 function dec(id:string){
   const cur=quantities[id];if(!cur)return;
   try{const n=BigInt(cur.split(".")[0]||"0")-BigInt(1);changeQuantity(id,n>BigInt(0)?String(n):"")}catch{changeQuantity(id,"")}
 }
 return <div className={styles.form}>
  <nav className={styles.steps} aria-label="Langkah pemesanan">
   {steps.map((label,i)=><span key={label} className={i===step?styles.active:""}>{i+1}. {label}</span>)}
  </nav>
  {step===0&&<section className={styles.panel} aria-labelledby="customer-title">
   <h2 id="customer-title">Pilih pelanggan</h2>
   <p className={styles.help}>Pilih pelanggan seperti di Binatu. Member lama bisa dipilih lewat nomor atau scan QR kartu Mas Jawa.</p>
   <div className={styles.segment}>
    <label><input type="radio" checked={customerType==='guest'} onChange={()=>setCustomerType('guest')}/> Pelanggan umum</label>
    <label><input type="radio" checked={customerType==='member'} onChange={()=>setCustomerType('member')}/> Member MJL</label>
   </div>
   {customerType==='guest'?<label className={styles.field}>Nama pelanggan<input autoComplete="off" value={name} onChange={e=>setName(e.target.value)} maxLength={120} placeholder="Nama pelanggan" /></label>:
    <><label className={styles.field}>Nomor member<input autoComplete="off" inputMode="numeric" value={member} onChange={e=>{setMember(e.target.value.replace(/\D/g,'').slice(0,12));setScannedName("")}} maxLength={12} placeholder="Nomor member pada kartu" /></label>
     {canLookup&&<MemberNamePicker disabled={false} onPick={row=>{setMember(row.memberNumber);setScannedName(row.displayName)}}/>}
     {canLookup&&<CashierQrScanner disabled={false} onMember={(number,name)=>{setMember(number);setScannedName(name)}}/>}
     {scannedName&&<p className={styles.scanned} role="status">Member ditemukan: <strong>{scannedName}</strong> · MJL-{member.padStart(6,"0")}. Periksa identitas sebelum lanjut.</p>}</>}
   <p className={styles.help}>Data pelanggan akan diverifikasi ulang oleh database saat nota dibuat. Scan kartu tidak pernah menambah poin.</p>
  </section>}
  {step===1&&<section className={styles.panel} aria-labelledby="duration-title-step">
   <h2 id="duration-title-step">Pilih durasi</h2>
   <p className={styles.help}>Katalog Mas Jawa memiliki tarif berbeda untuk layanan dengan durasi berbeda. Pilih durasi berdasarkan layanan yang tersedia.</p>
   <DurationSheet options={options} value={duration} onSelect={value=>{setDuration(value);setQuantities({})}}/>
   <p className={styles.help}>Durasi hanya menyaring layanan berkatalog. Estimasi tanggal selesai belum diterbitkan otomatis.</p>
  </section>}
  {step===2&&<section className={styles.panel} aria-labelledby="services-title">
   <h2 id="services-title">Pilih layanan</h2><p className={styles.help}>Jumlah kg/m bisa sampai tiga desimal. Gunakan +/− atau ketik angka tepat.</p>
   {available.length===0?<p className={styles.help}>Tidak ada layanan untuk pilihan durasi ini.</p>:<div className={styles.services}>
    {available.map(s=><div key={s.id} className={styles.service}>
     <div className={styles.serviceInfo}><strong>{s.name}</strong><small>{s.category}{s.package_name?` · ${s.package_name}`:""} · {s.duration||"Reguler"}</small>
     <span>{money(s.price_idr)} / {s.unit}</span></div>
     <div className={styles.quantity}><button type="button" aria-label={`Kurangi ${s.name}`} onClick={()=>dec(s.id)}>−</button>
     <input aria-label={`Jumlah ${s.name}`} inputMode="decimal" placeholder="0" value={quantities[s.id]??""} onChange={e=>changeQuantity(s.id,e.target.value.slice(0,12))} />
     <button type="button" aria-label={`Tambah ${s.name}`} onClick={()=>inc(s.id)}>+</button></div>
    </div>)}
   </div>}
  </section>}
  {step===3&&<section className={styles.panel} aria-labelledby="summary-title">
   <h2 id="summary-title">Konfirmasi pesanan</h2>
   <p><strong>{customerType==='guest'?name:`Member MJL #${member}`}</strong></p>
   <div className={styles.summary}>{chosen.map((s,i)=><div key={s.id}><span>{s.name} — {quantities[s.id]} {s.unit}</span><strong>{quote?money(quote.items[i].lineTotalIdr):"—"}</strong></div>)}</div>
   <div className={styles.presetGroup} role="group" aria-label="Pilihan parfum">
    <strong>Pilihan parfum (opsional)</strong>
    <div className={styles.presetButtons}>
     {["Tanpa parfum","Melati","Lavender","Mawar"].map(p=><button key={p} type="button"
       aria-pressed={perfume===(p==="Tanpa parfum"?"":p)}
       onClick={()=>setPerfume(p==="Tanpa parfum"?"":p)}>{p}</button>)}
    </div>
    <label className={styles.field}>Nama parfum lain
     <input value={perfume} onChange={e=>setPerfume(e.target.value)} maxLength={80} placeholder="Parfum sesuai pelanggan" />
    </label>
   </div>
   <div className={styles.unavailableAdjustments} aria-label="Ongkir dan diskon belum tersedia">
    <strong>Antar/jemput dan diskon</strong>
    <p className={styles.help}>Belum dapat dikenakan. Tarif ongkir dan aturan diskon harus disetujui owner serta divalidasi database sebelum transaksi diaktifkan. Total saat ini hanya harga layanan.</p>
   </div>
   <label className={styles.field}>Catatan cucian (opsional)<textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={500} rows={3} placeholder="Catatan untuk proses laundry" /></label>
   <p className={styles.help}>Durasi terpilih: {options.find(o=>o.value===duration)?.label}. Harga setiap layanan disahkan ulang oleh database. Pembayaran dan poin tidak diproses saat membuat nota.</p>
   {!canWrite&&<p className={styles.warn} role="status">Nota belum dapat dibuat: transaksi POS masih dikunci pada database.</p>}
   <form action={createCashierOrder}>
    <input type="hidden" name="requestId" value={requestId}/>
    <input type="hidden" name="kind" value={customerType}/>
    <input type="hidden" name="guestName" value={customerType==='guest'?name.trim():""}/>
    <input type="hidden" name="memberNumber" value={customerType==='member'?member:""}/>
    <input type="hidden" name="items" value={items}/>
    <input type="hidden" name="perfume" value={perfume}/>
    <input type="hidden" name="notes" value={notes}/>
    <button className={styles.primary} disabled={!canWrite||!quote||!customerValid} type="submit">Buat Nota — {quote?money(quote.totalIdr):"Periksa jumlah"}</button>
   </form>
  </section>}
  <div className={styles.sticky}>
   <div><small>Total sementara · {chosen.length} layanan</small><strong>{quote?money(quote.totalIdr):"Periksa kuantitas"}</strong></div>
   <div className={styles.controls}>{step>0&&<button type="button" className={styles.back} onClick={()=>setStep(step-1)}>Kembali</button>}
    {step<2&&<button type="button" className={styles.primary} disabled={step===0?!customerValid:!quote} onClick={()=>setStep(step+1)}>Lanjut</button>}
   </div>
  </div>
 </div>;
}