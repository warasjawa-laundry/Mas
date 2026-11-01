"use client";
import { useState } from "react";
/** Manual draft only. No WhatsApp API, no phone number lookup, no delivery tracking. */
export function WhatsAppDraft({invoice,customer,workStatus,total}:{invoice:string;customer:string;workStatus:string;total:string}){
 const [copied,setCopied]=useState(false);
 const text=`Halo ${customer}, informasi pesanan Mas Jawa Laundry.\nNota: ${invoice}\nStatus cucian: ${workStatus==='READY'?'Siap diambil':workStatus==='COLLECTED'?'Sudah diambil':'Sedang diproses'}\nTotal tagihan: ${total}.\nTerima kasih.`;
 return <section style={{border:'1px solid #e2e8f0',borderRadius:16,padding:18,marginTop:16}}>
 <h2 style={{fontSize:19}}>Pesan WhatsApp</h2>
 <p style={{color:'#64748b',fontSize:13}}>Draf manual; cek penerima dan persetujuan pelanggan sebelum mengirim. Tidak mengirim otomatis.</p>
 <pre style={{whiteSpace:'pre-wrap',fontFamily:'inherit',fontSize:14}}>{text}</pre>
 <button type="button" style={{minHeight:44,border:0,borderRadius:10,background:'#6d28d9',color:'white',padding:'10px 16px',fontWeight:700}}
 onClick={async()=>{try{await navigator.clipboard.writeText(text);setCopied(true);}catch{setCopied(false);}}}>
 {copied?'Draf disalin':'Salin draf WhatsApp'}</button>
 </section>;
}