"use client";
import { useState } from "react";
import styles from "../orders.module.css";
/** Manual draft only. No WhatsApp API, no phone number lookup, no delivery tracking. */
export function WhatsAppDraft({invoice,customer,workStatus,total}:{invoice:string;customer:string;workStatus:string;total:string}){
 const [copied,setCopied]=useState(false);
 const text=`Halo ${customer}, informasi pesanan Mas Jawa Laundry.\nNota: ${invoice}\nStatus cucian: ${workStatus==='READY'?'Siap diambil':workStatus==='COLLECTED'?'Sudah diambil':'Sedang diproses'}\nTotal tagihan: ${total}.\nTerima kasih.`;
 return <section className={styles.card}>
 <h2>Pesan WhatsApp</h2>
 <p className={styles.muted}>Draf manual; cek penerima dan persetujuan pelanggan sebelum mengirim. Tidak mengirim otomatis.</p>
 <pre style={{whiteSpace:'pre-wrap',fontFamily:'inherit',fontSize:13,overflowWrap:'anywhere'}}>{text}</pre>
 <button type="button" className={styles.mainButton}
 onClick={async()=>{try{await navigator.clipboard.writeText(text);setCopied(true);}catch{setCopied(false);}}}>
 {copied?'Draf disalin':'Salin draf WhatsApp'}</button>
 </section>;
}
