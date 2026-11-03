"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {useFormStatus} from "react-dom";
import {calculateOrderTotals} from "@/lib/pos/money";
import {posUnitFromCatalog} from "@/lib/pos/catalog-units";
import {canAdvanceOrderStep,stepQuantity} from "@/lib/pos/ui-quantity";
import {durationMinutes,estimateCompletion,formatDurationHours,formatEta} from "@/lib/pos/eta";
import {formatIdr} from "@/lib/pos/g4-order";
import {createCashierOrder} from "../actions";
import {MemberNamePicker} from "./member-name-picker";
import {CashierQrScanner} from "./cashier-qr-scanner";
import styles from "./wizard.module.css";
import RecoverableForm from "@/components/admin/recoverable-form";
import {resolveCashierMemberCode} from "./qr-actions";
import {resolveOwnerPosMemberCode} from "@/app/admin/pesanan/member-actions";
import PointSimulationPreview from "@/components/pos/point-simulation-preview";
import type {CommandActionResult} from "@/lib/pos/command-recovery";

export type CatalogService={id:string;category:string;package_name:string;name:string;price_idr:number;unit:string;duration:string;revision:number;duration_package_code?:string};
export type DeliveryOption={code:string;name:string;amount_idr:number;revision:number};
const money=(n:string|number|bigint)=>formatIdr(n);
const legacySteps=["Pelanggan","Layanan","Konfirmasi"];

function CreateOrderButton({disabled}:{disabled:boolean}){
 const {pending}=useFormStatus();
 return <button className={styles.primary} disabled={disabled||pending} aria-busy={pending} type="submit">{pending?'Menyimpan pesanan…':'Buat pesanan'}</button>;
}

