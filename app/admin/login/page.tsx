import {assets,site} from "@/lib/site";

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
 return <main className="admin-auth binatu-login-screen"><section className="admin-login-card binatu-login-card" aria-labelledby="login-heading">
  <div className="binatu-login-banner binatu-pattern" aria-hidden="true"/>
  <div className="binatu-login-brand"><span className="binatu-login-mark"><img src={assets.logo} width="36" height="36" alt=""/></span><div><strong>Mas Jawa Laundry</strong><span>{site.shortAddress}</span></div></div>
  <nav className="binatu-login-tabs" aria-label="Pilih jenis login">
   <Link prefetch={false} href="/admin/login?role=owner" aria-current={!cashier?"page":undefined}>Manajer</Link>
   <Link prefetch={false} href="/admin/login?role=kasir" aria-current={cashier?"page":undefined}>Kasir</Link>
  </nav>
  <div className="binatu-login-fields">
   <h1 id="login-heading">{cashier?"Masuk Kasir":"Masuk Manajer"}</h1>
   <p className={cashier?"binatu-login-help":"admin-hint"}>{cashier?"Gunakan ID kasir MAS-2XXX yang diberikan Manajer.":"Masukkan ID dan password manajer."}</p>
   {message&&<p className="admin-error" role="alert">{message}</p>}
   {success&&<p className="admin-success" role="status">{success}</p>}
   {cashier?<form action={loginCashier} className="admin-form"><label htmlFor="login-cashier-id">ID Kasir</label>
    <input id="login-cashier-id" type="text" name="username" placeholder="MAS-2001" autoComplete="off" maxLength={8} pattern="MAS-[0-9]{4}" required/>
    <OwnerLoginSubmit/></form>:
    <form action={loginOwner} className="admin-form" autoComplete="off">
     <label htmlFor="owner-id">ID Pengguna</label><input id="owner-id" name="loginId" type="text" autoComplete="username" defaultValue="masjawalaundry" required maxLength={64}/>
     <label htmlFor="owner-password">Password</label><OwnerPassword/><OwnerLoginSubmit/></form>}
   <p className="binatu-login-foot">Mas Jawa Laundry · Akses outlet sesuai akun Anda.</p>
  </div>
 </section></main>;
}
