import Link from "next/link";
import {randomUUID} from "node:crypto";
import {notFound} from "next/navigation";
import {requireOwner} from "@/lib/supabase/owner";
import PosWorkspace from "@/components/pos/pos-workspace";
import RecoverableForm from "@/components/admin/recoverable-form";
import PendingSubmit from "@/components/admin/pending-submit";
import {commandRecoveryKey} from "@/lib/pos/command-recovery";
import {formatIdr} from "@/lib/pos/g4-order";
import {WhatsAppDraft} from "@/app/kasir/pesanan/[id]/whatsapp-draft";
import {PrintButton} from "@/app/kasir/pesanan/[id]/print-button";
import {collectOwnerPayment,refundOwnerOrder,openOwnerShift,advanceOwnerWork,cancelOwnerOrder,recoverOwnerOperation} from "../operations-actions";
import styles from "@/app/kasir/pesanan/orders.module.css";
import OrderTimeline,{type OrderEvent} from "@/components/pos/order-timeline";
export const dynamic="force-dynamic";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Item={service_name:string;unit:string;quantity_milli:number;price_idr:string|number;line_total_idr:string|number;duration?:string;package_name?:string;due_at?:string|null};
type Row={id:string;invoice_no:string;customer_name:string;created_at:string;total_idr:string|number;work_status:string;payment_status:string;items:Item[];events?:OrderEvent[];lifecycle_status?:string;due_at?:string|null};
type Receipt={id:string;type:string;method:string;amount_idr:string;at:string};
type Finance={total_idr:string;paid_idr:string;refunded_idr:string;remaining_idr:string;payment_status:string;version:number;shift_open:boolean;receipts:Receipt[]};
const date=(value:string)=>new Date(value).toLocaleString("id-ID",{timeZone:"Asia/Jakarta"})+" WIB";
const labels:Record<string,string>={UNPAID:"Belum bayar",PARTIAL:"Bayar sebagian",PAID:"Lunas",REFUNDED:"Sudah direfund",ZERO_TOTAL:"Gratis"};
export default async function OwnerInvoice({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{saved?:string}>}){
 const [{id},query]=await Promise.all([params,searchParams]);if(!uuid.test(id))notFound();
 const {supabase,user}=await requireOwner();
 const [detail,financial,capabilities]=await Promise.all([
  supabase.rpc("laundry_pos_owner_order_detail",{p_order_id:id}),
  supabase.rpc("laundry_pos_owner_financial",{p_order_id:id}),
  supabase.rpc("laundry_pos_owner_capabilities"),
 ]);
 const row=!detail.error&&detail.data&&typeof detail.data.id==="string"?detail.data as Row:null;
 const finance:Finance|null=!financial.error&&financial.data&&typeof financial.data.payment_status==="string"
  &&Array.isArray(financial.data.receipts)&&Number.isSafeInteger(financial.data.version)?financial.data as Finance:null;
 const support=!capabilities.error&&capabilities.data?.owner_operations===true;
 const canWrite=support&&capabilities.data?.write_enabled===true;
 const canFinance=canWrite&&capabilities.data?.finance_enabled===true;
 const target=row?.lifecycle_status!=="CONFIRMED"?null:row?.work_status==="QUEUED"?"PROCESSING":row?.work_status==="PROCESSING"?"READY":row?.work_status==="READY"?"COLLECTED":null;
 const showPay=row?.lifecycle_status==="CONFIRMED"&&finance&&["UNPAID","PARTIAL"].includes(finance.payment_status)&&/^[1-9][0-9]*$/.test(finance.remaining_idr);
 const refundable=row?.lifecycle_status==="CONFIRMED"&&finance&&finance.receipts.some(r=>r.type==="RECEIPT")&&finance.payment_status!=="REFUNDED";
 const cancellable=row?.lifecycle_status==="CONFIRMED"&&finance&&(finance.paid_idr==="0"||finance.paid_idr===finance.refunded_idr);
 return <PosWorkspace title={row?row.invoice_no:"Rincian Pesanan"} category="POS MANAJER" backHref="/admin" description="Nota dan transaksi melalui sesi Owner.">
 {!row?<><p role="status" className="binatu-inline-notice">Rincian nota belum tersedia atau pesanan sudah dibatalkan.</p>
 <RecoverableForm action={cancelOwnerOrder} recoveryKey={commandRecoveryKey('owner',user.id,'CANCEL',id)} recoverAction={recoverOwnerOperation.bind(null,'CANCEL',id)}>{null}</RecoverableForm>
 <RecoverableForm action={advanceOwnerWork} recoveryKey={commandRecoveryKey('owner',user.id,'SET_WORK',id)} recoverAction={recoverOwnerOperation.bind(null,'SET_WORK',id)}>{null}</RecoverableForm></>:<>
 <div className={styles.header}><p><strong>{row.customer_name}</strong> · {date(row.created_at)}</p><PrintButton/></div>
 {query.saved&&<p className={styles.ok} role="status">Perubahan sudah dikonfirmasi database.</p>}
 {!canWrite&&<p className="binatu-inline-notice" role="status">Perubahan pesanan masih dikunci. Riwayat yang tersedia tetap dapat dibaca.</p>}
 {!canFinance&&<p className="binatu-inline-notice" role="status">Pembayaran, refund, dan buku kas belum diaktifkan.</p>}
 <div className={styles.detailGrid}>
 <section className={styles.card}><h2>Layanan</h2>
 {row.items.map((item,i)=><div className={styles.item} key={i}><div>{item.service_name}{item.package_name?" · "+item.package_name:""}
 <small>{item.duration||"Durasi belum tercatat"} · {(item.quantity_milli/1000).toLocaleString("id-ID")} {item.unit} × {formatIdr(item.price_idr)}</small>
 {item.due_at&&<small>Estimasi {date(item.due_at)}</small>}</div><strong>{formatIdr(item.line_total_idr)}</strong></div>)}
 <p>Estimasi seluruh pesanan selesai: <strong>{row.due_at?date(row.due_at):"Belum pasti"}</strong></p>
 <div className={styles.item}><strong>Total nota</strong><strong>{formatIdr(row.total_idr)}</strong></div></section>
 <section className={`${styles.card} ${styles.paymentCard}`}><div className={styles.cardHeading}><h2>Pembayaran</h2>
 <span className={styles.paymentBadge}>{labels[finance?.payment_status||row.payment_status]||"Belum tersedia"}</span></div>
 {!finance?<p className={styles.warning}>Ringkasan pembayaran belum tersedia.</p>:<>
 <div className={styles.paymentTotals}><div><small>Total nota</small><strong>{formatIdr(finance.total_idr)}</strong></div>
 <div><small>Sudah diterima</small><strong>{formatIdr(finance.paid_idr)}</strong></div>
 <div className={styles.remaining}><small>Sisa pembayaran</small><strong>{formatIdr(finance.remaining_idr)}</strong></div></div>
 {finance.refunded_idr!=="0"&&<p>Total dikembalikan: {formatIdr(finance.refunded_idr)}</p>}
 {finance.receipts.map(receipt=><div key={receipt.id} className={styles.receipt}><span>{receipt.type==="REFUND"?"Refund":"Pembayaran"} · {receipt.method==="CASH"?"Tunai":"Non-tunai"}<small>{date(receipt.at)}</small></span><strong>{receipt.type==="REFUND"?"−":"+"}{formatIdr(receipt.amount_idr)}</strong></div>)}
 <RecoverableForm action={openOwnerShift} className={!finance.shift_open?styles.paymentForm:undefined}
 recoveryKey={commandRecoveryKey('owner',user.id,'OPEN_SHIFT')} recoverAction={recoverOwnerOperation.bind(null,'OPEN_SHIFT',id)}>
 {!finance.shift_open&&<>
 <input type="hidden" name="requestId" value={randomUUID()}/><input type="hidden" name="orderId" value={id}/>
 <p>Kas utama belum dibuka. Saldo awal shift baru nol.</p>
 <PendingSubmit className={styles.mainButton} disabled={!canFinance} label="Buka kas utama"/></>}</RecoverableForm>
 <RecoverableForm action={collectOwnerPayment} className={showPay?styles.paymentForm:undefined}
 recoveryKey={commandRecoveryKey('owner',user.id,'PAYMENT',id)} recoverAction={recoverOwnerOperation.bind(null,'PAYMENT',id)}>
 {showPay&&<>
 <h3>Terima pembayaran</h3><input type="hidden" name="requestId" value={randomUUID()}/><input type="hidden" name="orderId" value={id}/>
 <input type="hidden" name="expectedVersion" value={String(finance.version)}/>
 <label>Jumlah pembayaran (Rp)<input name="amountIdr" inputMode="numeric" required pattern="[1-9][0-9]*" maxLength={10} defaultValue={finance.remaining_idr}/></label>
 <label>Metode pembayaran<select name="method"><option value="CASH">Tunai</option><option value="NONCASH">Non-tunai (sudah diterima)</option></select></label>
 <p className={styles.muted}>Cocokkan nominal dengan dana yang diterima. Jika hasil belum jelas, periksa jurnal sebelum mengulangi dari formulir yang sama.</p>
 <PendingSubmit className={styles.mainButton} disabled={!canFinance||!finance.shift_open} label="Simpan pembayaran"/></>}</RecoverableForm>
 <RecoverableForm action={refundOwnerOrder} className={refundable?styles.paymentForm:undefined}
 recoveryKey={commandRecoveryKey('owner',user.id,'FULL_REFUND',id)} recoverAction={recoverOwnerOperation.bind(null,'FULL_REFUND',id)}>
 {refundable&&<><h3>Pengembalian dana penuh</h3>
 <input type="hidden" name="requestId" value={randomUUID()}/><input type="hidden" name="orderId" value={id}/><input type="hidden" name="expectedVersion" value={String(finance.version)}/>
 <label>Alasan refund<input name="reason" required minLength={3} maxLength={300}/></label>
 <p className={styles.muted}>Seluruh pembayaran dikembalikan sesuai metode asal. Poin dari nota ini dibalik satu kali.</p>
 <PendingSubmit className={styles.dangerButton} disabled={!canFinance||!finance.shift_open} label="Konfirmasi refund penuh"/></>}</RecoverableForm>
 </>}
 </section>
 <section className={styles.card}><h2>Status cucian</h2><p className={styles.muted}>Serah terima hanya setelah lunas. Nota gratis, refund dan sengketa memerlukan kebijakan terpisah.</p><p><strong>{row.work_status==="PROCESSING"?"Diproses":row.work_status==="READY"?"Siap diambil":row.work_status==="COLLECTED"?"Sudah diambil":"Antrian"}</strong></p>
 <RecoverableForm action={advanceOwnerWork} className={target?styles.paymentForm:undefined}
 recoveryKey={commandRecoveryKey('owner',user.id,'SET_WORK',id)} recoverAction={recoverOwnerOperation.bind(null,'SET_WORK',id)}>
 {target&&<>
 <input type="hidden" name="requestId" value={randomUUID()}/><input type="hidden" name="orderId" value={id}/><input type="hidden" name="target" value={target}/>
 <PendingSubmit className={styles.mainButton} disabled={!canWrite||(target==="COLLECTED"&&finance?.payment_status!=="PAID")} label={target==="PROCESSING"?"Mulai proses":target==="READY"?"Ubah ke Siap Diambil":"Ubah ke Sudah Diambil"}/></>}</RecoverableForm>
 <RecoverableForm action={cancelOwnerOrder} className={finance&&cancellable?styles.paymentForm:undefined}
 recoveryKey={commandRecoveryKey('owner',user.id,'CANCEL',id)} recoverAction={recoverOwnerOperation.bind(null,'CANCEL',id)}>
 {finance&&cancellable&&<><h3>Batalkan pesanan</h3>
 <input type="hidden" name="requestId" value={randomUUID()}/><input type="hidden" name="orderId" value={id}/><input type="hidden" name="expectedVersion" value={String(finance.version)}/>
 <label>Alasan pembatalan<input name="reason" required minLength={3} maxLength={300}/></label>
 <PendingSubmit className={styles.dangerButton} disabled={!canWrite} label="Konfirmasi pembatalan"/></>}</RecoverableForm>
 {finance&&!cancellable&&<p className={styles.warning}>Ada dana diterima. Lakukan refund penuh sebelum membatalkan pesanan.</p>}
 </section><section className={styles.card}><OrderTimeline events={row.events??[]}/></section></div>{row.lifecycle_status==="CONFIRMED"&&<WhatsAppDraft key={id} role="owner" orderId={id} workStatus={row.work_status} version={finance?.version??0}/>}</>}
 <Link className="binatu-button binatu-button-soft" href="/admin">Kembali ke Pesanan</Link>
 </PosWorkspace>;
}
