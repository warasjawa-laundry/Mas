import {randomUUID} from "node:crypto";
import {requireOwner} from "@/lib/supabase/owner";
import PosWorkspace from "@/components/pos/pos-workspace";
import {OrderForm,type CatalogService} from "@/app/kasir/pesanan/baru/order-form";
import {createOwnerOrder} from "../actions";
import {commandRecoveryKey} from "@/lib/pos/command-recovery";
import {recoverOwnerOrder} from "../recovery-actions";
export const dynamic="force-dynamic";
export const metadata={title:"Tambah Pesanan Manajer | Mas Jawa Laundry",robots:{index:false,follow:false}};
export default async function OwnerNewOrder({searchParams}:{searchParams:Promise<{error?:string}>}){
 const {supabase,user}=await requireOwner();
 const [{data,error},params,capabilities]=await Promise.all([
  supabase.from("laundry_services")
   .select("id,category,package_name,name,price_idr,unit,duration,revision")
   .eq("is_visible",true).order("position").limit(200),
  searchParams,supabase.rpc("laundry_pos_owner_capabilities")
 ]);
 const canWrite=!capabilities.error&&capabilities.data?.write_enabled===true;
 return <PosWorkspace title="Tambah Pesanan" category="POS MANAJER"
  backHref="/admin" description="Pilih pelanggan, pindai barcode/QR, tentukan durasi, dan susun layanan pada formulir POS yang sama dengan Kasir.">
   {!canWrite&&<p className="binatu-inline-notice" role="status">Mode pratinjau: pembuatan nota belum aktif. Scan dan pencarian member hanya membaca data; tidak memberikan poin.</p>}
   {params.error&&<p className="binatu-inline-notice" role="alert">Penyimpanan nota masih dikunci untuk melindungi data produksi.</p>}
   {error?<p className="binatu-inline-notice" role="alert">Katalog tidak dapat dimuat. Periksa koneksi dan coba kembali.</p>:
    <OrderForm services={(data??[]) as CatalogService[]} requestId={randomUUID()} canWrite={canWrite}
     canLookup role="owner" createAction={createOwnerOrder}
     recoveryKey={commandRecoveryKey('owner',user.id,'CREATE_ORDER')} recoverAction={recoverOwnerOrder}/>}
  </PosWorkspace>;
}
