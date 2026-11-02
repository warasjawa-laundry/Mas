
import Link from "next/link";
import type {Metadata} from "next";
import {getCashierSession} from "@/lib/pos/cashier-device";
import {createOwnerClient} from "@/lib/supabase/server";
import {CASHIER_PERMISSIONS,hasCashierGrant} from "@/lib/pos/cashier-permissions";
import {cookies} from "next/headers";
import {CASHIER_DEVICE_COOKIE,CASHIER_LOGIN_COOKIE} from "@/lib/pos/cashier-device";
import {loginCashier,leaveCashier} from "./actions";
import PosBoard,{type PosRow} from "@/components/pos/pos-board";
export const metadata:Metadata={title:"Kasir Mas Jawa Laundry",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
export default async function CashierHome({searchParams}:{searchParams:Promise<{error?:string;tab?:string;view?:string}>}){
 const [session,params]=await Promise.all([getCashierSession(),searchParams]);
 if(!session)return <main className="mj-login-screen">
  <section className="mj-login-card"><div className="mj-login-banner" aria-hidden="true"/><div className="mj-login-brand"><span className="mj-brand-mark"><img src="/pos/laundry-mark.svg" width="38" height="38" alt=""/></span><strong>Mas Jawa Laundry</strong></div>
   <nav className="mj-login-tabs" aria-label="Jenis pengguna"><Link href="/admin/login?role=owner">MANAJER</Link><span aria-current="page">KASIR</span></nav>
   <div className="mj-login-fields"><h1>Masuk Kasir</h1><p>Gunakan ID kasir yang diberikan manajer laundry.</p>
    {params.error&&<p role="alert" className="mj-pos-notice">{params.error==="unavailable"?"Login kasir belum tersedia pada database aktif.":"ID tidak dikenal, tidak aktif, atau terlalu banyak percobaan."}</p>}
    <form action={loginCashier}><label htmlFor="cashier-username">ID Kasir</label><input id="cashier-username" name="username" autoComplete="off" spellCheck={false} type="text" placeholder="MAS-0001" maxLength={8} pattern="MAS-[0-9]{4}" required/><button type="submit">Masuk</button></form>
    <Link href="/admin/login?role=owner">Masuk sebagai pemilik</Link></div>
  </section>
 </main>;
 const jar=await cookies();
 const client=await createOwnerClient();
 const tokens={p_device_token:jar.get(CASHIER_DEVICE_COOKIE)?.value??"",p_login_token:jar.get(CASHIER_LOGIN_COOKIE)?.value??""};
 let orders:PosRow[]=[];let dbReady=false;
 if(client&&hasCashierGrant(session.permissions,"order_view")){
  const {data,error}=await client.rpc("laundry_pos_g7_order_board",tokens);
  dbReady=!error&&Array.isArray(data);if(dbReady)orders=data as PosRow[];
 }
 return <>
  <PosBoard role="cashier" tab={params.tab} view={params.view} orders={orders} dbReady={dbReady} writeEnabled={session.write_enabled}/>
  <section className="mj-cashier-identity">{!session.write_enabled&&<p role="status">Modul transaksi belum diaktifkan</p>}<span>Kasir: {session.display_name} · {session.username}</span>
   <details><summary>Hak akses kasir</summary><ul>{CASHIER_PERMISSIONS.filter(([key])=>hasCashierGrant(session.permissions,key)).map(([key,label])=><li key={key}>{key==="member_lookup"?"Cari pelanggan":label}</li>)}</ul></details>
   <form action={leaveCashier}><button type="submit">Keluar Kasir</button></form></section>
 </>;
}