export function OrderForm({services,deliveryOptions=[],requestId,canWrite,canLookup,role="cashier",createAction,recoveryKey,recoverAction,packageWorkflow=false,serverTime,lockReason,pilotTestOnly=false}:{
 services:CatalogService[];deliveryOptions?:DeliveryOption[];requestId:string;canWrite:boolean;canLookup:boolean;role?:"owner"|"cashier";lockReason?:string;pilotTestOnly?:boolean;
 createAction?:(form:FormData)=>Promise<CommandActionResult>;
 packageWorkflow?:boolean;serverTime?:string;recoveryKey?:string;recoverAction?:(requestId:string)=>Promise<CommandActionResult>;
}){
 const steps=packageWorkflow?["Pelanggan","Durasi","Layanan","Konfirmasi"]:legacySteps;
 const servicesStep=packageWorkflow?2:1,summaryStep=packageWorkflow?3:2;
 const [step,setStep]=useState(0);
 const [packageCode,setPackageCode]=useState("");
 const [pendingPackage,setPendingPackage]=useState("");
 const packages=useMemo(()=>[...new Map(services.filter(s=>s.duration_package_code).map(s=>[s.duration_package_code!,{code:s.duration_package_code!,name:s.package_name,duration:s.duration}])).values()],[services]);
 function choosePackage(code:string){if(code===packageCode)return;if(Object.values(quantities).some(Boolean)){setPendingPackage(code);return;}setPackageCode(code);}

 const [previewTime,setPreviewTime]=useState<string|null>(serverTime??null);
 useEffect(()=>{
  const base=serverTime?Date.parse(serverTime):Date.now(),started=performance.now();
  if(!Number.isFinite(base))return;
  const update=()=>setPreviewTime(new Date(base+performance.now()-started).toISOString());
  update();const timer=setInterval(update,60000);return ()=>clearInterval(timer);
 },[serverTime]);
 const selectedPackage=packages.find(p=>p.code===packageCode);
 const estimatedDue=estimateCompletion(previewTime,selectedPackage?durationMinutes(selectedPackage.duration):null);
 const etaPreview=selectedPackage&&<div className={styles.etaPreview}>
  <dl><div><dt>Masuk (pratinjau)</dt><dd><time dateTime={previewTime??undefined}>{formatEta(previewTime)}</time></dd></div>
   <div><dt>Estimasi selesai</dt><dd><time dateTime={estimatedDue??undefined} aria-label="Estimasi selesai">{formatEta(estimatedDue)}</time></dd></div></dl>
  <p className={styles.help}>Waktu final dihitung ulang saat nota disimpan. Jam kalender, termasuk malam dan hari libur.</p>
 </div>;
 const [recoveryPending,setRecoveryPending]=useState(false);
 const [customerType,setCustomerType]=useState<"guest"|"member">("guest");
 const [name,setName]=useState("");
 const [member,setMember]=useState("");
 const [memberName,setMemberName]=useState("");
 const [memberBusy,setMemberBusy]=useState(false);
 const [memberError,setMemberError]=useState("");
 const lookupSequence=useRef(0);
 const [quantities,setQuantities]=useState<Record<string,string>>({});
 const [perfume,setPerfume]=useState("");
 const [deliveryCode,setDeliveryCode]=useState("NONE");
 const selectedDelivery=deliveryOptions.find(d=>d.code===deliveryCode);
 const [notes,setNotes]=useState("");
 const [search,setSearch]=useState("");
 const [category,setCategory]=useState("");
 const title=useRef<HTMLHeadingElement>(null);
 const available=packageWorkflow?services.filter(s=>s.duration_package_code===packageCode):services;
 const categories=useMemo(()=>[...new Set(available.map(s=>s.category))],[available]);
 const activeCategory=categories.includes(category)?category:'';
 const visible=available.filter(s=>(!activeCategory||s.category===activeCategory)&&`${s.name} ${s.package_name} ${s.duration}`.toLocaleLowerCase('id').includes(search.toLocaleLowerCase('id')));
 const chosen=useMemo(()=>available.filter(s=>(quantities[s.id]??"")!==""),[available,quantities]);
 const quote=useMemo(()=>{
  if(!chosen.length||chosen.length>30)return null;
  try{return selectedDelivery?calculateOrderTotals(chosen.map(s=>({priceIdr:String(s.price_idr),quantity:quantities[s.id],unit:posUnitFromCatalog(s.unit)})),{deliveryIdr:String(selectedDelivery.amount_idr)}):null}catch{return null}
 },[chosen,quantities,selectedDelivery]);
 const customerValid=customerType==="guest"?(pilotTestOnly?/^UJI - \S.{1,}$/i.test(name.trim()):name.trim().length>=2):!pilotTestOnly&&/^[1-9][0-9]{0,11}$/.test(member)&&memberName.length>0;
 const customerLabel=customerType==='guest'?name.trim():memberName||`Member MJL #${member}`;
 const items=JSON.stringify(chosen.map(s=>({service_id:s.id,quantity:quantities[s.id],revision:Number(s.revision)})));
 const canContinue=packageWorkflow?(step===0?customerValid:step===1?!!packageCode:!!quote):canAdvanceOrderStep(step,customerValid,available.length>0,!!quote);
 function go(next:number){setStep(next);queueMicrotask(()=>title.current?.focus())}
 function pickMember(number:string,label:string){
  lookupSequence.current++;setMember(number);setMemberName(label);setMemberError("");setMemberBusy(false);
 }
 async function verifyMember(){
  const sequence=++lookupSequence.current;setMemberBusy(true);setMemberError("");
  try{
   const result=await (role==='owner'?resolveOwnerPosMemberCode(member):resolveCashierMemberCode(member));
   if(sequence!==lookupSequence.current)return;
   if(result)pickMember(result.memberNumber,result.displayName);
   else {setMemberName("");setMemberError("Member aktif tidak ditemukan. Periksa nomor atau pindai kartu.");}
  }catch{if(sequence===lookupSequence.current)setMemberError("Pemeriksaan member belum berhasil. Coba kembali.");}
  finally{if(sequence===lookupSequence.current)setMemberBusy(false);}
 }
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
     {pilotTestOnly&&<p className={styles.warn} role="status"><strong>MODE UJI — bukan nota pelanggan.</strong> Gunakan nama dummy diawali <strong>UJI - </strong>. Member asli dan poin pelanggan tidak boleh digunakan. Pembayaran/uang kas yang dicatat hanya simulasi; jangan terima dana sungguhan atau kirim WhatsApp ke pelanggan.</p>}
     <div className={styles.segment}>
      <label><input type="radio" name="customer-type" checked={customerType==='guest'} onChange={()=>setCustomerType('guest')}/> Pelanggan umum</label>
      <label><input type="radio" name="customer-type" checked={customerType==='member'} disabled={pilotTestOnly} onChange={()=>setCustomerType('member')}/> Member MJL</label>
     </div>
     {customerType==='guest'?<label className={styles.field}>Nama pelanggan<input autoComplete="off" value={name} onChange={e=>setName(e.target.value)} maxLength={120} placeholder={pilotTestOnly?"UJI - Nama Dummy":"Masukkan nama pelanggan"}/><small>{pilotTestOnly?"Wajib awalan UJI - dan nama dummy minimal 2 karakter. Nota ini diberi penanda tes di database.":"Minimal 2 karakter."}</small></label>:
      <><label className={styles.field}>Nomor member<input autoComplete="off" inputMode="numeric" value={member} onChange={e=>{lookupSequence.current++;setMember(e.target.value.replace(/\D/g,'').slice(0,12));setMemberName("");setMemberError("");setMemberBusy(false)}} maxLength={12} placeholder="Nomor pada kartu member"/></label>
       {canLookup&&<button type="button" className={styles.back} disabled={memberBusy||!/^[1-9][0-9]{0,11}$/.test(member)} onClick={verifyMember}>{memberBusy?'Memeriksa member…':'Periksa nomor member'}</button>}
       {memberError&&<p role="alert" className={styles.warn}>{memberError}</p>}
       {canLookup&&<>
       <CashierQrScanner role={role} disabled={false} onMember={pickMember}/>
       <MemberNamePicker role={role} disabled={false} onPick={row=>pickMember(row.memberNumber,row.displayName)}/>
       </>}
       {memberName&&<p className={styles.scanned} role="status"><strong>{memberName}</strong><span>MJL-0{member.padStart(5,"0")}</span></p>}</>}
     <p className={styles.help}>Periksa identitas pelanggan. Data akan diverifikasi kembali saat nota dibuat.</p>
    </section>
    {packageWorkflow&&<section className={`${styles.panel} ${step!==1?styles.mobileHidden:''}`} aria-labelledby="package-title">
     <div className={styles.sectionHeading}><h2 id="package-title">Pilih paket durasi</h2><span>02</span></div>
     <p className={styles.help}>Estimasi memakai jam kalender sejak nota dibuat.</p>
     {packages.length===0?<p className={styles.warn}>Paket belum dikonfigurasi Owner. Tarif contoh tidak digunakan.</p>:<div className={styles.segment}>{packages.map(p=><label key={p.code}><input type="radio" name="duration-package" checked={packageCode===p.code} onChange={()=>choosePackage(p.code)}/>{p.name} · {formatDurationHours(p.duration)}</label>)}</div>}
     {etaPreview}
     {pendingPackage&&<div role="alert"><p>Mengganti paket akan mengosongkan pilihan layanan. Periksa tarif paket baru sebelum menambah layanan.</p><button type="button" className={styles.back} onClick={()=>setPendingPackage("")}>Pertahankan pilihan</button><button type="button" className={styles.primary} onClick={()=>{setPackageCode(pendingPackage);setQuantities({});setPendingPackage("");}}>Ganti paket dan pilih ulang</button></div>}
    </section>}
    <section className={`${styles.panel} ${styles.catalogPanel} ${step!==servicesStep?styles.mobileHidden:''}`} aria-labelledby="services-title">
     <div className={styles.sectionHeading}><h2 id="services-title">{packageWorkflow?"Pilih layanan":"Pilih layanan & durasi"}</h2><span>{String(servicesStep+1).padStart(2,"0")}</span></div>
     <label className={styles.search}><span>Cari layanan</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama layanan / paket"/></label>
     <div className={styles.categories} aria-label="Kategori layanan"><button type="button" aria-pressed={!activeCategory} onClick={()=>setCategory('')}>Semua</button>{categories.map(c=><button type="button" key={c} aria-pressed={activeCategory===c} onClick={()=>setCategory(c)}>{c||'Lainnya'}</button>)}</div>
     <p className={styles.help}>Ketik jumlah tepat atau gunakan + / −. Gunakan titik untuk desimal, maksimal 3 angka pada kg dan meter.</p>
     {visible.length===0?<p className={styles.empty}>Tidak ada layanan yang cocok. Ubah pencarian atau kategori.</p>:<div className={styles.services}>{visible.map(s=>{
      const error=quantityError(s);
      return <div key={s.id} className={styles.service} data-selected={!!quantities[s.id]}>
       <div className={styles.serviceInfo}><strong>{s.name}</strong><small>{s.package_name||s.category}</small>{!packageWorkflow&&<span className={styles.serviceDuration}><span aria-hidden="true">◷</span> {s.duration||"Durasi belum ditentukan"}</span>}<span>{money(s.price_idr)} <small>/ {s.unit}</small></span></div>
       <div className={styles.quantity}><button type="button" aria-label={`Kurangi ${s.name}`} disabled={!quantities[s.id]} onClick={()=>adjust(s,-1)}>−</button><input aria-label={`Jumlah ${s.name}`} aria-invalid={!!error} aria-describedby={error?`quantity-${s.id}`:undefined} inputMode={s.unit==='pcs'||s.unit==='satuan'?'numeric':'decimal'} placeholder="0" value={quantities[s.id]??""} onChange={e=>changeQuantity(s.id,e.target.value.slice(0,12))}/><button type="button" aria-label={`Tambah ${s.name}`} onClick={()=>adjust(s,1)}>+</button></div>
       {error&&<p id={`quantity-${s.id}`} className={styles.quantityError}>{error}</p>}
      </div>})}</div>}
    </section>
   </div>
   <aside className={`${styles.summaryPanel} ${step!==summaryStep&&!recoveryPending?styles.mobileHidden:''}`} aria-labelledby="summary-title">
    <div className={styles.summaryHead}><h2 id="summary-title">Atur & rincian pesanan</h2><p>{packageWorkflow?"Satu paket durasi untuk seluruh layanan pada nota.":"Durasi mengikuti masing-masing layanan yang dipilih."}</p></div>
    <div className={styles.summaryBody}>
     <div className={styles.customerSummary}><small>Pelanggan</small><strong>{customerValid?customerLabel:'Belum dipilih'}</strong></div>
     {chosen.length===0?<p className={styles.empty}>Belum ada layanan dipilih. Tambahkan layanan dari katalog.</p>:<div className={styles.summary}>{chosen.map((s,i)=><div key={s.id}><span><strong>{s.name}{s.package_name?` · ${s.package_name}`:""}</strong><small>{!packageWorkflow&&`${s.duration||"Durasi belum ditentukan"} · `}{quantities[s.id]} {s.unit} × {money(s.price_idr)}</small></span><strong>{quote?money(quote.items[i].lineTotalIdr):'Periksa jumlah'}</strong></div>)}</div>}
     {chosen.length>30&&<p role="alert" className={styles.warn}>Maksimal 30 layanan per nota. Kurangi pilihan layanan.</p>}
     {packageWorkflow&&etaPreview}
     <label className={styles.field}>Parfum
      <select value={perfume} onChange={e=>setPerfume(e.target.value)}>
       <option value="">Tidak</option>
       {["Akasia","Junjung Buih","Lavender","Ocean","Sakura"].map(name=><option key={name} value={name}>{name}</option>)}
      </select>
     </label>
     <label className={styles.field}>Antar-jemput
      <select value={deliveryCode} onChange={e=>setDeliveryCode(e.target.value)} disabled={deliveryOptions.length===0}>
       {deliveryOptions.map(d=><option key={d.code} value={d.code}>{d.name} · {money(d.amount_idr)}</option>)}
      </select>
      <small>Tarif berasal dari Supabase dan diverifikasi ulang saat nota disimpan.</small>
     </label>
     {deliveryOptions.length===0&&<p role="alert" className={styles.warn}>Pilihan antar-jemput belum tersedia dari database. Nota tidak dapat dibuat sebelum tarif dimuat.</p>}
     <label className={styles.field}>Catatan cucian (opsional)<textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={500} rows={3} placeholder="Catatan untuk proses laundry"/></label>
     <div className={styles.unavailableAdjustments}>
      <div><span>Subtotal layanan</span><strong>{quote?money(quote.subtotalIdr):'—'}</strong></div>
      <div><span>Antar-jemput · {selectedDelivery?.name??'Belum tersedia'}</span><strong>{selectedDelivery?money(selectedDelivery.amount_idr):'—'}</strong></div>
      <div><span>Diskon</span><strong>Belum tersedia</strong></div>
      <p className={styles.help}>Subtotal layanan ditambah biaya antar-jemput. Harga akhir divalidasi oleh Supabase sebelum nota tersimpan.</p>
     </div>
    </div>
    <div className={styles.summaryFooter}><div className={styles.total}><span>Total tagihan</span><strong>{quote?money(quote.totalIdr):chosen.length?'Periksa jumlah':money(0)}</strong></div>
     {!customerValid&&<p className={styles.help}>{pilotTestOnly?"Gunakan pelanggan umum dummy bernama UJI - Nama Dummy untuk melanjutkan.":"Lengkapi pelanggan sebelum membuat nota."}</p>}
     {!canWrite&&<p className={styles.warn} role="status">{lockReason??"Transaksi POS masih dikunci. Nota belum dapat dibuat."}</p>}
     {pilotTestOnly&&quote&&selectedDelivery&&<PointSimulationPreview role={role} items={items} deliveryCode={selectedDelivery.code} deliveryRevision={selectedDelivery.revision} total={quote.totalIdr.toString()}/>}
     <RecoverableForm action={createAction??createCashierOrder} recoveryKey={recoveryKey} recoverAction={recoverAction} onRecoveryPendingChange={setRecoveryPending}>
      <input type="hidden" name="requestId" value={requestId}/><input type="hidden" name="kind" value={customerType}/><input type="hidden" name="guestName" value={customerType==='guest'?name.trim():""}/><input type="hidden" name="memberNumber" value={customerType==='member'?member:""}/><input type="hidden" name="items" value={items}/><input type="hidden" name="perfume" value={perfume}/><input type="hidden" name="notes" value={notes}/><input type="hidden" name="deliveryCode" value={selectedDelivery?.code??""}/><input type="hidden" name="deliveryRevision" value={selectedDelivery?.revision??""}/>
      <CreateOrderButton disabled={!canWrite||!quote||!customerValid||!selectedDelivery}/>
     </RecoverableForm>
    </div>
   </aside>
  </div>
  <div className={styles.sticky}>
   <div><small>{customerValid?customerLabel:'Pelanggan belum dipilih'} · {chosen.length} layanan</small><strong>{quote?money(quote.totalIdr):chosen.length?'Periksa jumlah':money(0)}</strong></div>
   <div className={styles.controls}>{step>0&&<button type="button" className={styles.back} onClick={()=>go(step-1)}>Kembali</button>}{step<summaryStep&&<button type="button" className={styles.primary} disabled={!canContinue} onClick={()=>go(step+1)}>{step===servicesStep?'Atur pesanan':'Lanjut'}</button>}</div>
  </div>
 </div>;
}
