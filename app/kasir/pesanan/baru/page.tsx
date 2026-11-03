import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { cashierRpcAccess } from "@/lib/pos/g4-server";
import { hasCashierGrant } from "@/lib/pos/cashier-permissions";
import { OrderForm,type CatalogService } from "./order-form";
import styles from "./wizard.module.css";
import {commandRecoveryKey} from "@/lib/pos/command-recovery";
import {recoverCashierCommand} from "../recovery-actions";

export const dynamic="force-dynamic";
export const metadata={title:"Tambah Pesanan - Mas Jawa Laundry",robots:{index:false,follow:false}};
export default async function NewCashierOrder({searchParams}:{searchParams:Promise<{error?:string}>}){
 const access=await cashierRpcAccess("order_view");
 if(!access)redirect("/kasir");
 const {data,error}=await access.client.rpc("laundry_pos_g4_catalog",access.tokens);
 const {error:reason}=await searchParams;
 return <main className={styles.shell}>
  <div className={`${styles.pagePattern} binatu-pattern`} aria-hidden="true"/>
  <Link href="/kasir/pesanan">← Daftar pesanan</Link>
  <p className={styles.brand}>MAS JAWA LAUNDRY · {access.session.username}</p>
  <h1>Tambah Pesanan</h1>
  {reason&&<p className={styles.warn} role="alert">{reason==='unconfirmed'?'Penyimpanan belum terkonfirmasi. Sebelum mencoba lagi, periksa Daftar Pesanan agar tidak membuat duplikat.':
   reason==='disabled'?'Transaksi belum diaktifkan.':'Form tidak valid, periksa data pelanggan dan kuantitas.'}</p>}
  {error?<p className={styles.warn} role="alert">Katalog POS belum tersedia di database aktif. Tidak ada transaksi yang dibuat.</p>:
   <OrderForm services={(Array.isArray(data)?data:[]) as CatalogService[]} requestId={randomUUID()} canWrite={access.session.write_enabled} canLookup={hasCashierGrant(access.session.permissions,"member_lookup")}
    recoveryKey={commandRecoveryKey('cashier',access.session.staff_id,'CREATE_ORDER')} recoverAction={recoverCashierCommand.bind(null,'CREATE_ORDER',null)}/>}
 </main>;
}
