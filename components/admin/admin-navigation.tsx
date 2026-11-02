
"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {logoutOwner} from "@/app/admin/actions";
import {leaveCashier} from "@/app/kasir/actions";
const ownerLinks=[
 {href:"/admin",label:"Pesanan",icon:"▤"},
 {href:"/admin/scan",label:"Scan QR / Barcode",icon:"▦"},
 {href:"/admin/members",label:"Pelanggan",icon:"♙"},
 {href:"/admin/pos/import",label:"Impor Binatu",icon:"↧"},
 {href:"/admin/pos/kasir",label:"Kelola Kasir",icon:"♧"},
 {href:"/admin/settings",label:"Pengaturan",icon:"⚙"}
];
const cashierLinks=[
 {href:"/kasir",label:"Pesanan",icon:"▤"},
 {href:"/kasir/pesanan/baru",label:"Tambah Nota",icon:"+"},
 {href:"/kasir/pesanan",label:"Daftar Nota",icon:"☷"},
 {href:"/kasir/kas",label:"Mutasi Kas",icon:"⇄"},
 {href:"/kasir/laporan",label:"Laporan",icon:"▥"}
];
function current(path:string,href:string){return href==="/admin"||href==="/kasir"?path===href:path===href||path.startsWith(href+"/");}
function NavLinks({role,mobile=false}:{role:"owner"|"cashier";mobile?:boolean}){
 const path=usePathname()||"";
 const items=role==="owner"?ownerLinks:cashierLinks;
 const show=mobile?(role==="owner"?[ownerLinks[0],ownerLinks[1],ownerLinks[2],ownerLinks[5]]:[cashierLinks[0],cashierLinks[1],cashierLinks[3],cashierLinks[4]]):items;
 return <>{show.map(x=><Link href={x.href} key={x.href} prefetch={false} aria-current={current(path,x.href)?"page":undefined}>
  <span className="mj-nav-icon" aria-hidden="true">{x.icon}</span><span>{x.label}</span>
 </Link>)}</>;
}
export default function AdminNavigation(){
 const path=usePathname();
 if(!path||path==="/admin/login")return null;
 return <>
  <a className="admin-skip-link" href="#admin-main">Lewati navigasi</a>
  <aside className="admin-shell-sidebar mj-sidebar" aria-label="Menu owner">
   <Link className="admin-shell-brand mj-sidebar-brand" href="/admin" prefetch={false}><span className="admin-shell-monogram">MJ</span><span>Mas Jawa Laundry<small>Owner · POS</small></span></Link>
   <nav className="admin-shell-links"><NavLinks role="owner"/></nav>
   <div className="admin-shell-footer"><a href="/admin/leave">Situs publik (keluar admin)</a><form action={logoutOwner}><button type="submit">Keluar Akun</button></form></div>
  </aside>
  <header className="admin-mobile-header mj-mobile-head"><Link href="/admin">Mas Jawa Laundry <span>Owner · POS</span></Link><form action={logoutOwner}><button type="submit">Keluar</button></form></header>
  <nav className="admin-shell-mobile mj-bottom-nav" aria-label="Navigasi POS owner"><NavLinks role="owner" mobile/></nav>
 </>;
}
export function CashierNavigation(){
 const path=usePathname();
 if(!path)return null;
 return <>
  <aside className="mj-staff-sidebar mj-sidebar" aria-label="Menu kasir">
   <Link className="mj-sidebar-brand" href="/kasir"><span className="mj-side-logo">MJ</span><span>Mas Jawa Laundry<small>Kasir · POS</small></span></Link>
   <nav className="mj-staff-links"><NavLinks role="cashier"/></nav>
   <form action={leaveCashier}><button type="submit" className="mj-logout">Keluar Kasir</button></form>
  </aside>
  <header className="mj-staff-mobile-head mj-mobile-head"><Link href="/kasir">Mas Jawa Laundry <span>Kasir · POS</span></Link><form action={leaveCashier}><button type="submit">Keluar</button></form></header>
  <nav className="mj-staff-bottom mj-bottom-nav" aria-label="Navigasi POS kasir"><NavLinks role="cashier" mobile/></nav>
 </>;
}
