import ContextNotice,{readDisplayContext} from "@/components/pos/context-notice";
import {paymentMethodLabel,cashCategoryLabel} from "@/lib/pos/ui-labels";
import Link from "next/link";
import {requireOwner} from "@/lib/supabase/owner";
import PosWorkspace from "@/components/pos/pos-workspace";
import { formatIdr } from "@/lib/pos/g4-order";
import { isReport, reportingPeriod } from "@/lib/pos/g6-cash";
import styles from "@/app/kasir/pesanan/orders.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Laporan Owner - Mas Jawa Laundry",robots:{index:false,follow:false}};
export default async function OwnerReports({searchParams}:{searchParams:Promise<{start?:string;end?:string}>}){
 const {supabase}=await requireOwner();
 const contextR=await supabase.rpc("laundry_pos_display_context");const context=contextR.error?null:readDisplayContext(contextR.data);
 const params=await searchParams;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const tomorrow=new Date(new Date(today+'T00:00:00+07:00').getTime()+86400_000);
 const endDefault=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(tomorrow);
 const start=params.start??today,end=params.end??endDefault,period=reportingPeriod(start,end);
 const {data,error}=period?await supabase.rpc('laundry_pos_owner_report',period):{data:null,error:true};
 const report=isReport(data)&&!error?data:null;
 return <PosWorkspace title="Laporan" category="OPERASIONAL" description="Ringkasan transaksi yang sudah tercatat di database.">
 <ContextNotice context={context}/><nav className={styles.header} aria-label="Navigasi operasional">
 <Link className={styles.mainLink} href="/admin/kas">Mutasi Kas</Link></nav>
 <form method="GET" className={styles.paymentForm}><p className={styles.muted}>Periode memakai WIB. Tanggal mulai dihitung; transaksi pada tanggal batas akhir belum dihitung.</p>
 <label>Tanggal mulai<input type="date" name="start" defaultValue={start} required/></label>
 <label>Tanggal batas akhir<input type="date" name="end" defaultValue={end} required/></label>
 <button className={styles.mainButton}>Tampilkan laporan</button></form>
 {!report?<p role="status" className={styles.warning}>{!period?'Pilih tanggal batas akhir setelah tanggal mulai, maksimal 93 hari.':'Laporan belum dapat dimuat. Muat ulang untuk mencoba lagi.'}</p>:<>
 <section className={styles.card}><h2>Ringkasan operasional</h2><div className={styles.paymentTotals}>
 <div><small>Kas masuk tunai</small><strong>{formatIdr(report.cash_in_idr)}</strong></div>
 <div><small>Kas keluar tunai</small><strong>{formatIdr(report.cash_out_idr)}</strong></div>
 <div><small>Penerimaan non-tunai</small><strong>{formatIdr(report.noncash_in_idr)}</strong></div>
 </div><p>Non-tunai keluar: <strong>{formatIdr(report.noncash_out_idr)}</strong></p>
 <p>Nota dibuat: <strong>{report.orders_created}</strong> · Piutang pada akhir periode: <strong>{formatIdr(report.receivables_as_of_end_idr)}</strong></p>
 <p className={styles.muted}>Laporan ini merangkum arus kas operasional, bukan laba bersih.</p>
 {!report.truncated&&<a className={styles.mainLink} href={`/admin/laporan/export?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`}>Unduh laporan CSV</a>}
 {report.truncated&&<p className={styles.warning}>Hasil terlalu banyak untuk ekspor aman (lebih dari 300 mutasi). Persempit tanggal.</p>}
 </section><section className={styles.card}><h2>Mutasi dalam periode</h2>
 {report.rows.length===0?<p className={styles.muted}>Tidak ada mutasi.</p>:report.rows.map((x,i)=><div key={i} className={styles.receipt}>
 <div><strong>{x.invoice_no||cashCategoryLabel(x.category)}</strong><small>{paymentMethodLabel(x.method)} · {new Date(x.occurred_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB</small></div>
 <strong>{x.type==='OUT'?'−':'+'}{formatIdr(x.amount_idr)}</strong></div>)}</section></>}
 </PosWorkspace>;
}
