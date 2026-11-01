import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound,redirect } from "next/navigation";
import { cashierRpcAccess } from "@/lib/pos/g4-server";
import { formatIdr } from "@/lib/pos/g4-order";
import { hasCashierGrant } from "@/lib/pos/cashier-permissions";
import { advanceWorkStatus } from "../actions";
import { PrintButton } from "./print-button";
import styles from "../orders.module.css";

export const dynamic="force-dynamic";
type Order={id:string;invoice_no:string;customer_name:string;total_idr:string;work_status:string;lifecycle_status:string;created_at:string;perfume:string|null;notes:string|null;created_staff_id:string;items:{service_name:string;unit:string;quantity_milli:number;price_idr:number;line_total_idr:number}[]};
export default async function OrderDetails({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;saved?:string}>}){
 const [{id},query]=await Promise.all([params,searchParams]);
 if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const access=await cashierRpcAccess("order_view");
 if(!access)redirect("/kasir");
 const {data,error}=await access.client.rpc("laundry_pos_g4_order_detail",{...access.tokens,p_order_id:id});
 if(error||!data||typeof data!=="object"||!data.id)return <main className={styles.shell}><Link href="/kasir/pesanan">← Daftar pesanan</Link><p role="alert" className={styles.warning}>Nota tidak ditemukan atau modul belum tersedia.</p></main>;
 const o=data as Order;
 const target=o.work_status==='QUEUED'?'READY':o.work_status==='READY'?'COLLECTED':null;
 return <main className={styles.shell}>
  <Link href="/kasir/pesanan">← Daftar pesanan</Link>
  <p className={styles.kicker}>MAS JAWA LAUNDRY · {access.session.username}</p>
  <h1>{o.invoice_no}</h1><p><strong>{o.customer_name}</strong> · {new Date(o.created_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB</p>
  {query.error&&<p className={styles.warning} role="alert">Perubahan belum terkonfirmasi ({query.error}). Periksa status nota sebelum mengulangi tindakan.</p>}
  {query.saved&&<p className={styles.ok} role="status">Status cucian tersimpan.</p>}
  <PrintButton/>
  <section className={styles.card}><h2>Rincian layanan</h2>
   {o.items.map((i,j)=><div key={j} className={styles.item}><div>{i.service_name}<small>{(Number(i.quantity_milli)/1000).toLocaleString('id-ID')} {i.unit} × {formatIdr(i.price_idr)}</small></div><strong>{formatIdr(i.line_total_idr)}</strong></div>)}
   <div className={styles.item}><strong>Total tagihan</strong><strong>{formatIdr(o.total_idr)}</strong></div>
   {o.perfume&&<p>Parfum: {o.perfume}</p>}{o.notes&&<p>Catatan: {o.notes}</p>}
  </section>
  <section className={styles.card}><h2>Status</h2>
   <p>Proses: <strong>{o.work_status==='READY'?'Siap diambil':o.work_status==='COLLECTED'?'Sudah diambil':'Antrian'}</strong></p>
   <p>Pembayaran: <strong>Belum ada pembayaran POS</strong></p>
   <p className={styles.muted}>Status kerja tidak mengubah nominal atau poin member.</p>
   {target&&hasCashierGrant(access.session.permissions,'order_work')&&<form action={advanceWorkStatus}>
    <input name="orderId" type="hidden" value={o.id}/><input name="requestId" type="hidden" value={randomUUID()}/>
    <input name="target" type="hidden" value={target}/>
    <button className={styles.mainButton} type="submit" disabled={!access.session.write_enabled}>Ubah ke {target==='READY'?'Siap Diambil':'Sudah Diambil'}</button>
   </form>}
  </section>
  <p className={styles.warning}>Fungsi pembayaran, refund, dan pemberian poin otomatis tetap nonaktif hingga tahap G5 disetujui.</p>
 </main>;
}