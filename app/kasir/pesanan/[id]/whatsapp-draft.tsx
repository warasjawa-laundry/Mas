"use client";
import {useEffect,useRef,useState} from "react";
import {prepareOrderReceipt,verifyOrderContact} from "../receipt-actions";
import {receiptWhatsAppUrl,type ReceiptData,type ReceiptKind} from "@/lib/pos/receipt";
import RecoverableForm from "@/components/admin/recoverable-form";
import PendingSubmit from "@/components/admin/pending-submit";
import styles from "../orders.module.css";
export function WhatsAppDraft({orderId,role,workStatus,version}:{orderId:string;role:'owner'|'cashier';workStatus:string;version:number}){
 const [draft,setDraft]=useState<{data:ReceiptData;text:string}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[copied,setCopied]=useState(false),[checked,setChecked]=useState(false);
 const [contactRequest,setContactRequest]=useState('');
 const sequence=useRef(0);
 useEffect(()=>{setContactRequest(crypto.randomUUID());},[orderId,role]);
 useEffect(()=>{sequence.current++;setDraft(null);setChecked(false);setCopied(false);},[version,workStatus,orderId,role]);
 async function prepare(kind:ReceiptKind){
  const request=++sequence.current;
  setBusy(true);setError('');setDraft(null);setChecked(false);setCopied(false);
  try{const result=await prepareOrderReceipt(role,orderId,kind);if(request!==sequence.current)return;if(result.error||!result.data||!result.text)setError(result.error||'Draf belum tersedia.');else setDraft({data:result.data,text:result.text});}
  catch{if(request!==sequence.current)return;setError('Koneksi terputus. Nota tetap tersimpan; baca kembali draf saat jaringan tersedia.');}finally{if(request===sequence.current)setBusy(false);}
 }
 const url=draft?receiptWhatsAppUrl(draft.data.contact,draft.text):null;
 return <section className={styles.card}>
  <h2>Pesan WhatsApp</h2><p className={styles.muted}>Baca ulang data nota setelah pembayaran selesai atau dilewati. Petugas menekan Kirim di WhatsApp; membuka draf bukan bukti terkirim.</p>
  <details><summary>Verifikasi nomor & alamat penerima</summary><RecoverableForm action={async form=>{
   const result=await verifyOrderContact(role,orderId,form);if(result.confirmed){sequence.current++;setDraft(null);setChecked(false);setContactRequest(crypto.randomUUID());}return result;
  }} className={styles.paymentForm}>
   <input type="hidden" name="requestId" value={contactRequest}/>
   <label>Nomor WhatsApp<input name="phone" type="tel" inputMode="tel" maxLength={24} autoComplete="off" placeholder="08… / +62…"/></label>
   <label>Alamat pelanggan<input name="address" maxLength={240} autoComplete="off"/></label>
   <label><input type="checkbox" name="confirmed" value="yes" required/> Pelanggan mengonfirmasi nomor dan alamat ini untuk nota yang sedang dibuka.</label>
   <PendingSubmit disabled={!contactRequest} className={styles.mainButton} label="Simpan kontak terverifikasi"/>
  </RecoverableForm></details>
  <div className={styles.receiptActions}>
   <button type="button" disabled={busy} className={styles.mainButton} onClick={()=>prepare('NEW')}>Baca draf Nota Baru</button>
   {workStatus==='READY'&&<button type="button" disabled={busy} className={styles.mainButton} onClick={()=>prepare('READY')}>Baca draf Siap Diambil</button>}
   {workStatus==='COLLECTED'&&<button type="button" disabled={busy} className={styles.mainButton} onClick={()=>prepare('COLLECTED')}>Baca draf Sudah Diambil (opsional)</button>}
  </div>
  {busy&&<p role="status">Membaca pembayaran dan poin terbaru…</p>}{error&&<p className={styles.error} role="alert">{error}</p>}
  {draft&&<><p className={styles.muted}>Template versi {draft.data.settings.revision}. Periksa penerima dan rincian sebelum mengirim.</p>
   <pre style={{whiteSpace:'pre-wrap',fontFamily:'inherit',fontSize:13,overflowWrap:'anywhere'}}>{draft.text}</pre>
   <button type="button" className={styles.mainButton} onClick={async()=>{try{await navigator.clipboard.writeText(draft.text);setCopied(true);setError('');}catch{setError('Penyalinan diblokir perangkat. Pilih dan salin teks draf secara manual.');}}}>{copied?'Draf disalin':'Salin draf WhatsApp'}</button>
   {url?<><label className={styles.receiptConfirm}><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/> Saya memeriksa penerima {draft.data.contact?.phone} dan mendapat persetujuan pengiriman.</label>
    {checked&&<a className={styles.mainButton} href={url} target="_blank" rel="noopener noreferrer">Buka WhatsApp — kirim manual</a>}</>:
    <p className={styles.muted}>Nomor belum diverifikasi atau draf terlalu panjang untuk tautan. Salin draf dan periksa penerima secara manual.</p>}
  </>}
 </section>;
}
