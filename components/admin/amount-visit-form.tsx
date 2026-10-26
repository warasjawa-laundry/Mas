"use client";

import {useState} from "react";
import {useFormStatus} from "react-dom";
import {recordAmountVisit} from "@/app/admin/points/actions";

type Tier={minimum:number;points:number};
type Props={memberName?:string;memberId:string;requestId:string;memberActive:boolean;tiers:Tier[];year:number};
const idr=(n:number)=>new Intl.NumberFormat("id-ID").format(n);

function ReviewActions({disabled,onEdit}:{disabled:boolean;onEdit:()=>void}) {
 const {pending}=useFormStatus();
 return <div className="transaction-review-actions"><button type="button" className="admin-logout" disabled={pending} onClick={onEdit}>Ubah isian</button><button type="submit" className="admin-primary owner-record-button"
   disabled={disabled||pending} aria-busy={pending}>
   {pending?"Menyimpan transaksi…":"Simpan transaksi"}
 </button></div>;
}

export default function AmountVisitForm({memberName,memberId,requestId,memberActive,tiers,year}:Props){
 const [review,setReview]=useState(false);
 const [amount,setAmount]=useState("");
 const [description,setDescription]=useState("");
 const [saveError,setSaveError]=useState("");
 const value=Number(amount);
 const validAmount=/^[1-9]\d{0,9}$/.test(amount)&&value<=1_000_000_000;
 const pointEstimate=validAmount ? tiers.reduce((earned,tier)=>value>=tier.minimum?tier.points:earned,0):null;
 const hasControlCharacters=/[\x00-\x1f\x7f]/.test(description.trim());
 const validDesc=description.trim().length>=3&&description.trim().length<=240&&!hasControlCharacters;
 async function saveTransaction(formData:FormData){
   setSaveError("");
   const result=await recordAmountVisit(formData);
   setSaveError(result.error);
 }
 return <form action={saveTransaction} className="owner-amount-form" onSubmit={event=>{if(!review){event.preventDefault();setReview(true);}}}>
   <input type="hidden" name="memberId" value={memberId}/>
   <input type="hidden" name="requestId" value={requestId}/>
   <h2>{review?"Periksa transaksi":"Transaksi baru"}</h2>
   {saveError&&<p className="admin-error" role="alert">{saveError}</p>}
   <div className="transaction-entry-fields" hidden={review}>
   <label htmlFor="amount-visit-idr">Nominal transaksi (Rp) *</label>
   <input id="amount-visit-idr" name="amountIdr" type="number" inputMode="numeric"
     min={1} max={1000000000} step={1} required placeholder="Contoh: 75000"
     value={amount} onChange={e=>setAmount(e.target.value)} disabled={!memberActive}/>
   <label htmlFor="amount-visit-note">Keterangan transaksi *</label>
   <textarea id="amount-visit-note" name="description" required minLength={3} maxLength={240}
     placeholder="Contoh: Cuci setrika 15 kg" rows={2} value={description}
     onChange={e=>setDescription(e.target.value)} disabled={!memberActive}
     aria-invalid={hasControlCharacters} aria-describedby={hasControlCharacters?"amount-description-error":undefined}/>
   {hasControlCharacters&&<p id="amount-description-error" className="admin-error" role="alert">Tulis keterangan dalam satu baris, tanpa Enter atau tab.</p>}
   </div>
   {review&&<div className="transaction-review"><span>Member</span><strong>{memberName}</strong><span>Nominal</span><strong>Rp{idr(value)}</strong><span>Keterangan</span><p>{description.trim()}</p></div>}
   <div className="owner-point-estimate" role="status">
     <span>Perkiraan poin · {year}</span>
     <strong>{pointEstimate===null?"—":pointEstimate+" poin"}</strong>
     <small>{validAmount?"Dari transaksi Rp"+idr(value)+". Periksa nominal sebelum menyimpan.":"Masukkan nominal untuk melihat poin otomatis."}</small>
   </div>
   {review?<ReviewActions onEdit={()=>setReview(false)} disabled={!memberActive || !validAmount || !validDesc || tiers.length!==5}/>:
    <button className="admin-primary" type="submit" disabled={!memberActive||!validAmount||!validDesc||tiers.length!==5}>Periksa transaksi</button>}
   <p className="member-note">Poin dihitung otomatis. Transaksi dicatat setelah penyimpanan berhasil.</p>
 </form>;
}
