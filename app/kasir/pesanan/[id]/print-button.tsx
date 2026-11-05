"use client";
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {preparePrintReceipt} from '../receipt-actions';
import {ThermalReceipt,type ThermalWidth} from '@/components/pos/thermal-receipt';
import type {ReceiptData} from '@/lib/pos/receipt';

export function PrintButton({orderId,role,version,isTestOrder=false}:{orderId:string;role:'owner'|'cashier';version?:number;isTestOrder?:boolean}){
 const [width,setWidth]=useState<ThermalWidth>(58),[data,setData]=useState<ReceiptData|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const sequence=useRef(0);
 useEffect(()=>{sequence.current++;setData(null);setBusy(false);setError('');return ()=>{sequence.current++;};},[orderId,role,version]);
 async function read(){
  const request=++sequence.current;setBusy(true);setError('');setData(null);
  try{
   const result=await preparePrintReceipt(role,orderId);
   if(request!==sequence.current)return;
   if(result.error||!result.data)setError(result.error||'Nota cetak belum tersedia.');
   else if(isTestOrder&&!result.data.is_test_order)setError('Penanda nota uji belum sesuai. Baca ulang nota.');
   else setData(result.data);
  }catch{if(request===sequence.current)setError('Koneksi terputus. Nota tetap tersimpan; baca ulang sebelum mencetak.');}
  finally{if(request===sequence.current)setBusy(false);}
 }
 return <section aria-label="Cetak nota thermal">
  <div className="thermal-controls">
   <label>Lebar kertas<select value={width} onChange={e=>setWidth(Number(e.target.value) as ThermalWidth)}><option value="58">58 mm</option><option value="80">80 mm</option></select></label>
   <button type="button" onClick={read} disabled={busy}>{busy?'Membaca nota…':data?'Baca ulang nota cetak':'Siapkan cetak nota'}</button>
   {data&&<button type="button" onClick={()=>window.print()} disabled={busy}>Cetak nota {width} mm</button>}
  </div>
  <p>Pilih lebar yang sama pada driver printer. Matikan header dan footer browser. Uji printer fisik tetap diperlukan; potong otomatis mengikuti perangkat.</p>
  {busy&&<p role="status">Membaca rincian pembayaran dan poin terbaru…</p>}
  {error&&<p role="alert">{error}</p>}
  {data&&<><p role="status">Nota {data.invoice} siap dicetak. Periksa pratinjau sebelum mencetak.</p><details><summary className="thermal-preview-toggle">Pratinjau nota {width} mm</summary><div className="thermal-preview"><ThermalReceipt data={data} width={width}/></div></details>
   {createPortal(<div className="thermal-print-root"><ThermalReceipt data={data} width={width}/></div>,document.body)}
  </>}
 </section>;
}
