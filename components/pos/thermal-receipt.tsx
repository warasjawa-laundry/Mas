import {validateReceiptData,type ReceiptData} from '@/lib/pos/receipt';
import './thermal-receipt.css';

export type ThermalWidth=58|80;
const money=(value:string)=>'Rp'+BigInt(value).toLocaleString('id-ID');
const date=(value:string|null)=>value?new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)).replace(/(\d{2})\.(\d{2})$/,'$1:$2')+' WIB':'Belum ditentukan';
const humanActor=(value:string)=>value.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,'').replace(/[+()]+/g,'').trim()||'Petugas outlet';
function Amount({label,value}:{label:string;value:string}){
 return <div className="thermal-amount-row"><span>{label} : </span><span className="thermal-nominal">{money(value)}</span></div>;
}
export function ThermalReceipt({data,width=58}:{data:ReceiptData;width?:ThermalWidth}){
 const r=validateReceiptData(data),c=r.settings.config;
 const closed=r.status==='REFUNDED'||r.status==='CANCELLED'||r.work_status==='CANCELLED';
 const status=r.work_status==='CANCELLED'&&r.status!=='REFUNDED'?'DIBATALKAN':({UNPAID:'BELUM BAYAR',PARTIAL:'DP',PAID:'LUNAS',REFUNDED:'REFUND',CANCELLED:'DIBATALKAN',ZERO_TOTAL:'TAGIHAN NOL, PERIKSA NOTA'} as Record<string,string>)[r.status];
 const terms=c.terms?.split(/\r?\n/).map(line=>line.trim()).find(Boolean);
 return <article className="thermal-receipt" data-width={width} aria-label={`Nota thermal ${width} mm`}>
  {r.is_test_order&&<div className="thermal-heading">NOTA UJI - SIMULASI<br/>BUKAN BUKTI PEMBAYARAN NYATA</div>}
  <header><div className="thermal-heading">{c.outlet_name}</div><div>{c.address}</div><div>{c.contact}</div><div className="thermal-heading">{r.invoice}</div></header>
  <hr/>
  <div>Pelanggan : {r.customer}</div><div>Kasir : {humanActor(r.actor)}</div>
  <div>Masuk : {date(r.created_at)}</div><div>Est Selesai : {date(r.due_at)}</div>
  <div>Paket : {r.package||'Lihat rincian layanan'}</div>
  <hr/>
  {r.items.map((item,index)=><section className="thermal-item" key={index}>
   <div className="thermal-heading">{item.name}{item.package?` (${item.package})`:''}</div>
   <div>{(item.quantity_milli/1000).toLocaleString('id-ID',{maximumFractionDigits:3})} {item.unit} x {money(item.price)}</div>
   <Amount label="Subtotal" value={item.subtotal}/>
  </section>)}
  <hr/>
  <div>Parfum : {r.perfume||'Tidak dicatat'}</div>{r.notes&&<div>Catatan : {r.notes}</div>}
  {r.delivery&&r.delivery.code!=='NONE'&&<Amount label={`Antar-Jemput (${r.delivery.name})`} value={r.delivery.amount_idr}/>}
  {r.fees_idr&&BigInt(r.fees_idr)>BigInt(r.delivery?.amount_idr||'0')&&<Amount label="Biaya lainnya" value={String(BigInt(r.fees_idr)-BigInt(r.delivery?.amount_idr||'0'))}/>}
  {r.discount_idr&&r.discount_idr!=='0'&&<Amount label="Diskon" value={r.discount_idr}/>}
  <hr/>
  {r.is_test_order&&<div className="thermal-heading">PEMBAYARAN SIMULASI</div>}
  <Amount label="Total Tagihan" value={r.total}/><Amount label="Pembayaran diterima" value={r.paid}/><Amount label="Sisa Tagihan" value={closed?'0':r.remaining}/>
  <div className="thermal-heading">Status : {status}</div>
  {r.refunded!=='0'&&<Amount label="Refund" value={r.refunded}/>}
  {closed&&<div>Nota ditutup. Tidak ada tagihan baru.</div>}
  {r.member&&<div>Poin aktif : {r.member.balance}{r.status==='PAID'?` (transaksi +${r.member.awarded})`:''}</div>}
  <hr/><footer>{terms&&<div>{terms}</div>}<div>{c.cs}</div></footer>
 </article>;
}
