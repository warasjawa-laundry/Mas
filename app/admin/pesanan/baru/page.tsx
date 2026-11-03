import {randomUUID} from "node:crypto";
import {requireOwner} from "@/lib/supabase/owner";
import PosWorkspace from "@/components/pos/pos-workspace";
import {OrderForm,type CatalogService,type DeliveryOption} from "@/app/kasir/pesanan/baru/order-form";
import {createOwnerOrder} from "../actions";
import {commandRecoveryKey} from "@/lib/pos/command-recovery";
import {recoverOwnerOrder} from "../recovery-actions";
export const dynamic="force-dynamic";
export const metadata={title:"Tambah Pesanan Manajer | Mas Jawa Laundry",robots:{index:false,follow:false}};
export default async function OwnerNewOrder({searchParams}:{searchParams:Promise<{error?:string}>}){
 const {supabase,user}=await requireOwner();
 const [{data,error},params,capabilities]=await Promise.all([
  supabase.rpc("laundry_pos_package_catalog"),
  searchParams,supabase.rpc("laundry_pos_owner_capabilities")
 ]);
 const deliveryOptions=(Array.isArray(data?.delivery_options)?data.delivery_options:[]) as DeliveryOption[];
 const canWrite=!capabilities.error&&capabilities.data?.write_enabled===true&&data?.enabled===true&&deliveryOptions.length>0;
 const lockReason=data?.enabled!==true
  ?"Katalog paket belum diaktifkan. Buka Pengaturan → Layanan & Harga, periksa tarif, lalu pilih Gunakan katalog paket untuk nota baru."
  :deliveryOptions.length===0?"Tarif antar-jemput belum tersedia dari Supabase. Pembuatan nota ditahan untuk mencegah salah hitung."
  :"Pembuatan nota belum diizinkan oleh konfigurasi POS. Periksa kesiapan dan otorisasi Owner.";
 return <PosWorkspace title="Tambah Pesanan" category="POS MANAJER"
  backHref="/admin" description="Pilih pelanggan, pindai barcode/QR, tentukan durasi, dan susun layanan pada formulir POS yang sama dengan Kasir.">
   {!canWrite&&<div className="binatu-inline-notice" role="status"><p>{lockReason}</p>{data?.enabled!==true&&<a href="/admin/settings/services">Buka Layanan & Harga untuk aktivasi katalog</a>}<p>Scan dan pencarian member hanya membaca data; tidak memberikan poin.</p></div>}
   {params.error&&<p className="binatu-inline-notice" role="alert">Penyimpanan nota masih dikunci untuk melindungi data produksi.</p>}
   {error?<p className="binatu-inline-notice" role="alert">Katalog tidak dapat dimuat. Periksa koneksi dan coba kembali.</p>:
    <OrderForm packageWorkflow serverTime={new Date().toISOString()} services={(data?.services??[]) as CatalogService[]} deliveryOptions={deliveryOptions} lockReason={lockReason} requestId={randomUUID()} canWrite={canWrite}
     canLookup role="owner" createAction={createOwnerOrder}
     recoveryKey={commandRecoveryKey('owner',user.id,'CREATE_ORDER')} recoverAction={recoverOwnerOrder}/>}
  </PosWorkspace>;
}
