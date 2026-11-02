import Link from "next/link";
import type { Metadata } from "next";
import { getCashierSession } from "@/lib/pos/cashier-device";
import { CASHIER_PERMISSIONS, hasCashierGrant } from "@/lib/pos/cashier-permissions";
import { loginCashier, leaveCashier } from "./actions";

export const metadata: Metadata = { title: "Kasir Mas Jawa Laundry", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ error?: string }> };

const wrap = { maxWidth: 680, margin: "auto", padding: "32px 20px", fontFamily: "system-ui,sans-serif", minHeight: "80vh" } as const;

export default async function CashierHome({ searchParams }: Props) {
  const [session, params] = await Promise.all([getCashierSession(), searchParams]);
  return <main style={wrap}>
    <p style={{fontSize:13,fontWeight:800,color:"#a16207"}}>MAS JAWA LAUNDRY</p>
    <h1 style={{fontSize:30}}>Kasir</h1>
    {!session ? <section style={{background:"#f3f4f8",padding:24,borderRadius:16}}>
      <h2>Masuk Kasir</h2>
      <p>Masukkan ID kasir empat angka yang diberikan pemilik, misalnya <strong>MAS-0001</strong>. Tidak perlu password atau aktivasi perangkat.</p>
      {params.error && <p role="alert" style={{color:"#9f1239"}}>
        {params.error === "unavailable" ? "Login kasir belum tersedia pada database aktif." :
          "ID kasir tidak dikenal, tidak aktif, atau terlalu banyak percobaan. Periksa ID atau hubungi pemilik."}
      </p>}
      <form action={loginCashier} style={{display:"flex",flexDirection:"column",gap:12}}>
        <label htmlFor="cashier-username" style={{fontWeight:700}}>ID Kasir</label>
        <input id="cashier-username" name="username" type="text" placeholder="MAS-0001"
          autoComplete="off" autoCapitalize="characters" spellCheck={false} required maxLength={8}
          pattern="MAS-[0-9]{4}" style={{minHeight:48,padding:12,border:"1px solid #bec8d7",borderRadius:10,fontSize:18}} />
        <button type="submit" style={{minHeight:48,padding:12,border:0,borderRadius:10,
          color:"#fff",background:"#a16207",fontSize:16,fontWeight:700}}>Masuk Kasir</button>
      </form>
      <p style={{fontSize:13,color:"#64748b",marginTop:15}}>Hanya karyawan terdaftar dan aktif yang bisa masuk. Menu mengikuti hak akses dari pemilik.</p>
      <p style={{fontSize:13,marginTop:18}}><Link href="/admin/login">Masuk sebagai pemilik (ID dan password)</Link></p>
    </section> : <>
      <p>Petugas: <strong>{session.display_name}</strong> · <strong>{session.username}</strong></p>
      <p>Outlet: <strong>{session.outlet_name}</strong></p>
      <p>{session.outlet_address}</p>
      <section role="status" style={{background:"#f3f4f8",padding:20,borderRadius:14}}>
        <strong>{session.write_enabled ? "Akses kasir aktif" : "Modul transaksi belum diaktifkan"}</strong>
        <p>{session.write_enabled ? "Modul nota, pembayaran, kas dan laporan mengikuti izin petugas serta status fitur database." :
          "Pembuatan nota dan pembayaran belum tersedia. Data pelanggan dan poin produksi tidak berubah."}</p>
      </section>
      <section style={{marginTop:20,padding:18,border:"1px solid #e2e8f0",borderRadius:14}}><h2 style={{marginTop:0}}>Pesanan Laundry</h2><p>Daftar nota, tambah pesanan, dan status cucian. Transaksi hanya akan aktif setelah gate POS dan database disetujui.</p><Link href="/kasir/pesanan" style={{fontWeight:750}}>Buka Daftar Pesanan</Link></section>
      {hasCashierGrant(session.permissions,"cash_view")&&<section style={{marginTop:16,padding:18,border:"1px solid #e2e8f0",borderRadius:14}}><h2>Mutasi Kas</h2><p>Kas masuk/keluar, saldo kas fisik dan tutup shift.</p><Link href="/kasir/kas">Buka Mutasi Kas</Link></section>}
      {hasCashierGrant(session.permissions,"reports_view")&&<section style={{marginTop:16,padding:18,border:"1px solid #e2e8f0",borderRadius:14}}><h2>Laporan</h2><p>Rekap pembayaran dan mutasi per periode WIB.</p><Link href="/kasir/laporan">Lihat Laporan</Link></section>}
      <h2 style={{marginTop:24,fontSize:19}}>Hak akses yang diberikan pemilik</h2>
      <ul>{CASHIER_PERMISSIONS.filter(([key]) => hasCashierGrant(session.permissions,key)).map(([key,label]) => <li key={key}>{label}</li>)}</ul>
      <p style={{fontSize:12,color:"#64748b"}}>Sesi login berlaku maksimum 12 jam dan dapat dicabut pemilik kapan saja.</p>
      <form action={leaveCashier}><button type="submit" style={{minHeight:44,padding:"10px 20px",borderRadius:10}}>Keluar Kasir</button></form>
    </>}
  </main>;
}