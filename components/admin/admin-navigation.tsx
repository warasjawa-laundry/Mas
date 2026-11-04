"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutOwner } from "@/app/admin/actions";
import { leaveCashier } from "@/app/kasir/actions";
import PosIcon, { type PosIconName } from "@/components/pos/pos-icon";
import { assets,site } from "@/lib/site";
import {hasCashierGrant,type CashierGrants,type CashierPermission} from "@/lib/pos/cashier-permissions";

type Role = "owner" | "cashier";
type NavEntry={href:string;label:string;sub:string;icon:PosIconName;permission?:CashierPermission};
const ownerLinks:NavEntry[]=[
 {href:"/admin",label:"Pesanan",sub:"Antrian dan rincian nota",icon:"orders"},
 {href:"/admin/members",label:"Data Pelanggan",sub:"Daftar pelanggan",icon:"people"},
 {href:"/admin/kas",label:"Mutasi Kas",sub:"Kas outlet",icon:"cash"},
 {href:"/admin/laporan",label:"Laporan",sub:"Rekap operasional",icon:"report"}
];
const cashierLinks:NavEntry[]=[
 {href:"/kasir",label:"Pesanan",sub:"Antrian dan rincian nota",icon:"orders",permission:"order_view"},
 {href:"/kasir/pesanan/baru",label:"Tambah Pesanan",sub:"Pelanggan dan layanan",icon:"plus",permission:"order_create"},
 {href:"/kasir/kas",label:"Mutasi Kas",sub:"Penerimaan dan pengeluaran",icon:"cash",permission:"cash_view"},
 {href:"/kasir/laporan",label:"Laporan",sub:"Rekap per periode",icon:"report",permission:"reports_view"}
];
function Navigation({ role,permissions }: { role: Role;permissions?:CashierGrants }) {
  const path = usePathname();
  if (!path || path === "/admin/login") return null;
  const owner = role === "owner", base = owner ? "/admin" : "/kasir";
  const menu = path === base + "/menu";
  const links = owner ? ownerLinks : cashierLinks.filter(item=>!item.permission||hasCashierGrant(permissions,item.permission));
  const canSeeOrders=owner||hasCashierGrant(permissions,"order_view");
  const logout = owner ? logoutOwner : leaveCashier;
  function active(href: string) {
    if (href === base) return path === base || (!owner && path.startsWith("/kasir/pesanan") && path !== "/kasir/pesanan/baru");
    return path === href || path!.startsWith(href + "/");
  }
  return <>
    <a className="binatu-skip-link" href={owner ? "#admin-main" : "#cashier-main"}>Lewati navigasi</a>
    <aside className="binatu-sidebar" aria-label={owner ? "Menu manajer" : "Menu kasir"}>
      <div className="binatu-sidebar-top binatu-pattern"><div className="binatu-store-card">
        <Link href={base} className="binatu-store-brand" prefetch={false}><img src={assets.logo} width="42" height="42" alt="" /><span>MAS JAWA LAUNDRY<small>{site.shortAddress}</small></span></Link>
        <div className="binatu-store-role"><span>Akses saat ini</span><strong>{owner ? "Manajer" : "Kasir"}<i aria-hidden="true" /></strong></div>
      </div></div>
      <nav className="binatu-side-links" aria-label="Navigasi utama">{links.map(item => <Link href={item.href} key={item.href} prefetch={false} aria-current={active(item.href) ? "page" : undefined}><span className="binatu-side-icon"><PosIcon name={item.icon} size={21} /></span><span><strong>{item.label}</strong><small>{item.sub}</small></span></Link>)}</nav>
      <div className="binatu-sidebar-bottom"><Link href={base + "/menu"} prefetch={false} aria-current={menu ? "page" : undefined}><PosIcon name="menu" size={20} />Menu {owner ? "Manajer" : "Kasir"}</Link>{owner && <a href="/admin/leave">Situs publik</a>}<form action={logout}><button type="submit"><PosIcon name="logout" size={20} />Keluar Akun</button></form></div>
      <p className="binatu-sidebar-foot">Mas Jawa Laundry<span>{site.shortAddress}</span></p>
    </aside>
    <nav className="binatu-bottom-nav" aria-label={owner ? "Navigasi POS manajer" : "Navigasi POS kasir"}>
      {canSeeOrders&&<Link href={base} prefetch={false} aria-current={!menu && (path === base || !owner && path.startsWith("/kasir/pesanan")) ? "page" : undefined}><PosIcon name="orders" size={21} /><span>Pesanan</span></Link>}
      <Link href={base + "/menu"} prefetch={false} aria-current={menu || path !== base && (owner || !path.startsWith("/kasir/pesanan")) ? "page" : undefined}><PosIcon name="menu" size={21} /><span>Menu</span></Link>
      <form action={logout}><button type="submit" aria-label="Keluar akun"><PosIcon name="logout" size={19} /><span>Keluar</span></button></form>
    </nav>
  </>;
}
export default function AdminNavigation() { return <Navigation role="owner" />; }
export function CashierNavigation({permissions}:{permissions:CashierGrants}) { return <Navigation role="cashier" permissions={permissions} />; }
