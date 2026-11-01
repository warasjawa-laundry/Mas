import Link from "next/link";
import type { Metadata } from "next";
import { getCashierSession } from "@/lib/pos/cashier-device";
import { CASHIER_PERMISSIONS, hasCashierGrant } from "@/lib/pos/cashier-permissions";
import { leaveCashier } from "./actions";

export const metadata: Metadata = { title: "Kasir Mas Jawa Laundry", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CashierHome() {
  const session = await getCashierSession();
  return <main style={{maxWidth:680,margin:"auto",padding:"32px 20px",fontFamily:"system-ui,sans-serif",minHeight:"80vh"}}>
    <p style={{fontSize:13,fontWeight:800,color:"#6d28d9"}}>MAS JAWA LAUNDRY</p>
    <h1 style={{fontSize:30}}>Kasir</h1>
    {!session ? <section style={{background:"#f3f4f8",padding:24,borderRadius:16}}>
      <h2>Perangkat belum diaktifkan</h2>
      <p>Tidak perlu ID atau password kasir. Minta pemilik masuk melalui akun owner pada perangkat ini, pilih kasir, lalu tekan “Aktifkan di perangkat ini”.</p>
      <p>Setelah itu, akun owner otomatis keluar dan hanya akses kasir yang tersisa.</p>
      <Link href="/admin/login">Masuk sebagai pemilik</Link>
    </section> : <>
      <p>Petugas: <strong>{session.display_name}</strong></p>
      <p>Outlet: <strong>{session.outlet_name}</strong></p>
      <p>{session.outlet_address}</p>
      <section role="status" style={{background:"#f3f4f8",padding:20,borderRadius:14}}>
        <strong>{session.write_enabled ? "Akses kasir aktif" : "Modul transaksi belum diaktifkan"}</strong>
        <p>{session.write_enabled ? "Hak akses kasir akan dipakai oleh modul nota dan pembayaran ketika fitur tersedia." : "Pembuatan nota dan pembayaran belum tersedia. Data pelanggan dan poin produksi tidak berubah."}</p>
      </section>
      <h2 style={{marginTop:24,fontSize:19}}>Hak akses diberikan pemilik</h2>
      <ul>{CASHIER_PERMISSIONS.filter(([key]) => hasCashierGrant(session.permissions,key)).map(([key,label]) => <li key={key}>{label}</li>)}</ul>
      <p style={{fontSize:12,color:"#64748b"}}>Perangkat otomatis kedaluwarsa setelah 7 hari. Pemilik bisa mencabut akses lebih awal.</p>
      <form action={leaveCashier}><button type="submit" style={{minHeight:44,padding:"10px 20px",borderRadius:10}}>Keluar dari kasir</button></form>
    </>}
  </main>;
}