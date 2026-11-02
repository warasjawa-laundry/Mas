"use client";
import {useMemo,useRef,useState} from "react";
import {useFormStatus} from "react-dom";
import {calculateOrderTotals} from "@/lib/pos/money";
import {posUnitFromCatalog} from "@/lib/pos/catalog-units";
import {canAdvanceOrderStep,stepQuantity} from "@/lib/pos/ui-quantity";
import {formatIdr} from "@/lib/pos/g4-order";
import {createCashierOrder} from "../actions";
import {MemberNamePicker} from "./member-name-picker";
import {CashierQrScanner} from "./cashier-qr-scanner";
import {DurationSheet} from "./duration-sheet";
import {ALL_DURATIONS,durationOptions,servicesForDuration} from "@/lib/pos/g7-catalog";
import styles from "./wizard.module.css";

export type CatalogService={id:string;category:string;package_name:string;name:string;price_idr:number;unit:string;duration:string;revision:number};
const money=(n:string|number|bigint)=>formatIdr(n);
const steps=["Pelanggan","Durasi","Layanan","Konfirmasi"];

function CreateOrderButton({disabled}:{disabled:boolean}){
 const {pending}=useFormStatus();
 return <button className={styles.primary} disabled={disabled||pending} aria-busy={pending} type="submit">{pending?'Menyimpan pesanan…':'Buat pesanan'}</button>;
}

