import Link from "next/link";
import {notFound} from "next/navigation";
import {requireOwner} from "@/lib/supabase/owner";
import PosWorkspace from "@/components/pos/pos-workspace";
import {formatIdr} from "@/lib/pos/g4-order";
export const dynamic="force-dynamic";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Item={service_name:string;unit:string;quantity_milli:number;price_idr:string|number;line_total_idr:string|number};
type Row={id:string;invoice_no:string;customer_name:string;created_at:string;total_idr:string|number;work_status:string;payment_status:string;items:Item[]};
export default async function OwnerInvoice({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!uuid.test(id))notFound();
 const {supabase}=await requireOwner();
 const {data,error}=await supabase.rpc("laundry_pos_owner_order_detail",{p_order_id:id});
 const row=!error&&data&&typeof data==="object"&&typeof data.id==="string"?data as Row:null;
 return <PosWorkspace title={row?row.invoice_no:"Rincian Pesanan"} category="POS MANAJER" backHref="/admin" description="Rincian nota melalui sesi Owner, bukan sesi Kasir.">
  {!row?<p role="status" className="binatu-inline-notice">Rincian nota belum tersedia pada database aktif. Tidak ada data atau pembayaran yang diubah.</p>:
   <section className="binatu-owner-invoice" aria-label="Rincian nota Owner">
    <div><small>Pelanggan</small><strong>{row.customer_name}</strong></div>
    <div><small>Tanggal dibuat</small><strong>{new Date(row.created_at).toLocaleString("id-ID",{timeZone:"Asia/Jakarta"})} WIB</strong></div>
    <div><small>Status cucian</small><strong>{row.work_status==="READY"?"Siap Ambil":row.work_status==="COLLECTED"?"Diambil":"Antrian"}</strong></div>
    <div><small>Status pembayaran</small><strong>{row.payment_status==="PAID"?"Lunas":row.payment_status==="PARTIAL"?"DP":row.payment_status==="REFUNDED"?"Refund":row.payment_status==="ZERO_TOTAL"?"Gratis":"Belum Bayar"}</strong></div>
    {Array.isArray(row.items)&&row.items.length>0&&<section aria-label="Layanan nota">
      <h2>Layanan</h2><ul>{row.items.map((item,i)=><li key={i}>
       <span>{item.service_name} · {(item.quantity_milli/1000).toLocaleString("id-ID")} {item.unit}</span>
       <strong>{formatIdr(item.line_total_idr)}</strong></li>)}</ul></section>}
    <div><small>Total nota</small><strong>{formatIdr(row.total_idr)}</strong></div>
    <p className="binatu-inline-notice">Pembayaran dan perubahan status Owner masih dikunci sampai otorisasi dan G8 lulus.</p>
   </section>}
  <Link className="binatu-button binatu-button-soft" href="/admin">Kembali ke Pesanan</Link>
 </PosWorkspace>;
}
