import Link from "next/link";
import PosWorkspace from "@/components/pos/pos-workspace";
import {requireOwner} from "@/lib/supabase/owner";
import PackageCatalogEditor,{type PackageSettings} from "@/components/admin/package-catalog-editor";

type Props={searchParams:Promise<{error?:string;saved?:string}>};
export default async function ServiceSettings({searchParams}:Props){
 const {supabase}=await requireOwner();
 const [notice,packageResult,receiptResult]=await Promise.all([
  searchParams,supabase.rpc("laundry_pos_catalog_settings"),supabase.rpc("laundry_pos_receipt_settings")
 ]);
 const data=packageResult.data;
 const packageSettings:PackageSettings|null=!packageResult.error&&
  Array.isArray(data?.packages)&&Array.isArray(data?.families)&&Array.isArray(data?.legacy)&&typeof data?.enabled==="boolean"
  ?data:null;
 const messages:Record<string,string>={
  invalid:"Periksa nama layanan, paket, harga, satuan, dan durasi paket.",
  conflict:"Pengaturan berubah. Muat ulang sebelum mengedit kembali.",
  limit:"Batas layanan sudah tercapai.",
  save:"Perubahan belum tersimpan. Coba kembali."
 };
 return <PosWorkspace title="Layanan & Harga" category="PENGATURAN" description="Satu layanan dengan tarif Reguler, Ekspres, dan Kilat. Durasi diatur pada paket, bukan tiap layanan.">
  <div className="admin-content service-settings binatu-service-content">
   {notice.saved==="1"&&<p className="admin-success" role="status">Pengaturan berhasil disimpan. Data transaksi historis tidak diubah.</p>}
   {notice.error&&<p className="admin-error" role="alert">{messages[notice.error]??messages.save}</p>}
   {packageSettings?
    <>
     <p className="member-note">Kelola durasi sekali per paket, lalu atur ketersediaan dan harga setiap layanan pada Reguler, Ekspres, atau Kilat. Harga dan poin historis tetap mengikuti catatan asli.</p>
     <PackageCatalogEditor settings={packageSettings} receipt={!receiptResult.error?receiptResult.data:null}/>
    </>:
    <p className="admin-error" role="alert">Pengaturan paket belum dapat dimuat. Untuk mencegah perubahan pada katalog lama yang tidak sesuai, editor sementara tidak ditampilkan. Muat ulang halaman atau periksa akses Owner dan koneksi Supabase.</p>}
   <Link href="/" prefetch={false} className="admin-logout">Lihat homepage (keluar admin)</Link>
  </div>
 </PosWorkspace>;
}