export function OrderForm({services,requestId,canWrite,canLookup,role="cashier",createAction}:{
 services:CatalogService[];requestId:string;canWrite:boolean;canLookup:boolean;
 role?:"owner"|"cashier";createAction?:(form:FormData)=>void|Promise<void>;
}){
 const [step,setStep]=useState(0);
 const [customerType,setCustomerType]=useState<"guest"|"member">("guest");
 const [name,setName]=useState("");
 const [member,setMember]=useState("");
 const [memberName,setMemberName]=useState("");
 const [quantities,setQuantities]=useState<Record<string,string>>({});
 const [duration,setDuration]=useState(ALL_DURATIONS);
 const [perfume,setPerfume]=useState("");
 const [notes,setNotes]=useState("");
 const [search,setSearch]=useState("");
 const [category,setCategory]=useState("");
 const title=useRef<HTMLHeadingElement>(null);
 const options=useMemo(()=>durationOptions(services),[services]);
 const available=useMemo(()=>servicesForDuration(services,duration),[services,duration]);
 const categories=useMemo(()=>[...new Set(available.map(s=>s.category))],[available]);
 const activeCategory=categories.includes(category)?category:'';
 const visible=available.filter(s=>(!activeCategory||s.category===activeCategory)&&`${s.name} ${s.package_name}`.toLocaleLowerCase('id').includes(search.toLocaleLowerCase('id')));
 const chosen=useMemo(()=>available.filter(s=>(quantities[s.id]??"")!==""),[available,quantities]);
 const quote=useMemo(()=>{
  if(!chosen.length||chosen.length>30)return null;
  try{return calculateOrderTotals(chosen.map(s=>({priceIdr:String(s.price_idr),quantity:quantities[s.id],unit:posUnitFromCatalog(s.unit)})))}catch{return null}
 },[chosen,quantities]);
 const customerValid=customerType==="guest"?name.trim().length>=2:/^[1-9][0-9]{0,11}$/.test(member);
 const customerLabel=customerType==='guest'?name.trim():memberName||`Member MJL #${member}`;
 const items=JSON.stringify(chosen.map(s=>({service_id:s.id,quantity:quantities[s.id],revision:Number(s.revision)})));
 const canContinue=canAdvanceOrderStep(step,customerValid,available.length>0,!!quote);
 function go(next:number){setStep(next);queueMicrotask(()=>title.current?.focus())}
 function changeQuantity(id:string,value:string){setQuantities(prev=>({...prev,[id]:value}))}
 function adjust(s:CatalogService,direction:1|-1){
  try{changeQuantity(s.id,stepQuantity(quantities[s.id]??"",posUnitFromCatalog(s.unit),direction))}catch{return}
 }
 function quantityError(s:CatalogService){
  if(!quantities[s.id])return '';
  try{calculateOrderTotals([{priceIdr:String(s.price_idr),quantity:quantities[s.id],unit:posUnitFromCatalog(s.unit)}]);return ''}
  catch{return 'Masukkan jumlah positif: pcs bulat, kg/m maksimal 3 desimal.'}
 }
 return <div className={styles.form}>
  <nav className={styles.steps} aria-label="Langkah pemesanan">
   {steps.map((label,i)=><span key={label} aria-current={i===step?'step':undefined} className={i===step?styles.active:""}><b>{i+1}</b>{label}</span>)}
  </nav>
  <h2 ref={title} tabIndex={-1} className={styles.mobileTitle}>{steps[step]}</h2>
  <div className={styles.workspace}>
   <div className={styles.catalogColumn}>
    <section className={`${styles.panel} ${styles.customerPanel} ${step!==0?styles.mobileHidden:''}`} aria-labelledby="customer-title">
     <div className={styles.sectionHeading}><h2 id="customer-title">Pilih pelanggan</h2><span>01</span></div>
     <div className={styles.segment}>
      <label><input type="radio" name="customer-type" checked={customerType==='guest'} onChange={()=>setCustomerType('guest')}/> Pelanggan umum</label>
      <label><input type="radio" name="customer-type" checked={customerType==='member'} onChange={()=>setCustomerType('member')}/> Member MJL</label>
     </div>
     {customerType==='guest'?<label className={styles.field}>Nama pelanggan<input autoComplete="off" value={name} onChange={e=>setName(e.target.value)} maxLength={120} placeholder="Masukkan nama pelanggan"/><small>Minimal 2 karakter.</small></label>:
      <><label className={styles.field}>Nomor member<input autoComplete="off" inputMode="numeric" value={member} onChange={e=>{setMember(e.target.value.replace(/\D/g,'').slice(0,12));setMemberName("")}} maxLength={12} placeholder="Nomor pada kartu member"/></label>
       {canLookup&&<>
        <CashierQrScanner role={role} disabled={false} onMember={(number,label)=>{setCustomerType("member");setMember(number);setMemberName(label)}}/>
        <MemberNamePicker role={role} disabled={false} onPick={row=>{setMember(row.memberNumber);setMemberName(row.displayName)}}/>
       </>}
       {memberName&&<p className={styles.scanned} role="status"><strong>{memberName}</strong><span>MJL-{member.padStart(6,"0")}</span></p>}</>}
     <p className={styles.help}>Periksa identitas pelanggan. Data akan diverifikasi kembali saat nota dibuat.</p>
    </section>
    <section className={`${styles.panel} ${styles.durationPanel} ${step!==1?styles.mobileHidden:''}`} aria-labelledby="duration-title-step">
     <div className={styles.sectionHeading}><h2 id="duration-title-step">Pilih durasi</h2><span>02</span></div>
     <DurationSheet options={options} value={duration} onSelect={value=>{setDuration(value);setQuantities({})}}/>
     <p className={styles.help}>Mengganti durasi mengosongkan pilihan layanan. Tanggal selesai belum dihitung otomatis.</p>
    </section>
    <section className={`${styles.panel} ${styles.catalogPanel} ${step!==2?styles.mobileHidden:''}`} aria-labelledby="services-title">
     <div className={styles.sectionHeading}><h2 id="services-title">Tambah layanan</h2><span>03</span></div>
     <label className={styles.search}><span>Cari layanan</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama layanan / paket"/></label>
     <div className={styles.categories} aria-label="Kategori layanan"><button type="button" aria-pressed={!activeCategory} onClick={()=>setCategory('')}>Semua</button>{categories.map(c=><button type="button" key={c} aria-pressed={activeCategory===c} onClick={()=>setCategory(c)}>{c||'Lainnya'}</button>)}</div>
     <p className={styles.help}>Ketik jumlah tepat atau gunakan + / −. Gunakan titik untuk desimal, maksimal 3 angka pada kg dan meter.</p>
     {visible.length===0?<p className={styles.empty}>Tidak ada layanan yang cocok. Ubah pencarian, kategori, atau durasi.</p>:<div className={styles.services}>{visible.map(s=>{
      const error=quantityError(s);
      return <div key={s.id} className={styles.service} data-selected={!!quantities[s.id]}>
       <div className={styles.serviceInfo}><strong>{s.name}</strong><small>{s.package_name||s.category} · {s.duration||"Durasi belum tercantum"}</small><span>{money(s.price_idr)} <small>/ {s.unit}</small></span></div>
       <div className={styles.quantity}><button type="button" aria-label={`Kurangi ${s.name}`} disabled={!quantities[s.id]} onClick={()=>adjust(s,-1)}>−</button><input aria-label={`Jumlah ${s.name}`} aria-invalid={!!error} aria-describedby={error?`quantity-${s.id}`:undefined} inputMode={s.unit==='pcs'||s.unit==='satuan'?'numeric':'decimal'} placeholder="0" value={quantities[s.id]??""} onChange={e=>changeQuantity(s.id,e.target.value.slice(0,12))}/><button type="button" aria-label={`Tambah ${s.name}`} onClick={()=>adjust(s,1)}>+</button></div>
       {error&&<p id={`quantity-${s.id}`} className={styles.quantityError}>{error}</p>}
      </div>})}</div>}
    </section>
   </div>
   <aside className={`${styles.summaryPanel} ${step!==3?styles.mobileHidden:''}`} aria-labelledby="summary-title">
    <div className={styles.summaryHead}><h2 id="summary-title">Atur & rincian pesanan</h2><p>{options.find(o=>o.value===duration)?.label}</p></div>
    <div className={styles.summaryBody}>
     <div className={styles.customerSummary}><small>Pelanggan</small><strong>{customerValid?customerLabel:'Belum dipilih'}</strong></div>
     {chosen.length===0?<p className={styles.empty}>Belum ada layanan dipilih. Tambahkan layanan dari katalog.</p>:<div className={styles.summary}>{chosen.map((s,i)=><div key={s.id}><span><strong>{s.name}</strong><small>{quantities[s.id]} {s.unit} × {money(s.price_idr)}</small></span><strong>{quote?money(quote.items[i].lineTotalIdr):'Periksa jumlah'}</strong></div>)}</div>}
     {chosen.length>30&&<p role="alert" className={styles.warn}>Maksimal 30 layanan per nota. Kurangi pilihan layanan.</p>}
     <label className={styles.field}>Parfum (opsional)<input value={perfume} onChange={e=>setPerfume(e.target.value)} maxLength={80} placeholder="Tanpa parfum / nama parfum"/></label>
     <label className={styles.field}>Catatan cucian (opsional)<textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={500} rows={3} placeholder="Catatan untuk proses laundry"/></label>
     <div className={styles.unavailableAdjustments}><div><span>Antar / jemput</span><strong>Belum tersedia</strong></div><div><span>Diskon</span><strong>Belum tersedia</strong></div><p className={styles.help}>Total saat ini hanya harga layanan. Harga disahkan kembali saat nota disimpan.</p></div>
    </div>
    <div className={styles.summaryFooter}><div className={styles.total}><span>Total tagihan</span><strong>{quote?money(quote.totalIdr):chosen.length?'Periksa jumlah':money(0)}</strong></div>
     {!customerValid&&<p className={styles.help}>Lengkapi pelanggan sebelum membuat nota.</p>}
     {!canWrite&&<p className={styles.warn} role="status">Transaksi POS masih dikunci. Nota belum dapat dibuat.</p>}
     <form action={createAction??createCashierOrder}>
      <input type="hidden" name="requestId" value={requestId}/><input type="hidden" name="kind" value={customerType}/><input type="hidden" name="guestName" value={customerType==='guest'?name.trim():""}/><input type="hidden" name="memberNumber" value={customerType==='member'?member:""}/><input type="hidden" name="items" value={items}/><input type="hidden" name="perfume" value={perfume}/><input type="hidden" name="notes" value={notes}/>
      <CreateOrderButton disabled={!canWrite||!quote||!customerValid}/>
     </form>
    </div>
   </aside>
  </div>
  <div className={styles.sticky}>
   <div><small>{customerValid?customerLabel:'Pelanggan belum dipilih'} · {chosen.length} layanan</small><strong>{quote?money(quote.totalIdr):chosen.length?'Periksa jumlah':money(0)}</strong></div>
   <div className={styles.controls}>{step>0&&<button type="button" className={styles.back} onClick={()=>go(step-1)}>Kembali</button>}{step<3&&<button type="button" className={styles.primary} disabled={!canContinue} onClick={()=>go(step+1)}>{step===2?'Atur pesanan':'Lanjut'}</button>}</div>
  </div>
 </div>;
}
