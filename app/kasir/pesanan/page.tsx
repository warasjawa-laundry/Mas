import Link from "next/link";
import { redirect } from "next/navigation";
import { cashierRpcAccess } from "@/lib/pos/g4-server";
import { formatIdr } from "@/lib/pos/g4-order";
import styles from "./orders.module.css";

export const dynamic="force-dynamic";
export const metadata={title:"Pesanan Kasir - Mas Jawa Laundry",robots:{index:false,follow:false}};
type Row={id:string;invoice_no:string;customer_name:string;total_idr:number|string;work_status:string;created_at:string};

export default async function CashierOrders({searchParams}:{searchParams:Promise<{error?:string}>}){
 const params=await searchParams;
 const access=await cashierRpcAccess("order_view");
 if(!access)redirect("/kasir");
 const {data,error}=await access.client.rpc("laundry_pos_g4_order_list",access.tokens);
 const rows=Array.isArray(data)?data as Row[]:[];
 return <main className={styles.shell}>
  <Link href="/kasir">← Kasir</Link>
  <header className={styles.header}><div><p className={styles.kicker}>MAS JAWA LAUNDRY · {access.session.username}</p><h1>Daftar Pesanan</h1></div>
  <Link className={styles.mainLink} href="/kasir/pesanan/baru">+ Tambah Pesanan</Link></header>
  <div className={styles.tabs}><span>Antrian</span><span>Siap Ambil</span><span>Belum Bayar</span><Link href="/kasir/kas">Mutasi Kas</Link><Link href="/kasir/laporan">Laporan</Link></div>
  {params.error==='unconfirmed'&&<p className={styles.warning} role="alert">Hasil permintaan sebelumnya belum diketahui. Periksa daftar nota sebelum membuat pesanan baru untuk mencegah duplikasi.</p>}
  {!access.session.write_enabled&&<p className={styles.warning} role="status">Transaksi masih dikunci sampai rilis POS disetujui. Daftar hanya untuk pengujian setelah migrasi.</p>}
  {error?<p role="alert" className={styles.warning}>Modul pesanan belum tersedia pada database aktif.</p>:
  !rows.length?<p className={styles.empty}>Belum ada pesanan. Pilih Tambah Pesanan setelah akses diaktifkan.</p>:
  <div className={styles.rows}>{rows.map(o=><Link className={styles.order} key={o.id} href={`/kasir/pesanan/${o.id}`}>
   <div><strong>{o.invoice_no}</strong><p>{o.customer_name}</p></div>
   <div className={styles.alignRight}><strong>{formatIdr(o.total_idr)}</strong><small>{o.work_status==='READY'?'Siap diambil':o.work_status==='COLLECTED'?'Sudah diambil':'Antrian'}</small></div>
  </Link>)}</div>}
 </main>;
}