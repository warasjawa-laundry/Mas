import ContextNotice,{readDisplayContext} from "@/components/pos/context-notice";
import {paymentMethodLabel,cashCategoryLabel} from "@/lib/pos/ui-labels";
import Link from "next/link";
import Form from "next/form";
import ReportDownload from "@/components/pos/report-download";
import ReportPeriodFields from "@/components/pos/report-period-fields";
import {readReportSelection,type ReportSearchParams} from "@/lib/pos/report-selection";
import {requireOwner} from "@/lib/supabase/owner";
import PosWorkspace from "@/components/pos/pos-workspace";
import { formatIdr } from "@/lib/pos/g4-order";
import { isReport } from "@/lib/pos/g6-cash";
import styles from "@/app/kasir/pesanan/orders.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Laporan Owner - Mas Jawa Laundry",robots:{index:false,follow:false}};
export default async function OwnerReports({searchParams}:{searchParams:Promise<ReportSearchParams>}){
 const {supabase}=await requireOwner();
 const contextR=await supabase.rpc("laundry_pos_display_context");const context=contextR.error?null:readDisplayContext(contextR.data);
 const params=await searchParams;
 const selection=readReportSelection(params);
 const {startDate:start,endDate:end,granularity,bounds}=selection;
 const period=bounds?{p_start:bounds.start,p_end:bounds.end}:null;
 const endExclusive=bounds?new Date(new Date(bounds.end).getTime()+7*3600_000).toISOString().slice(0,10):'';
 const excelQuery=new URLSearchParams({format:'xlsx',period:'custom',start,end,granularity}).toString();
 const {data,error}=period?await supabase.rpc('laundry_pos_owner_report',period):{data:null,error:true};
 const report=isReport(data)&&!error?data:null;
 return <PosWorkspace title="Laporan" category="OPERASIONAL" description="Ringkasan transaksi yang sudah tercatat di database.">
 <ContextNotice context={context}/><nav className={styles.header} aria-label="Navigasi operasional">
 <Link className={styles.mainLink} href="/admin/kas">Mutasi Kas</Link></nav>
 <Form action="/admin/laporan" prefetch={false} className={styles.paymentForm}><ReportPeriodFields key={`${selection.preset}-${start}-${end}-${granularity}`} preset={selection.preset} startDate={start} endDate={end} granularity={granularity}/>
 <button className={styles.mainButton}>Tampilkan laporan</button></Form>
 {!report?<p role="status" className={styles.warning}>{!period?'Pilih rentang tanggal yang valid, maksimal 93 hari (tanggal akhir termasuk).':'Laporan belum dapat dimuat. Muat ulang untuk mencoba lagi.'}</p>:<>
 <section className={styles.card}><h2>Ringkasan operasional</h2><div className={styles.paymentTotals}>
 <div><small>Kas masuk tunai</small><strong>{formatIdr(report.cash_in_idr)}</strong></div>
 <div><small>Kas keluar tunai</small><strong>{formatIdr(report.cash_out_idr)}</strong></div>
 <div><small>Penerimaan non-tunai</small><strong>{formatIdr(report.noncash_in_idr)}</strong></div>
 </div><p>Non-tunai keluar: <strong>{formatIdr(report.noncash_out_idr)}</strong></p>
 <p>Nota dibuat: <strong>{report.orders_created}</strong></p>
 <p className={styles.muted}>Laporan ini merangkum arus kas tercatat. Modal dan perpindahan laci dapat termasuk kas masuk/keluar. Angka ini bukan laba bersih.</p>
 {!report.truncated&&<ReportDownload className={styles.mainLink} format="csv" filename={`masjawa-mutasi-${start}-${end}.csv`} href={`/admin/laporan/export?start=${encodeURIComponent(start)}&end=${encodeURIComponent(endExclusive)}`}>Unduh laporan CSV</ReportDownload>}
 <ReportDownload className={styles.mainLink} format="xlsx" filename={`masjawa-mutasi-${start}-${end}.xlsx`} href={`/admin/laporan/export?${excelQuery}`}>Unduh laporan Excel</ReportDownload>
 <p className={styles.muted}>Setiap unduhan Excel membaca data terbaru dan menghasilkan snapshot tetap dengan enam sheet. File tersimpan tidak memperbarui diri. Saldo nota memakai kondisi terkini; piutang akhir periode historis belum tersedia. Status Mode Uji dan verifikasi kas tercantum dalam file.</p>
 {report.truncated&&<p className={styles.warning}>Hasil terlalu banyak untuk ekspor aman (lebih dari 300 mutasi). Persempit tanggal.</p>}
 </section><section className={styles.card}><h2>Mutasi dalam periode</h2>
 {report.rows.length===0?<p className={styles.muted}>Tidak ada mutasi.</p>:report.rows.map((x,i)=><div key={i} className={styles.receipt}>
 <div><strong>{x.invoice_no||cashCategoryLabel(x.category)}</strong><small>{paymentMethodLabel(x.method)} · {new Date(x.occurred_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB</small></div>
 <strong>{x.type==='OUT'?'−':'+'}{formatIdr(x.amount_idr)}</strong></div>)}</section></>}
 </PosWorkspace>;
}
