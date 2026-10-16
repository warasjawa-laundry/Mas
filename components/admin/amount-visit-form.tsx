"use client";

import {useState} from "react";
import {useFormStatus} from "react-dom";
import {recordAmountVisit} from "@/app/admin/points/actions";

type Tier={minimum:number;points:number};
type Props={memberId:string;requestId:string;memberActive:boolean;tiers:Tier[];year:number};
const idr=(n:number)=>new Intl.NumberFormat("id-ID").format(n);

function SaveTransactionButton({disabled}:{disabled:boolean}) {
 const {pending}=useFormStatus();
 return <button type="submit" className="admin-primary owner-record-button"
   disabled={disabled||pending} aria-busy={pending}>
   {pending?"Menyimpan transaksi…":"Simpan Transaksi & Poin"}
 </button>;
}

export default function AmountVisitForm({memberId,requestId,memberActive,tiers,year}:Props){
 const [amount,setAmount]=useState("");
 const [description,setDescription]=useState("");
 const value=Number(amount);
 const validAmount=/^[1-9]\d{0,9}$/.test(amount)&&value<=1_000_000_000;
 const pointEstimate=validAmount ? tiers.reduce((earned,tier)=>value>=tier.minimum?tier.points:earned,0):null;
 const validDesc=description.trim().length>=3&&description.trim().length<=240;
 return <form action={recordAmountVisit} className="owner-amount-form">
   <input type="hidden" name="memberId" value={memberId}/>
   <input type="hidden" name="requestId" value={requestId}/>
   <label htmlFor="amount-visit-idr">Nominal transaksi (Rp) *</label>
   <input id="amount-visit-idr" name="amountIdr" type="number" inputMode="numeric"
     min={1} max={1000000000} step={1} required placeholder="Contoh: 75000"
     value={amount} onChange={e=>setAmount(e.target.value)} disabled={!memberActive}/>
   <label htmlFor="amount-visit-note">Keterangan transaksi *</label>
   <textarea id="amount-visit-note" name="description" required minLength={3} maxLength={240}
     placeholder="Contoh: Cuci setrika 15 kg" rows={3} value={description}
     onChange={e=>setDescription(e.target.value)} disabled={!memberActive}/>
   <div className="owner-point-estimate" role="status">
     <span>Perkiraan poin · {year}{year===2026?" (uji coba)":""}</span>
     <strong>{pointEstimate===null?"—":pointEstimate+" poin"}</strong>
     <small>{validAmount?"Dari transaksi Rp"+idr(value)+". Nilai akhir disimpan saat dikonfirmasi.":"Masukkan nominal untuk melihat poin otomatis."}</small>
   </div>
   <SaveTransactionButton disabled={!memberActive || !validAmount || !validDesc || tiers.length!==5}/>
   <p className="member-note">Transaksi bertambah 1 kali hanya setelah tombol ditekan dan penyimpanan berhasil. QR scan tidak mencatat transaksi.</p>
 </form>;
}
