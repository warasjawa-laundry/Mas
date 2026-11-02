
import Link from "next/link";
import {loginOwner} from "@/app/admin/actions";
import {loginCashier} from "@/app/kasir/actions";
import {OwnerPassword} from "@/components/admin/owner-password";
import OwnerLoginSubmit from "@/components/admin/owner-login-submit";
type Props={searchParams:Promise<{role?:string;error?:string;notice?:string}>};
export default async function OwnerLogin({searchParams}:Props){
 const {role,error,notice}=await searchParams;
 const cashier=role==="kasir";
 const message=error==="invalid"?"ID atau password tidak cocok, akun nonaktif, atau terlalu banyak percobaan.":error==="unavailable"?"Akses admin belum tersedia. Hubungi pengelola.":null;
 const success=notice==="password-changed"?"Password berhasil diubah. Silakan masuk kembali.":notice==="logout"?"Anda telah keluar.":notice==="reauth"?"Untuk keamanan, masukkan kembali password sebelum membuka area owner.":null;
 return <main className="admin-auth mj-login-screen"><section className="admin-login-card mj-login-card">
  <div className="mj-login-banner" aria-hidden="true"/>
  <div className="mj-login-brand"><span className="mj-brand-mark">MJ</span><strong>Mas Jawa Laundry</strong></div>
  <nav className="mj-login-tabs" aria-label="Pilih jenis login">
   <Link href="/admin/login?role=owner" aria-current={!cashier?"page":undefined}>OWNER</Link>
   <Link href="/admin/login?role=kasir" aria-current={cashier?"page":undefined}>KARYAWAN</Link>
  </nav>
  <div className="mj-login-fields">
   <h1>{cashier?"Masuk Kasir":"Masuk Pemilik"}</h1>
   <p>{cashier?"Gunakan ID MAS-XXXX yang dibuat owner. Tidak memerlukan password.":"Gunakan ID dan password pemilik untuk mengakses POS dan pengaturan."}</p>
   {message&&<p className="admin-error" role="alert">{message}</p>}
   {success&&<p className="admin-success" role="status">{success}</p>}
   {cashier?<form action={loginCashier} className="admin-form"><label htmlFor="login-cashier-id">ID Kasir</label>
    <input id="login-cashier-id" type="text" name="username" placeholder="MAS-0001" autoComplete="off" maxLength={8} pattern="MAS-[0-9]{4}" required/>
    <button className="admin-primary" type="submit">Masuk Kasir</button></form>:
    <form action={loginOwner} className="admin-form" autoComplete="off">
     <label htmlFor="owner-id">ID Pengguna</label><input id="owner-id" name="loginId" type="text" autoComplete="username" defaultValue="masjawalaundry" required maxLength={64}/>
     <label htmlFor="owner-password">Password</label><OwnerPassword/><OwnerLoginSubmit/></form>}
   <p className="mj-login-foot">Satu aplikasi POS · Hak akses mengikuti akun yang digunakan.</p>
  </div>
 </section></main>;
}
