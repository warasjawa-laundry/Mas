import {randomUUID} from "node:crypto";
import {requireOwner} from "@/lib/supabase/owner";
import PosWorkspace from "@/components/pos/pos-workspace";
import {OrderForm,type CatalogService} from "@/app/kasir/pesanan/baru/order-form";
import {ownerPosWriteLocked} from "../actions";
export const dynamic="force-dynamic";
export const metadata={title:"Tambah Pesanan Manajer | Mas Jawa Laundry",robots:{index:false,follow:false}};
export default async function OwnerNewOrder({searchParams}:{searchParams:Promise<{error?:string}>}){
 const {supabase}=await requireOwner();
 const [{data,error},params]=await Promise.all([
  supabase.from("laundry_services")
   .select("id,category,package_name,name,price_idr,unit,duration,revision")
   .eq("is_visible",true).order("position").limit(200),
  searchParams
 ]);
 return <PosWorkspace title="Tambah Pesanan" category="POS MANAJER"
  backHref="/admin" description="Pilih pelanggan, pindai barcode/QR, tentukan durasi, dan susun layanan pada formulir POS yang sama dengan Kasir.">
   <p className="binatu-inline-notice" role="status">Mode pratinjau: pembuatan nota dan pembayaran belum aktif (G8 NO-GO). Scan dan pencarian member hanya membaca data; tidak memberikan poin.</p>
   {params.error&&<p className="binatu-inline-notice" role="alert">Penyimpanan nota masih dikunci untuk melindungi data produksi.</p>}
   {error?<p className="binatu-inline-notice" role="alert">Katalog tidak dapat dimuat. Periksa koneksi dan coba kembali.</p>:
    <OrderForm services={(data??[]) as CatalogService[]} requestId={randomUUID()} canWrite={false}
     canLookup role="owner" createAction={ownerPosWriteLocked}/>}
  </PosWorkspace>;
}
