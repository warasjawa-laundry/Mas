import Link from 'next/link';
import {validateReceiptData,type ReceiptData} from '@/lib/pos/receipt';
import {formatIdr} from '@/lib/pos/g4-order';
import {paymentMethodLabel} from '@/lib/pos/ui-labels';
import styles from '@/app/kasir/pesanan/orders.module.css';

export default function SystemOrderDetail({snapshot,role,canViewCash,version}:{snapshot:ReceiptData|null;role:'owner'|'cashier';canViewCash:boolean;version?:number}){
 let data:ReceiptData;
 try{
  if(!snapshot)throw Error('Missing snapshot');
  data=validateReceiptData(snapshot,{requireSnapshot:true});
  if(version!==undefined&&data.order_version!==String(version))throw Error('Changed snapshot');
 }catch{return <section className={styles.card}><h2>Audit transaksi</h2><p role="status">Rincian audit belum tersedia atau transaksi baru berubah. Buka kembali nota untuk membaca data terbaru.</p></section>;}
 const receipts=[...(data.payments??[]).map(p=>({...p,type:'Pembayaran'})),...(data.refunds??[]).map(p=>({...p,type:'Refund'}))].sort((a,b)=>Date.parse(a.received_at)-Date.parse(b.received_at));
 return <section className={styles.card} aria-label="Audit transaksi internal">
  <h2>Audit transaksi</h2><p>Pembuat nota: <strong>{data.actor}</strong></p>
  <p className={styles.muted}>Snapshot {new Date(data.snapshot_at!).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB · versi nota {data.order_version} · versi pembayaran {data.payment_version}</p>
  <p>Kontak nota: {data.contact?.phone??data.contact_draft?.phone??'Belum dicatat'}{data.contact?.verified_at?' · Terverifikasi':' · Belum diverifikasi'}</p>
  {(data.contact?.address||data.contact_draft?.address)&&<p>Alamat: {data.contact?.address||data.contact_draft?.address}</p>}
  {receipts.length===0?<p>Belum ada pembayaran terkonfirmasi.</p>:receipts.map((p,index)=><div className={styles.receipt} key={p.payment_id??index}>
   <div><strong>{p.type} · {paymentMethodLabel(p.method)}</strong><small>Penerima/petugas: {p.receiver} · {new Date(p.received_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB</small>
    {p.internal_reference&&<small style={{overflowWrap:'anywhere'}}>Referensi internal: {p.internal_reference}</small>}
    {p.original_receipt_id&&<small style={{overflowWrap:'anywhere'}}>Pembayaran asal: {p.original_receipt_id}</small>}
    {canViewCash&&p.cash_ledger_id&&<Link className={styles.mainLink} href={`${role==='owner'?'/admin':'/kasir'}/kas#mutasi-${p.cash_ledger_id}`}>Lihat mutasi terkait</Link>}
   </div><strong>{p.type==='Refund'?'−':'+'}{formatIdr(p.amount_idr)}</strong>
  </div>)}
  {data.member&&<p>Poin member {data.member.year}: {data.member.balance} poin aktif · {data.member.awarded} poin dari nota ini.</p>}
  {data.status==='REFUNDED'||data.work_status==='CANCELLED'?<p>Nota ditutup. Tidak ada tagihan baru.</p>:null}
 </section>;
}
