import Link from "next/link";
import {requireOwner} from "@/lib/supabase/owner";
import {formatIdr} from "@/lib/pos/g4-order";
import styles from "@/app/kasir/pesanan/orders.module.css";
export const dynamic="force-dynamic";
export default async function OwnerCashPage(){
 const {supabase}=await requireOwner();
 const {data,error}=await supabase.rpc("laundry_pos_owner_cash_overview");
 const c=!error&&data&&typeof data==="object"&&!Array.isArray(data)&&typeof data.open==="boolean"?data as {open:boolean;opening_idr:string;cash_in_idr:string;cash_out_idr:string;expected_cash_idr:string}:null;
 return <main className={styles.shell}>
  <div className="binatu-page-cap binatu-pattern" aria-hidden="true"/>
  <Link href="/admin/menu">← Menu Owner</Link>
  <header className={styles.header}><div><p className={styles.kicker}>MAS JAWA LAUNDRY · OWNER</p><h1>Mutasi Kas</h1></div></header>
  {!c?<p role="status" className={styles.warning}>Kas POS belum tersedia di database Production. Tidak ada saldo yang diasumsikan atau transaksi dicatat.</p>:
  <section className={styles.card}><h2>Kas utama · satu outlet</h2>
   <p>Status: <strong>{c.open?"Shift terbuka":"Shift tertutup"}</strong></p>
   <div className={styles.paymentTotals}>
    <div><small>Saldo awal</small><strong>{formatIdr(c.opening_idr)}</strong></div>
    <div><small>Kas masuk</small><strong>{formatIdr(c.cash_in_idr)}</strong></div>
    <div><small>Kas keluar</small><strong>{formatIdr(c.cash_out_idr)}</strong></div>
    <div><small>Saldo diharapkan</small><strong>{formatIdr(c.expected_cash_idr)}</strong></div>
   </div><p className={styles.warning}>Tindakan kas Owner belum diaktifkan hingga G8.</p></section>}
 </main>;
}
