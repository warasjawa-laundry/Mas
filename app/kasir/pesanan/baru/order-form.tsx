"use client";
import { useMemo,useState } from "react";
import { calculateOrderTotals } from "@/lib/pos/money";
import { posUnitFromCatalog } from "@/lib/pos/catalog-units";
import { formatIdr } from "@/lib/pos/g4-order";
import { createCashierOrder } from "../actions";
import { CashierQrScanner } from "./cashier-qr-scanner";
import styles from "./wizard.module.css";

export type CatalogService={id:string;category:string;package_name:string;name:string;price_idr:number;unit:string;duration:string;revision:number};
const money=(n:string|number|bigint)=>formatIdr(n);
const steps=["Pelanggan","Layanan","Konfirmasi"];

export function OrderForm({services,requestId,canWrite,canLookup}:{services:CatalogService[];requestId:string;canWrite:boolean;canLookup:boolean}){
 const [step,setStep]=useState(0);
 const [customerType,setCustomerType]=useState<"guest"|"member">("guest");
 const [name,setName]=useState("");
 const [member,setMember]=useState("");
 const [scannedName,setScannedName]=useState("");
 const [quantities,setQuantities]=useState<Record<string,string>>({});
 const [perfume,setPerfume]=useState("");
 const [notes,setNotes]=useState("");
 const chosen=useMemo(()=>services.filter(s=>(quantities[s.id]??"")!==""),[services,quantities]);
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
     {canLookup&&<CashierQrScanner disabled={false} onMember={(number,name)=>{setMember(number);setScannedName(name)}}/>}
     {scannedName&&<p className={styles.scanned} role="status">Member ditemukan: <strong>{scannedName}</strong> · MJL-{member.padStart(6,"0")}. Periksa identitas sebelum lanjut.</p>}</>}
   <p className={styles.help}>Data pelanggan akan diverifikasi ulang oleh database saat nota dibuat. Scan kartu tidak pernah menambah poin.</p>
  </section>}
  {step===1&&<section className={styles.panel} aria-labelledby="services-title">
   <h2 id="services-title">Pilih layanan</h2><p className={styles.help}>Jumlah kg/m bisa sampai tiga desimal. Gunakan +/− atau ketik angka tepat.</p>
   {services.length===0?<p className={styles.help}>Katalog belum tersedia.</p>:<div className={styles.services}>
    {services.map(s=><div key={s.id} className={styles.service}>
     <div className={styles.serviceInfo}><strong>{s.name}</strong><small>{s.category}{s.package_name?` · ${s.package_name}`:""} · {s.duration||"Reguler"}</small>
     <span>{money(s.price_idr)} / {s.unit}</span></div>
     <div className={styles.quantity}><button type="button" aria-label={`Kurangi ${s.name}`} onClick={()=>dec(s.id)}>−</button>
     <input aria-label={`Jumlah ${s.name}`} inputMode="decimal" placeholder="0" value={quantities[s.id]??""} onChange={e=>changeQuantity(s.id,e.target.value.slice(0,12))} />
     <button type="button" aria-label={`Tambah ${s.name}`} onClick={()=>inc(s.id)}>+</button></div>
    </div>)}
   </div>}
  </section>}
  {step===2&&<section className={styles.panel} aria-labelledby="summary-title">
   <h2 id="summary-title">Konfirmasi pesanan</h2>
   <p><strong>{customerType==='guest'?name:`Member MJL #${member}`}</strong></p>
   <div className={styles.summary}>{chosen.map((s,i)=><div key={s.id}><span>{s.name} — {quantities[s.id]} {s.unit}</span><strong>{quote?money(quote.items[i].lineTotalIdr):"—"}</strong></div>)}</div>
   <label className={styles.field}>Pilihan parfum (opsional)<input value={perfume} onChange={e=>setPerfume(e.target.value)} maxLength={80} placeholder="Contoh: Melati" /></label>
   <label className={styles.field}>Catatan cucian (opsional)<textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={500} rows={3} placeholder="Catatan untuk proses laundry" /></label>
   <p className={styles.help}>Harga disahkan ulang dari database sebelum nota dibuat. Pembayaran dan poin tidak diproses pada tahap ini.</p>
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