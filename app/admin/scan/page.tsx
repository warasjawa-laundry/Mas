import Link from "next/link";
import {requireOwner} from "@/lib/supabase/owner";
import ScanCard from "@/components/admin/scan-card";
import PosIcon from "@/components/pos/pos-icon";
import {site} from "@/lib/site";
export default async function OwnerScan(){
 await requireOwner();
 return <main className="binatu-board binatu-scan-page">
  <div className="binatu-pattern binatu-page-cap" aria-hidden="true"/>
  <header className="binatu-outlet-head"><img src="/pos/storefront.svg" width="50" height="50" alt=""/><div><strong>MAS JAWA LAUNDRY</strong><p>{site.shortAddress}</p></div><span className="binatu-role-chip">Manajer<span aria-hidden="true"/></span></header>
  <section className="binatu-menu-page">
   <Link className="binatu-scan-back" href="/admin/menu" prefetch={false}><PosIcon name="back" size={20}/> Kembali ke Menu</Link>
   <header className="binatu-page-heading"><div><p>DATA PELANGGAN</p><h1>Scan Barcode / QR Member</h1></div></header>
   <p className="binatu-scan-help">Gunakan kamera HP atau pilih foto kode member dari galeri. Pemindaian hanya memilih member, tidak mencatat transaksi atau memberikan poin.</p>
   <div className="binatu-scan-panel"><ScanCard/></div>
  </section>
 </main>;
}
