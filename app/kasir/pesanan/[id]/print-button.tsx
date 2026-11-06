"use client";
import {useEffect,useRef,useState} from 'react';
import {createPortal,flushSync} from 'react-dom';
import {preparePrintReceipt} from '../receipt-actions';
import {ThermalReceipt,type ThermalWidth} from '@/components/pos/thermal-receipt';
import {validateReceiptData,type ReceiptData} from '@/lib/pos/receipt';

export function PrintButton({orderId,role,version,isTestOrder=false}:{orderId:string;role:'owner'|'cashier';version?:number;isTestOrder?:boolean}){
 const [width,setWidth]=useState<ThermalWidth>(58),[data,setData]=useState<ReceiptData|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const sequence=useRef(0);
 useEffect(()=>{try{const saved=localStorage.getItem('masjawa.thermal-width');if(saved==='58'||saved==='80')setWidth(Number(saved) as ThermalWidth);}catch{}},[]);
 function paper(value:string){if(value!=='58'&&value!=='80')return;setWidth(Number(value) as ThermalWidth);try{localStorage.setItem('masjawa.thermal-width',value);}catch{}}
 function checked(value:ReceiptData){const valid=validateReceiptData(value,{requireSnapshot:true});if(valid.order_id!==orderId)throw Error('Nota cetak tidak sesuai pesanan.');if(isTestOrder&&!valid.is_test_order)throw Error('Penanda nota uji belum sesuai. Baca ulang nota.');return valid;}
 function fingerprint(value:ReceiptData){
  const {snapshot_at,point_simulation,...content}=value;
  if(!point_simulation)return JSON.stringify({...content,point_simulation});
  const {calculated_at,...simulation}=point_simulation;
  return JSON.stringify({...content,point_simulation:simulation});
 }
 async function print(){
  if(!data||busy)return;
  const preview=data,request=++sequence.current;setBusy(true);setError('');
  try{
   const result=await preparePrintReceipt(role,orderId);
   if(request!==sequence.current)return;
   if(result.error||!result.data)throw Error(result.error||'Nota cetak belum tersedia.');
   const latest=checked(result.data);
   if(fingerprint(preview)!==fingerprint(latest)){setData(latest);setError('Nota berubah. Periksa pratinjau terbaru, lalu tekan Cetak nota kembali.');return;}
   flushSync(()=>setData(latest));
   window.print();
  }catch{if(request===sequence.current){setData(null);setError('Nota terbaru gagal diverifikasi. Baca ulang sebelum mencetak.');}}
  finally{if(request===sequence.current)setBusy(false);}
 }
 useEffect(()=>{sequence.current++;setData(null);setBusy(false);setError('');return ()=>{sequence.current++;};},[orderId,role,version]);
 async function read(){
  const request=++sequence.current;setBusy(true);setError('');setData(null);
  try{
   const result=await preparePrintReceipt(role,orderId);
   if(request!==sequence.current)return;
   if(result.error||!result.data)setError(result.error||'Nota cetak belum tersedia.');
   else setData(checked(result.data));
  }catch{if(request===sequence.current)setError('Koneksi terputus. Nota tetap tersimpan; baca ulang sebelum mencetak.');}
  finally{if(request===sequence.current)setBusy(false);}
 }
 return <section aria-label="Cetak nota thermal">
  <div className="thermal-controls">
   <label>Lebar kertas<select value={width} onChange={e=>paper(e.target.value)}><option value="58">58 mm</option><option value="80">80 mm</option></select></label>
   <button type="button" onClick={read} disabled={busy}>{busy?'Membaca nota…':data?'Baca ulang nota cetak':'Siapkan cetak nota'}</button>
   {data&&<button type="button" onClick={print} disabled={busy}>Cetak nota {width} mm</button>}
  </div>
  <p>Pilih lebar yang sama pada driver printer. Matikan header dan footer browser. Uji printer fisik tetap diperlukan; potong otomatis mengikuti perangkat.</p>
  {busy&&<p role="status">Membaca rincian pembayaran dan poin terbaru…</p>}
  {error&&<p role="alert">{error}</p>}
  {data&&<><p role="status">Nota {data.invoice} siap dicetak. Periksa pratinjau sebelum mencetak.</p><details><summary className="thermal-preview-toggle">Pratinjau nota {width} mm</summary><div className="thermal-preview"><ThermalReceipt data={data} width={width}/></div></details>
   {createPortal(<div className="thermal-print-root"><ThermalReceipt data={data} width={width}/></div>,document.body)}
  </>}
 </section>;
}
