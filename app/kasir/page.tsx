import Link from "next/link";
import type { Metadata } from "next";
import { getCashierSession, isCashierDevicePaired } from "@/lib/pos/cashier-device";
import { CASHIER_PERMISSIONS, hasCashierGrant } from "@/lib/pos/cashier-permissions";
import { loginCashier, leaveCashier, disconnectCashierDevice } from "./actions";

export const metadata: Metadata = { title: "Kasir Mas Jawa Laundry", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ error?: string }> };

const wrap = { maxWidth: 680, margin: "auto", padding: "32px 20px", fontFamily: "system-ui,sans-serif", minHeight: "80vh" } as const;

export default async function CashierHome({ searchParams }: Props) {
  const [session, params] = await Promise.all([getCashierSession(), searchParams]);
  const paired = session ? true : await isCashierDevicePaired();
  return <main style={wrap}>
    <p style={{fontSize:13,fontWeight:800,color:"#6d28d9"}}>MAS JAWA LAUNDRY</p>
    <h1 style={{fontSize:30}}>Kasir</h1>
    {!paired ? <section style={{background:"#f3f4f8",padding:24,borderRadius:16}}>
      <h2>Perangkat belum diaktifkan</h2>
      <p>Owner perlu mengaktifkan perangkat ini terlebih dahulu. Masuk sebagai pemilik, pilih kasir yang akan menggunakan perangkat, lalu tekan “Aktifkan di perangkat ini”.</p>
      <p>Kasir berikutnya cukup mengisi username <strong>MAS-0001</strong> (sesuai yang dibuat owner) tanpa password.</p>
      <Link href="/admin/login">Masuk sebagai pemilik</Link>
    </section> : !session ? <section style={{background:"#f3f4f8",padding:24,borderRadius:16}}>
      <h2>Masuk Kasir</h2>
      <p>Masukkan username yang diberikan owner. Tidak perlu password.</p>
      {params.error && <p role="alert" style={{color:"#9f1239"}}>
        {params.error === "unavailable" ? "Layanan kasir belum tersedia." :
          params.error === "device" ? "Perangkat belum diaktifkan owner." :
          "Username tidak cocok atau akses sementara terkunci. Periksa kembali atau hubungi owner."}
      </p>}
      <form action={loginCashier} style={{display:"flex",flexDirection:"column",gap:12}}>
        <label htmlFor="cashier-username" style={{fontWeight:700}}>Username Kasir</label>
        <input id="cashier-username" name="username" type="text" placeholder="MAS-0001"
          autoComplete="off" autoCapitalize="characters" spellCheck={false} required maxLength={8}
          pattern="MAS-[0-9]{4}" style={{minHeight:48,padding:12,border:"1px solid #bec8d7",borderRadius:10,fontSize:18}} />
        <button type="submit" style={{minHeight:48,padding:12,border:0,borderRadius:10,
          color:"#fff",background:"#6d28d9",fontSize:16,fontWeight:700}}>Masuk Kasir</button>
      </form>
      <p style={{fontSize:13,color:"#64748b",marginTop:15}}>Untuk keamanan, username hanya berlaku pada perangkat yang sudah disetujui owner.</p>
      <form action={disconnectCashierDevice}>
        <button type="submit" style={{minHeight:44,padding:"10px 14px",borderRadius:10}}>Lepaskan perangkat ini</button>
      </form>
    </section> : <>
      <p>Petugas: <strong>{session.display_name}</strong> · <strong>{session.username}</strong></p>
      <p>Outlet: <strong>{session.outlet_name}</strong></p>
      <p>{session.outlet_address}</p>
      <section role="status" style={{background:"#f3f4f8",padding:20,borderRadius:14}}>
        <strong>{session.write_enabled ? "Akses kasir aktif" : "Modul transaksi belum diaktifkan"}</strong>
        <p>{session.write_enabled ? "Modul nota dan status kerja telah disiapkan. Pembayaran dan poin masih menunggu G5." :
          "Pembuatan nota dan pembayaran belum tersedia. Data pelanggan dan poin produksi tidak berubah."}</p>
      </section>
      <section style={{marginTop:20,padding:18,border:"1px solid #e2e8f0",borderRadius:14}}><h2 style={{marginTop:0}}>Pesanan Laundry</h2><p>Daftar nota, tambah pesanan, dan status cucian. Transaksi hanya akan aktif setelah gate POS dan database disetujui.</p><Link href="/kasir/pesanan" style={{fontWeight:750}}>Buka Daftar Pesanan</Link></section>
      <h2 style={{marginTop:24,fontSize:19}}>Hak akses yang diberikan pemilik</h2>
      <ul>{CASHIER_PERMISSIONS.filter(([key]) => hasCashierGrant(session.permissions,key)).map(([key,label]) => <li key={key}>{label}</li>)}</ul>
      <p style={{fontSize:12,color:"#64748b"}}>Sesi login berlaku maksimum 12 jam, atau lebih singkat jika owner mencabut perangkat. Perangkat perlu aktivasi owner kembali setelah tujuh hari.</p>
      <form action={leaveCashier}><button type="submit" style={{minHeight:44,padding:"10px 20px",borderRadius:10}}>Keluar Kasir</button></form>
      <form action={disconnectCashierDevice}><button type="submit" style={{minHeight:44,padding:"10px 20px",borderRadius:10,marginTop:12}}>Lepaskan perangkat ini</button></form>
    </>}
  </main>;
}