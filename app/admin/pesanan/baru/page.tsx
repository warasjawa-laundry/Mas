import Link from "next/link";
import {randomUUID} from "node:crypto";
import {requireOwner} from "@/lib/supabase/owner";
import {OrderForm,type CatalogService} from "@/app/kasir/pesanan/baru/order-form";
import {createOwnerOrder} from "./actions";
import {site} from "@/lib/site";
import styles from "@/app/kasir/pesanan/baru/wizard.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Tambah Pesanan Owner - Mas Jawa Laundry",robots:{index:false,follow:false}};
export default async function OwnerCreateOrder({searchParams}:{searchParams:Promise<{error?:string}>}){
 const {supabase}=await requireOwner();
 const [{data,error},query]=await Promise.all([
  supabase.from("laundry_services")
   .select("id,category,package_name,name,price_idr,unit,duration,revision")
   .eq("is_visible",true).order("position").order("id").limit(200),
  searchParams
 ]);
 return <main className={styles.shell}>
  <div className={`${styles.pagePattern} binatu-pattern`} aria-hidden="true"/>
  <Link href="/admin">← Pesanan Owner</Link>
  <p className={styles.brand}>MAS JAWA LAUNDRY · {site.shortAddress} · OWNER</p>
  <h1>Tambah Pesanan</h1>
  <p className={styles.warn} role="status">Mode pratinjau Owner. Pengisian pelanggan, scanner dan katalog dapat digunakan, tetapi nota belum dapat disimpan sampai migrasi POS dan otorisasi pencatatan Owner lolos G8.</p>
  {query.error&&<p className={styles.warn} role="alert">Transaksi Owner belum diaktifkan. Tidak ada nota, pembayaran atau poin yang dicatat.</p>}
  {error?<p className={styles.warn} role="alert">Katalog layanan belum dapat dimuat. Muat ulang dan periksa koneksi.</p>:
   <OrderForm role="owner" services={(data??[]) as CatalogService[]} requestId={randomUUID()}
    canWrite={false} canLookup={true} createAction={createOwnerOrder}/>}
 </main>;
}
