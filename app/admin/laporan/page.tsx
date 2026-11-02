import Link from "next/link";
import {requireOwner} from "@/lib/supabase/owner";
import {formatIdr} from "@/lib/pos/g4-order";
import styles from "@/app/kasir/pesanan/orders.module.css";
export const dynamic="force-dynamic";
export default async function OwnerReportsPage({searchParams}:{searchParams:Promise<{start?:string;end?:string}>}){
 const {supabase}=await requireOwner();
 const {start,end}=await searchParams;
 const now=new Date();
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
 const prior=new Date(now.getTime()-29*86400_000);
 const fromDefault=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(prior);
 const from=/^\d{4}-\d{2}-\d{2}$/.test(start??"")?start!:fromDefault;
 const to=/^\d{4}-\d{2}-\d{2}$/.test(end??"")?end!:today;
 const valid=Date.parse(from)<=Date.parse(to)&&Date.parse(to)-Date.parse(from)<=93*86400_000;
 const {data,error}=valid?await supabase.rpc("laundry_pos_owner_report_summary",{p_from:from,p_until:to}):{data:null,error:true};
 const r=!error&&data&&typeof data==="object"&&!Array.isArray(data)&&typeof data.orders==="number"?data as {orders:number;cash_in_idr:string;cash_out_idr:string;noncash_in_idr:string}:null;
 return <main className={styles.shell}>
  <div className="binatu-page-cap binatu-pattern" aria-hidden="true"/>
  <Link href="/admin/menu">← Menu Owner</Link>
  <header className={styles.header}><div><p className={styles.kicker}>MAS JAWA LAUNDRY · OWNER</p><h1>Laporan</h1></div></header>
  <form method="GET" className={styles.paymentForm}><label>Tanggal mulai<input type="date" name="start" defaultValue={from} required/></label>
   <label>Tanggal akhir (termasuk)<input type="date" name="end" defaultValue={to} required/></label>
   <button className={styles.mainButton}>Tampilkan laporan</button></form>
  {!r?<p role="status" className={styles.warning}>Laporan POS belum tersedia pada database aktif atau rentang tanggal tidak valid (maksimum 93 hari).</p>:
  <section className={styles.card}><h2>Ringkasan periode</h2><div className={styles.paymentTotals}>
   <div><small>Nota dibuat</small><strong>{r.orders}</strong></div>
   <div><small>Kas masuk tunai</small><strong>{formatIdr(r.cash_in_idr)}</strong></div>
   <div><small>Kas keluar tunai</small><strong>{formatIdr(r.cash_out_idr)}</strong></div>
   <div><small>Penerimaan non-tunai</small><strong>{formatIdr(r.noncash_in_idr)}</strong></div>
   </div><p>Laporan operasional, bukan laba bersih. Semua data dari database, tanpa angka contoh.</p></section>}
 </main>;
}
