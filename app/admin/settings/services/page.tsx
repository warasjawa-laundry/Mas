import Link from "next/link";
import PosWorkspace from "@/components/pos/pos-workspace";
import {randomUUID} from "node:crypto";
import {requireOwner} from "@/lib/supabase/owner";
import {formatPrice,type Service} from "@/lib/services/catalog";
import PackageCatalogEditor,{type PackageSettings} from "@/components/admin/package-catalog-editor";
import ServiceEditor from "@/components/admin/service-editor";
type Props={searchParams:Promise<{error?:string;saved?:string}>};
export default async function ServiceSettings({searchParams}:Props){
 const {supabase}=await requireOwner();
 const notice=await searchParams;
 const [packageResult,receiptResult]=await Promise.all([supabase.rpc("laundry_pos_catalog_settings"),supabase.rpc("laundry_pos_receipt_settings")]);
 const packageSettings:PackageSettings|null=!packageResult.error&&Array.isArray(packageResult.data?.packages)?packageResult.data:null;
 const capability=await supabase.rpc("laundry_pos_owner_capabilities");
 const durationSupport=!capability.error&&capability.data?.duration_support===true;
 const query=durationSupport?
  supabase.from("laundry_services").select("id,category,package_name,name,price_idr,unit,duration,position,is_visible,revision,duration_minutes"):
  supabase.from("laundry_services").select("id,category,package_name,name,price_idr,unit,duration,position,is_visible,revision");
 if(packageSettings)query.is("family_id",null);
 const {data,error}=await query.order("position").order("id").limit(200);
 const services=(data??[]) as Service[];
 const categories=[...new Set(services.map(s=>s.category))];
 const durations=[...new Set(services.map(s=>s.duration.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"id-ID"));
 const messages:Record<string,string>={invalid:"Periksa kategori, nama layanan, durasi, harga, satuan, dan urutan.",conflict:"Layanan ini sudah berubah sejak halaman dibuka. Muat ulang sebelum mengedit lagi.",limit:"Batas 200 layanan sudah tercapai.",save:"Perubahan belum tersimpan. Coba lagi."};
 return <PosWorkspace title="Layanan & Harga" category="PENGATURAN" description="Kelola kategori, paket, durasi dan tarif tiap layanan dalam satu tempat."><div className="admin-content service-settings binatu-service-content">
  {packageSettings&&<PackageCatalogEditor settings={packageSettings} receipt={!receiptResult.error?receiptResult.data:null}/>}
  {packageSettings&&<h2>Katalog lama — belum dipetakan ke paket</h2>}
  <p className="admin-hint">Setiap layanan memiliki durasi dan harga sendiri. Contoh: Cuci Setrika · Reguler (1–3 hari) dan Express (1–2 hari) dapat memiliki tarif berbeda. Tidak perlu menu Durasi terpisah.</p>
  <p className="member-note">Perubahan berlaku setelah disimpan. Harga pada riwayat transaksi member tetap sesuai nominal yang sudah dicatat.</p>
  {notice.saved==="1"&&<p className="admin-success" role="status">Layanan berhasil disimpan. Daftar harga di homepage diperbarui otomatis.</p>}
  {notice.error&&<p className="admin-error" role="alert">{messages[notice.error]??messages.save}</p>}
  {error?<p className="admin-error" role="alert">Daftar layanan belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.</p>:<>
   {!packageSettings&&<details className="service-settings-add" open={services.length===0}><summary>+ Tambah layanan</summary><ServiceEditor service={{}} newId={randomUUID()} categories={categories} durations={durations} durationSupport={durationSupport}/></details>}
   <p className="member-note">{services.length} layanan · {services.filter(s=>s.is_visible).length} ditampilkan</p>
   <ul className="service-settings-list">{services.map(s=><li key={s.id}><details><summary><span><strong>{s.name}</strong><small>{s.category}{s.package_name?" · "+s.package_name:""} · {s.is_visible?"Ditampilkan":"Disembunyikan"}</small></span><span className="mj-service-duration-col"><small>Durasi</small><strong>{s.duration||"Belum diatur"}</strong></span><span><small className="mj-price-heading">Harga / satuan</small>{formatPrice(s.price_idr,s.unit)}<small>Ubah</small></span></summary><ServiceEditor service={s} categories={categories} durations={durations} durationSupport={durationSupport}/></details></li>)}</ul>
  </>}
  <Link href="/" prefetch={false} className="admin-logout">Lihat homepage (keluar admin)</Link>
 </div></PosWorkspace>;
}

