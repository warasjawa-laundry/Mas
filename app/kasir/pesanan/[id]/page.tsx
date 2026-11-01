import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound,redirect } from "next/navigation";
import { cashierRpcAccess } from "@/lib/pos/g4-server";
import { formatIdr } from "@/lib/pos/g4-order";
import { hasCashierGrant } from "@/lib/pos/cashier-permissions";
import { advanceWorkStatus } from "../actions";
import { collectCashierPayment,openCashierShift,refundCashierOrder } from "../payment-actions";
import { PrintButton } from "./print-button";
import styles from "../orders.module.css";

export const dynamic="force-dynamic";
type Item={service_name:string;unit:string;quantity_milli:number;price_idr:number;line_total_idr:number};
type Order={id:string;invoice_no:string;customer_name:string;total_idr:string;work_status:string;lifecycle_status:string;created_at:string;perfume:string|null;notes:string|null;created_staff_id:string;items:Item[]};
type Receipt={id:string;type:'RECEIPT'|'REFUND';method:'CASH'|'NONCASH';amount_idr:string;at:string};
type Finance={order_id:string;total_idr:string;paid_idr:string;refunded_idr:string;remaining_idr:string;payment_status:'UNPAID'|'PARTIAL'|'PAID'|'REFUNDED'|'ZERO_TOTAL';version:number;shift_open:boolean;receipts:Receipt[]};
type Search={error?:string;saved?:string;retry?:string;amount?:string;method?:string;version?:string;retryRefund?:string;reason?:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const labels={UNPAID:'Belum bayar',PARTIAL:'Bayar sebagian',PAID:'Lunas',REFUNDED:'Sudah direfund',ZERO_TOTAL:'Gratis'} as const;
const money=(v:string|number)=>formatIdr(v);

export default async function OrderDetails({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Search>}){
 const [{id},query]=await Promise.all([params,searchParams]);
 if(!uuid.test(id))notFound();
 const access=await cashierRpcAccess("order_view");
 if(!access)redirect("/kasir");
 const [detail,summary]=await Promise.all([
   access.client.rpc("laundry_pos_g4_order_detail",{...access.tokens,p_order_id:id}),
   access.client.rpc("laundry_pos_g5_financial",{...access.tokens,p_order_id:id}),
 ]);
 if(detail.error||!detail.data||typeof detail.data!=="object"||!detail.data.id){
  return <main className={styles.shell}><Link href="/kasir/pesanan">← Daftar pesanan</Link><p role="alert" className={styles.warning}>Nota tidak ditemukan atau modul belum tersedia.</p></main>;
 }
 const o=detail.data as Order;
 const f=summary.error||!summary.data||typeof summary.data!=="object"||!summary.data.payment_status?null:summary.data as Finance;
 const target=o.work_status==='QUEUED'?'READY':o.work_status==='READY'?'COLLECTED':null;
 const canCollect=hasCashierGrant(access.session.permissions,'payment_collect');
 const canRefund=hasCashierGrant(access.session.permissions,'refund_full');
 const wantsRetry=query.error==='payment-unconfirmed'&&!!query.retry&&uuid.test(query.retry);
 const wantsRefundRetry=query.error==='refund-unconfirmed'&&!!query.retryRefund&&uuid.test(query.retryRefund);
 const paymentReq=wantsRetry?query.retry!:randomUUID();
 const refundReq=wantsRefundRetry?query.retryRefund!:randomUUID();
 const totalDue=f?BigInt(f.remaining_idr):BigInt(0);
 const showPay=!!f && (f.payment_status==='UNPAID'||f.payment_status==='PARTIAL') && totalDue>BigInt(0);
 const hasReceipts=!!f&&f.receipts.some(r=>r.type==='RECEIPT');
 const canWrite=access.session.write_enabled;
 return <main className={styles.shell}>
  <Link href="/kasir/pesanan">← Daftar pesanan</Link>
  <p className={styles.kicker}>MAS JAWA LAUNDRY · {access.session.username}</p>
  <h1>{o.invoice_no}</h1>
  <p><strong>{o.customer_name}</strong> · {new Date(o.created_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB</p>
  {query.error&&<p className={styles.warning} role="alert">
   {query.error.includes('unconfirmed')?'Hasil transaksi belum terkonfirmasi. Periksa daftar pembayaran sebelum mencoba kembali dengan request yang SAMA.':
     'Perubahan belum terkonfirmasi. Periksa status nota sebelum mengulangi tindakan.'}
  </p>}
  {query.saved&&<p className={styles.ok} role="status">{query.saved==='payment'?'Pembayaran tercatat.':query.saved==='refund'?'Pengembalian penuh tercatat.':query.saved==='shift'?'Kas dibuka.':'Status tersimpan.'}</p>}
  <PrintButton/>
  <section className={styles.card} aria-labelledby="items-title"><h2 id="items-title">Rincian pesanan</h2>
   {o.items.map((i,j)=><div key={j} className={styles.item}><div>{i.service_name}<small>{(Number(i.quantity_milli)/1000).toLocaleString('id-ID')} {i.unit} × {money(i.price_idr)}</small></div><strong>{money(i.line_total_idr)}</strong></div>)}
   <div className={styles.item}><strong>Total tagihan</strong><strong>{money(o.total_idr)}</strong></div>
   {o.perfume&&<p>Parfum: {o.perfume}</p>}{o.notes&&<p>Catatan: {o.notes}</p>}
  </section>
  <section className={styles.card} aria-labelledby="payment-title"><div className={styles.cardHeading}>
    <h2 id="payment-title">Pembayaran</h2><span className={styles.paymentBadge}>{f?labels[f.payment_status]:'Belum tersedia'}</span></div>
   {!f?<p className={styles.warning}>Ringkasan finansial belum tersedia. Pembayaran tidak dapat dicatat hingga migrasi G5 diaktifkan.</p>:<>
    <div className={styles.paymentTotals}>
      <div><small>Total nota</small><strong>{money(f.total_idr)}</strong></div>
      <div><small>Sudah diterima</small><strong>{money(f.paid_idr)}</strong></div>
      <div className={styles.remaining}><small>Sisa pembayaran</small><strong>{money(f.remaining_idr)}</strong></div>
    </div>
    {f.refunded_idr!=='0'&&<p className={styles.muted}>Total dikembalikan: {money(f.refunded_idr)}</p>}
    {f.receipts.length>0&&<div className={styles.receiptList} aria-label="Riwayat pembayaran">
      {f.receipts.map(r=><div className={styles.receipt} key={r.id}>
       <span>{r.type==='REFUND'?'Refund':'Pembayaran'} · {r.method==='CASH'?'Tunai':'Non-tunai'}<small>{new Date(r.at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB</small></span>
       <strong>{r.type==='REFUND'?'−':'+'}{money(r.amount_idr)}</strong>
      </div>)}
    </div>}
    {canCollect&&!f.shift_open&&<div className={styles.mutedPanel}>
      <strong>Kas utama belum dibuka</strong><p className={styles.muted}>Buka kas agar setiap penerimaan ditautkan ke jurnal dan petugas. Saldo awal nol; pengelolaan shift lengkap tersedia pada G6.</p>
      <form action={openCashierShift}><input type="hidden" name="orderId" value={o.id}/><input type="hidden" name="requestId" value={randomUUID()}/>
       <button className={styles.mainButton} disabled={!canWrite}>Buka kas utama</button></form>
    </div>}
    {showPay&&canCollect&&<form action={collectCashierPayment} className={styles.paymentForm}>
      <h3>{f.payment_status==='PARTIAL'?'Terima sisa / cicilan':'Terima pembayaran'}</h3>
      <input type="hidden" name="orderId" value={o.id}/>
      <input type="hidden" name="requestId" value={paymentReq}/>
      <input type="hidden" name="expectedVersion" value={wantsRetry?query.version??String(f.version):String(f.version)}/>
      <label>Jumlah pembayaran (Rp)
       <input name="amountIdr" inputMode="numeric" autoComplete="off" required pattern="[1-9][0-9]*" maxLength={10}
       defaultValue={wantsRetry?query.amount:f.remaining_idr} aria-describedby="payment-help"/>
      </label>
      <label>Metode pembayaran<select name="method" defaultValue={wantsRetry?query.method:'CASH'}>
       <option value="CASH">Tunai</option><option value="NONCASH">Non-tunai (dikonfirmasi petugas)</option></select></label>
      <p id="payment-help" className={styles.muted}>Poin member hanya diberikan sekali ketika seluruh tagihan sudah dibayar. Jangan terima pembayaran lagi jika transaksi sebelumnya belum jelas.</p>
      <button className={styles.mainButton} disabled={!canWrite||!f.shift_open}>Simpan pembayaran</button>
    </form>}
    {hasReceipts&&f.payment_status!=='REFUNDED'&&canRefund&&<details className={styles.refundPanel}>
     <summary>Pengembalian dana penuh</summary>
     <form action={refundCashierOrder} className={styles.paymentForm}>
      <input type="hidden" name="orderId" value={o.id}/><input type="hidden" name="requestId" value={refundReq}/>
      <input type="hidden" name="expectedVersion" value={wantsRefundRetry?query.version??String(f.version):String(f.version)}/>
      <label>Alasan refund<input name="reason" minLength={3} maxLength={300} required defaultValue={''} placeholder="Alasan wajib dicatat"/></label>
      <p className={styles.muted}>Semua pembayaran akan dikembalikan sesuai metode asal; poin yang telah diberikan akan dibatalkan. Jika hasil sebelumnya tidak diketahui, cocokkan jurnal dan ulangi hanya dengan alasan serta ID request yang sama.</p>
      <button type="submit" className={styles.dangerButton} disabled={!canWrite||!f.shift_open}>Konfirmasi refund penuh</button>
     </form>
    </details>}
    {!canWrite&&<p className={styles.warning} role="status">Transaksi POS masih dikunci. Nota dan riwayat tetap dapat dilihat, tetapi pembayaran dan refund belum bisa diproses.</p>}
   </>}
  </section>
  <section className={styles.card}><h2>Status cucian</h2>
   <p>Proses: <strong>{o.work_status==='READY'?'Siap diambil':o.work_status==='COLLECTED'?'Sudah diambil':'Antrian'}</strong></p>
   <p className={styles.muted}>Status pengerjaan tidak memicu pembayaran atau poin.</p>
   {target&&hasCashierGrant(access.session.permissions,'order_work')&&<form action={advanceWorkStatus}>
    <input name="orderId" type="hidden" value={o.id}/><input name="requestId" type="hidden" value={randomUUID()}/>
    <input name="target" type="hidden" value={target}/>
    <button className={styles.mainButton} type="submit" disabled={!canWrite}>Ubah ke {target==='READY'?'Siap Diambil':'Sudah Diambil'}</button>
   </form>}
  </section>
 </main>;
}