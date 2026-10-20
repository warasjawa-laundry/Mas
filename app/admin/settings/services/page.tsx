import Link from "next/link";
import {randomUUID} from "node:crypto";
import {requireOwner} from "@/lib/supabase/owner";
import {formatPrice,type Service} from "@/lib/services/catalog";
import ServiceEditor from "@/components/admin/service-editor";
type Props={searchParams:Promise<{error?:string;saved?:string}>};
export default async function ServiceSettings({searchParams}:Props){
 const {supabase}=await requireOwner();
 const notice=await searchParams;
 const {data,error}=await supabase.from("laundry_services").select("id,category,package_name,name,price_idr,unit,duration,position,is_visible,revision").order("position").order("id").limit(200);
 const services=(data??[]) as Service[];
 const categories=[...new Set(services.map(s=>s.category))];
 const messages:Record<string,string>={invalid:"Periksa kategori, nama layanan, harga, satuan, dan urutan.",conflict:"Layanan ini sudah berubah sejak halaman dibuka. Muat ulang sebelum mengedit lagi.",limit:"Batas 200 layanan sudah tercapai.",save:"Perubahan belum tersimpan. Coba lagi."};
 return <main className="admin-workspace"><nav className="admin-breadcrumb"><Link href="/admin/settings" prefetch={false}>← Pengaturan</Link></nav><section className="admin-content service-settings">
  <p className="admin-kicker">PENGATURAN</p><h1>Layanan dan harga</h1>
  <p className="admin-hint">Atur layanan yang ditampilkan di homepage. Kategori bisa digunakan untuk laundry, sepatu, karpet, atau usaha lainnya.</p>
  <p className="member-note">Perubahan berlaku setelah disimpan. Harga pada riwayat transaksi member tetap sesuai nominal yang sudah dicatat.</p>
  {notice.saved==="1"&&<p className="admin-success" role="status">Layanan berhasil disimpan. Daftar harga di homepage diperbarui otomatis.</p>}
  {notice.error&&<p className="admin-error" role="alert">{messages[notice.error]??messages.save}</p>}
  {error?<p className="admin-error" role="alert">Daftar layanan belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.</p>:<>
   <details className="service-settings-add" open={services.length===0}><summary>+ Tambah layanan</summary><ServiceEditor service={{}} newId={randomUUID()} categories={categories}/></details>
   <p className="member-note">{services.length} layanan · {services.filter(s=>s.is_visible).length} ditampilkan</p>
   <ul className="service-settings-list">{services.map(s=><li key={s.id}><details><summary><span><strong>{s.name}</strong><small>{s.category}{s.package_name?" · "+s.package_name:""} · {s.is_visible?"Ditampilkan":"Disembunyikan"}</small></span><span>{formatPrice(s.price_idr,s.unit)}<small>Ubah</small></span></summary><ServiceEditor service={s} categories={categories}/></details></li>)}</ul>
  </>}
  <Link href="/" prefetch={false} className="admin-logout">Lihat homepage (keluar admin)</Link>
 </section></main>;
}

