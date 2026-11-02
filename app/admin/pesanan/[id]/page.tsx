import Link from "next/link";
import {notFound} from "next/navigation";
import {requireOwner} from "@/lib/supabase/owner";
import {formatIdr} from "@/lib/pos/g4-order";
import styles from "@/app/kasir/pesanan/orders.module.css";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Item={name:string;quantity_milli:number;unit:string;price_idr:number;total_idr:number};
type OrderDetail={invoice_no:string;customer_name:string;work_status:string;payment_status:string;total_idr:string;paid_idr:string;remaining_idr:string;created_at:string;perfume:string|null;notes:string|null;items:Item[]};
export const dynamic="force-dynamic";
export default async function OwnerOrderDetail({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!UUID.test(id))notFound();
 const {supabase}=await requireOwner();
 const {data,error}=await supabase.rpc("laundry_pos_owner_order_detail",{p_order_id:id});
 const d=!error&&data&&typeof data==="object"&&!Array.isArray(data)&&typeof data.invoice_no==="string"?data as OrderDetail:null;
 return <main className={styles.shell}>
  <div className="binatu-page-cap binatu-pattern" aria-hidden="true"/>
  <Link href="/admin">← Kembali ke Pesanan Owner</Link>
  <header className={styles.header}><div><p className={styles.kicker}>MAS JAWA LAUNDRY · OWNER</p>
   <h1>{d?d.invoice_no:"Rincian Pesanan"}</h1></div></header>
  {!d?<p role="status" className={styles.warning}>Rincian nota belum tersedia di database aktif atau tidak ditemukan. Tidak ada perubahan data.</p>:<>
  <div className={styles.detailGrid}>
   <section className={styles.card}><h2>Rincian pesanan</h2><p><strong>{d.customer_name}</strong> · {new Date(d.created_at).toLocaleString("id-ID",{timeZone:"Asia/Jakarta"})} WIB</p>
    {Array.isArray(d.items)&&d.items.map((item,i)=><div className={styles.item} key={i}><span>{item.name}<small>{(Number(item.quantity_milli)/1000).toLocaleString("id-ID")} {item.unit} × {formatIdr(item.price_idr)}</small></span><strong>{formatIdr(item.total_idr)}</strong></div>)}
    {d.perfume&&<p>Parfum: {d.perfume}</p>}{d.notes&&<p>Catatan: {d.notes}</p>}
    <div className={styles.item}><strong>Total nota</strong><strong>{formatIdr(d.total_idr)}</strong></div></section>
   <section className={styles.card}><h2>Status pesanan</h2><p>Status cucian: <strong>{d.work_status==="READY"?"Siap ambil":d.work_status==="COLLECTED"?"Sudah diambil":"Antrian"}</strong></p>
    <p>Pembayaran: <strong>{d.payment_status==="PAID"?"Lunas":d.payment_status==="PARTIAL"?"DP":d.payment_status==="REFUNDED"?"Refund":"Belum bayar"}</strong></p>
    <p>Sudah diterima: <strong>{formatIdr(d.paid_idr)}</strong></p><p>Sisa: <strong>{formatIdr(d.remaining_idr)}</strong></p>
    <p className={styles.warning}>Halaman Owner hanya baca. Aksi pembayaran, refund dan status cucian belum diaktifkan sampai G8.</p>
   </section>
  </div></>}
 </main>;
}
