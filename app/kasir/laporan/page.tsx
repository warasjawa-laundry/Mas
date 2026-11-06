import {hasCashierGrant} from "@/lib/pos/cashier-permissions";
import ContextNotice,{readDisplayContext} from "@/components/pos/context-notice";
import {paymentMethodLabel,cashCategoryLabel} from "@/lib/pos/ui-labels";
import Link from "next/link";
import Form from "next/form";
import ReportDownload from "@/components/pos/report-download";
import { redirect } from "next/navigation";
import { cashierRpcAccess } from "@/lib/pos/g4-server";
import { formatIdr } from "@/lib/pos/g4-order";
import { isReport, reportingPeriod } from "@/lib/pos/g6-cash";
import styles from "../pesanan/orders.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Laporan Kasir - Mas Jawa Laundry",robots:{index:false,follow:false}};
export default async function CashierReports({searchParams}:{searchParams:Promise<{start?:string;end?:string}>}){
 const access=await cashierRpcAccess("reports_view");if(!access)redirect("/kasir");
 const contextR=await access.client.rpc("laundry_pos_display_context",access.tokens);const context=contextR.error?null:readDisplayContext(contextR.data);
 const params=await searchParams;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const tomorrow=new Date(new Date(today+'T00:00:00+07:00').getTime()+86400_000);
 const endDefault=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(tomorrow);
 const start=params.start??today,end=params.end??endDefault,period=reportingPeriod(start,end);
 const {data,error}=period?await access.client.rpc('laundry_pos_g6_report',{...access.tokens,...period}):{data:null,error:true};
 const report=isReport(data)&&!error?data:null;
 return <main className={styles.shell}>
 <Link href="/kasir">← Kasir</Link><header className={styles.header}>
 <div><p className={styles.kicker}>MAS JAWA LAUNDRY</p><h1>Laporan</h1></div>
 {hasCashierGrant(access.session.permissions,"cash_view")&&<Link className={styles.mainLink} href="/kasir/kas">Mutasi Kas</Link>}</header>
 <ContextNotice context={context}/><Form action="/kasir/laporan" prefetch={false} className={styles.paymentForm}><p className={styles.muted}>Periode memakai WIB. Tanggal mulai dihitung; transaksi pada tanggal batas akhir belum dihitung.</p>
 <label>Tanggal mulai<input type="date" name="start" defaultValue={start} required/></label>
 <label>Tanggal batas akhir<input type="date" name="end" defaultValue={end} required/></label>
 <button className={styles.mainButton}>Tampilkan laporan</button></Form>
 {!report?<p role="status" className={styles.warning}>{!period?'Pilih tanggal batas akhir setelah tanggal mulai, maksimal 93 hari.':'Laporan belum dapat dimuat. Muat ulang untuk mencoba lagi.'}</p>:<>
 <section className={styles.card}><h2>Ringkasan operasional</h2><div className={styles.paymentTotals}>
 <div><small>Kas masuk tunai</small><strong>{formatIdr(report.cash_in_idr)}</strong></div>
 <div><small>Kas keluar tunai</small><strong>{formatIdr(report.cash_out_idr)}</strong></div>
 <div><small>Penerimaan non-tunai</small><strong>{formatIdr(report.noncash_in_idr)}</strong></div>
 </div><p>Non-tunai keluar: <strong>{formatIdr(report.noncash_out_idr)}</strong></p>
 <p>Nota dibuat: <strong>{report.orders_created}</strong> · Piutang pada akhir periode: <strong>{formatIdr(report.receivables_as_of_end_idr)}</strong></p>
 <p className={styles.muted}>Laporan ini merangkum arus kas operasional, bukan laba bersih.</p>
 {!report.truncated&&<ReportDownload className={styles.mainLink} format="csv" filename={`masjawa-mutasi-${start}-${end}.csv`} href={`/kasir/laporan/export?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`}>Unduh laporan CSV</ReportDownload>}
 <ReportDownload className={styles.mainLink} format="xlsx" filename={`masjawa-mutasi-${start}-${end}.xlsx`} href={`/kasir/laporan/export?format=xlsx&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`}>Unduh laporan Excel</ReportDownload>
 <p className={styles.muted}>Excel memuat nota, kuantitas layanan, dan mutasi. Saldo nota memakai kondisi terkini; penerimaan kas mengikuti periode yang dipilih.</p>
 {report.truncated&&<p className={styles.warning}>Hasil terlalu banyak untuk ekspor aman (lebih dari 300 mutasi). Persempit tanggal.</p>}
 </section><section className={styles.card}><h2>Mutasi dalam periode</h2>
 {report.rows.length===0?<p className={styles.muted}>Tidak ada mutasi.</p>:report.rows.map((x,i)=><div key={i} className={styles.receipt}>
 <div><strong>{x.invoice_no||cashCategoryLabel(x.category)}</strong><small>{paymentMethodLabel(x.method)} · {new Date(x.occurred_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB</small></div>
 <strong>{x.type==='OUT'?'−':'+'}{formatIdr(x.amount_idr)}</strong></div>)}</section></>}
 </main>;
}
