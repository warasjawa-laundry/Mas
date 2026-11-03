import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound,redirect } from "next/navigation";
import { cashierRpcAccess } from "@/lib/pos/g4-server";
import { formatIdr } from "@/lib/pos/g4-order";
import { hasCashierGrant } from "@/lib/pos/cashier-permissions";
import { advanceWorkStatus,cancelCashierOrder } from "../actions";
import { collectCashierPayment,openCashierShift,refundCashierOrder } from "../payment-actions";
import { PrintButton } from "./print-button";
import { WhatsAppDraft } from "./whatsapp-draft";
import styles from "../orders.module.css";
import RecoverableForm from "@/components/admin/recoverable-form";
import PendingSubmit from "@/components/admin/pending-submit";
import {commandRecoveryKey} from "@/lib/pos/command-recovery";
import {recoverCashierCommand} from "../recovery-actions";

import OrderTimeline,{type OrderEvent} from "@/components/pos/order-timeline";
export const dynamic="force-dynamic";
type Item={service_name:string;unit:string;quantity_milli:number;price_idr:number;line_total_idr:number;duration?:string;package_name?:string;due_at?:string|null};
type Order={id:string;invoice_no:string;customer_name:string;total_idr:string;work_status:string;lifecycle_status:string;created_at:string;perfume:string|null;notes:string|null;created_staff_id:string;items:Item[];events?:OrderEvent[];due_at?:string|null};
type Receipt={id:string;type:'RECEIPT'|'REFUND';method:'CASH'|'NONCASH';amount_idr:string;at:string};
type Finance={order_id:string;total_idr:string;paid_idr:string;refunded_idr:string;remaining_idr:string;payment_status:'UNPAID'|'PARTIAL'|'PAID'|'REFUNDED'|'ZERO_TOTAL';version:number;shift_open:boolean;finance_enabled?:boolean;receipts:Receipt[]};
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
 const target=o.lifecycle_status!=='CONFIRMED'?null:o.work_status==='QUEUED'?'PROCESSING':o.work_status==='PROCESSING'?'READY':o.work_status==='READY'?'COLLECTED':null;
 const canCollect=hasCashierGrant(access.session.permissions,'payment_collect');
 const canRefund=hasCashierGrant(access.session.permissions,'refund_full');
 const wantsRetry=query.error==='payment-unconfirmed'&&!!query.retry&&uuid.test(query.retry);
 const wantsRefundRetry=query.error==='refund-unconfirmed'&&!!query.retryRefund&&uuid.test(query.retryRefund);
 const paymentReq=wantsRetry?query.retry!:randomUUID();
 const refundReq=wantsRefundRetry?query.retryRefund!:randomUUID();
 const totalDue=f?BigInt(f.remaining_idr):BigInt(0);
 const showPay=o.lifecycle_status==='CONFIRMED'&&!!f && (f.payment_status==='UNPAID'||f.payment_status==='PARTIAL') && totalDue>BigInt(0);
 const hasReceipts=!!f&&f.receipts.some(r=>r.type==='RECEIPT');
 const canWrite=access.session.write_enabled;
 const canFinance=canWrite&&f?.finance_enabled===true;
 return <main className={styles.shell}>
  <Link href="/kasir/pesanan">← Daftar pesanan</Link>
  <header className={styles.header}><div><p className={styles.kicker}>MAS JAWA LAUNDRY · {access.session.username}</p>
  <h1>{o.invoice_no}</h1>
  <p className={styles.muted}><strong>{o.customer_name}</strong> · {new Date(o.created_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB</p></div>{hasCashierGrant(access.session.permissions,'receipt_print')&&<PrintButton/>}</header>
  {query.error&&<p className={styles.warning} role="alert">
   {query.error.includes('unconfirmed')?'Hasil transaksi belum terkonfirmasi. Periksa daftar pembayaran sebelum mencoba kembali dengan request yang SAMA.':
     'Perubahan belum terkonfirmasi. Periksa status nota sebelum mengulangi tindakan.'}
  </p>}
  {query.saved&&<p className={styles.ok} role="status">{query.saved==='payment'?'Pembayaran tercatat.':query.saved==='refund'?'Pengembalian penuh tercatat.':query.saved==='shift'?'Kas dibuka.':query.saved==='cancelled'?'Nota dibatalkan.':'Status tersimpan.'}</p>}
  {o.customer_name.startsWith('UJI - ')&&<p className={styles.warning} role="status"><strong>NOTA UJI.</strong> Jangan menerima pembayaran sungguhan, mengirim WhatsApp ke pelanggan, atau menggunakan member asli pada transaksi tes.</p>}
  {o.lifecycle_status==='CANCELLED'&&<p className={styles.warning} role="status">Nota dibatalkan. Riwayat transaksi tetap tersimpan.</p>}
  <div className={styles.detailGrid}>
  <section className={styles.card} aria-labelledby="items-title"><h2 id="items-title">Rincian pesanan</h2>
   {o.items.map((i,j)=><div key={j} className={styles.item}><div>{i.service_name}{i.package_name?" · "+i.package_name:""}<small>{i.duration||"Durasi belum tercatat"} · {(Number(i.quantity_milli)/1000).toLocaleString('id-ID')} {i.unit} × {money(i.price_idr)}</small>{i.due_at&&<small>Estimasi {new Date(i.due_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB</small>}</div><strong>{money(i.line_total_idr)}</strong></div>)}
   <p>Estimasi seluruh pesanan selesai: <strong>{o.due_at?new Date(o.due_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB':'Belum pasti'}</strong></p>
   <div className={styles.item}><strong>Total tagihan</strong><strong>{money(o.total_idr)}</strong></div>
   {o.perfume&&<p>Parfum: {o.perfume}</p>}{o.notes&&<p>Catatan: {o.notes}</p>}
  </section>
  <section className={`${styles.card} ${styles.paymentCard}`} aria-labelledby="payment-title"><div className={styles.cardHeading}>
    <h2 id="payment-title">Pembayaran</h2><span className={styles.paymentBadge}>{f?labels[f.payment_status]:'Belum tersedia'}</span></div>
   {!f?<p className={styles.warning}>Ringkasan pembayaran belum tersedia. Pembayaran belum dapat dicatat.</p>:<>
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
    {canCollect&&<RecoverableForm action={openCashierShift}
      recoveryKey={commandRecoveryKey('cashier',access.session.staff_id,'OPEN_SHIFT')} recoverAction={recoverCashierCommand.bind(null,'OPEN_SHIFT',o.id)}>
     {!f.shift_open&&<div className={styles.mutedPanel}>
      <strong>Kas utama belum dibuka</strong><p className={styles.muted}>Buka kas untuk mencatat penerimaan pada shift petugas. Saldo awal kas ini nol.</p>
      <input type="hidden" name="orderId" value={o.id}/><input type="hidden" name="requestId" value={randomUUID()}/>
       <PendingSubmit className={styles.mainButton} disabled={!canFinance} label="Buka kas utama"/>
    </div>}</RecoverableForm>}
    {canCollect&&<RecoverableForm action={collectCashierPayment} className={styles.paymentForm}
      recoveryKey={commandRecoveryKey('cashier',access.session.staff_id,'PAYMENT',o.id)} recoverAction={recoverCashierCommand.bind(null,'PAYMENT',o.id)}>
     {showPay&&<>
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
      <p id="payment-help" className={styles.muted}>Cocokkan nominal dan metode dengan pembayaran yang diterima. Jangan terima pembayaran lagi jika transaksi sebelumnya belum jelas.</p>
      <PendingSubmit className={styles.mainButton} disabled={!canFinance||!f.shift_open} label="Simpan pembayaran"/>
    </>}</RecoverableForm>}
    {hasReceipts&&canRefund&&<RecoverableForm action={refundCashierOrder} className={styles.paymentForm}
      recoveryKey={commandRecoveryKey('cashier',access.session.staff_id,'FULL_REFUND',o.id)} recoverAction={recoverCashierCommand.bind(null,'FULL_REFUND',o.id)}>
     {f.payment_status!=='REFUNDED'&&<details className={styles.refundPanel}>
     <summary>Pengembalian dana penuh</summary>
      <input type="hidden" name="orderId" value={o.id}/><input type="hidden" name="requestId" value={refundReq}/>
      <input type="hidden" name="expectedVersion" value={wantsRefundRetry?query.version??String(f.version):String(f.version)}/>
      <label>Alasan refund<input name="reason" minLength={3} maxLength={300} required defaultValue={''} placeholder="Alasan wajib dicatat"/></label>
      <p className={styles.muted}>Semua pembayaran akan dikembalikan sesuai metode asal. Jika hasil sebelumnya tidak diketahui, cocokkan jurnal dan ulangi hanya dengan alasan serta ID request yang sama.</p>
      <PendingSubmit className={styles.dangerButton} disabled={!canFinance||!f.shift_open} label="Konfirmasi refund penuh"/>
    </details>}</RecoverableForm>}
    {!canFinance&&<p className={styles.warning} role="status">Transaksi finansial POS masih dikunci. Nota dan riwayat tetap dapat dilihat, tetapi pembayaran dan refund belum bisa diproses.</p>}
   </>}
  </section>
  <section className={styles.card}><h2>Status cucian</h2><p className={styles.muted}>Serah terima hanya setelah lunas. Nota gratis, refund dan sengketa memerlukan kebijakan terpisah.</p>
   <p>Proses: <strong>{o.work_status==='PROCESSING'?'Diproses':o.work_status==='READY'?'Siap diambil':o.work_status==='COLLECTED'?'Sudah diambil':'Antrian'}</strong></p>
   <p className={styles.muted}>Status pengerjaan dicatat terpisah dari pembayaran.</p>
   {hasCashierGrant(access.session.permissions,'order_work')&&<RecoverableForm action={advanceWorkStatus}
    recoveryKey={commandRecoveryKey('cashier',access.session.staff_id,'SET_WORK',o.id)} recoverAction={recoverCashierCommand.bind(null,'SET_WORK',o.id)}>
    {target&&<>
    <input name="orderId" type="hidden" value={o.id}/><input name="requestId" type="hidden" value={randomUUID()}/>
    <input name="target" type="hidden" value={target}/>
    <PendingSubmit className={styles.mainButton} disabled={!canWrite||(target==='COLLECTED'&&f?.payment_status!=='PAID')} label={`Ubah ke ${target==='PROCESSING'?'Mulai proses':target==='READY'?'Siap Diambil':'Sudah Diambil'}`}/>
   </>}</RecoverableForm>}
   {f&&hasCashierGrant(access.session.permissions,'order_work')&&<RecoverableForm action={cancelCashierOrder}
    recoveryKey={commandRecoveryKey('cashier',access.session.staff_id,'CANCEL',o.id)} recoverAction={recoverCashierCommand.bind(null,'CANCEL',o.id)}>
    {o.lifecycle_status==='CONFIRMED'&&f.paid_idr===f.refunded_idr&&<details className={styles.refundPanel}>
     <summary>Batalkan nota</summary>
     <input name="orderId" type="hidden" value={o.id}/><input name="requestId" type="hidden" value={randomUUID()}/>
     <input name="expectedVersion" type="hidden" value={String(f.version)}/>
     <label>Alasan pembatalan<input name="reason" minLength={3} maxLength={300} required/></label>
     <p className={styles.muted}>Pembatalan hanya tersedia jika tidak ada dana diterima atau refund penuh sudah selesai. Riwayat tidak dihapus.</p>
     <PendingSubmit className={styles.dangerButton} disabled={!canWrite} label="Konfirmasi pembatalan nota"/>
    </details>}
   </RecoverableForm>}
  </section>
  <section className={styles.card}><OrderTimeline events={o.events??[]}/></section></div>
  {o.lifecycle_status==='CONFIRMED'&&hasCashierGrant(access.session.permissions,"whatsapp_draft")&&<WhatsAppDraft key={o.id} role="cashier" orderId={o.id} workStatus={o.work_status} version={f?.version??0}/>}
 </main>;
}
