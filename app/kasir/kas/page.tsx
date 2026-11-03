import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { cashierRpcAccess } from "@/lib/pos/g4-server";
import { hasCashierGrant } from "@/lib/pos/cashier-permissions";
import { formatIdr } from "@/lib/pos/g4-order";
import { postNonSaleCash, closeCashRegister } from "./actions";
import styles from "../pesanan/orders.module.css";
import RecoverableForm from "@/components/admin/recoverable-form";
import PendingSubmit from "@/components/admin/pending-submit";
import {commandRecoveryKey} from "@/lib/pos/command-recovery";
import {recoverCashierCommand} from "../pesanan/recovery-actions";
export const dynamic="force-dynamic";
export const metadata={title:"Mutasi Kas - Mas Jawa Laundry",robots:{index:false,follow:false}};
type Entry={direction:string;category:string;method:string;amount_idr:string;note:string|null;invoice_no:string|null;occurred_at:string};
type Overview={open:boolean;shift_id:string|null;opening_idr:string;expected_cash_idr:string;
 cash_in_idr:string;cash_out_idr:string;finance_enabled?:boolean;entries:Entry[]};
export default async function CashierCash({searchParams}:{searchParams:Promise<{error?:string;saved?:string}>}){
 const access=await cashierRpcAccess("cash_view");if(!access)redirect("/kasir");
 const {data,error}=await access.client.rpc("laundry_pos_g6_cash_overview",access.tokens);
 const query=await searchParams;const overview:Overview|null=error||!data||typeof data!=="object"||
 typeof data.open!=="boolean"?null:data as Overview;
 const mayEdit=hasCashierGrant(access.session.permissions,"cash_entry");
 const canFinance=access.session.write_enabled&&overview?.finance_enabled===true;
 return <main className={styles.shell}>
 <Link href="/kasir">← Kasir</Link>
 <header className={styles.header}><div><p className={styles.kicker}>MAS JAWA LAUNDRY · {access.session.username}</p>
 <h1>Mutasi Kas</h1><p className={styles.muted}>Kas utama · satu outlet</p></div>
 <Link className={styles.mainLink} href="/kasir/laporan">Laporan</Link></header>
 {query.error&&<p role="alert" className={styles.warning}>
  {query.error==='unconfirmed'?"Hasil mutasi belum diketahui. Periksa jurnal sebelum melakukan tindakan ulang.":
  "Permintaan tidak dapat diproses. Periksa data, hak akses, dan status kas."}</p>}
 {query.saved&&<p role="status" className={styles.ok}>Transaksi kas sudah dikonfirmasi database.</p>}
 {!overview?<p role="status" className={styles.warning}>Modul kas belum tersedia di database aktif.</p>:<>
 <section className={styles.card}><div className={styles.cardHeading}><h2>Ringkasan kas</h2>
 <span className={styles.paymentBadge}>{overview.open?'Shift terbuka':'Shift tertutup'}</span></div>
 <div className={styles.paymentTotals}>
 <div><small>Saldo awal</small><strong>{formatIdr(overview.opening_idr)}</strong></div>
 <div><small>Masuk tunai</small><strong>{formatIdr(overview.cash_in_idr)}</strong></div>
 <div className={styles.remaining}><small>Saldo diharapkan</small><strong>{formatIdr(overview.expected_cash_idr)}</strong></div>
 </div><p className={styles.muted}>Pengeluaran tunai: {formatIdr(overview.cash_out_idr)}. Transfer/non-tunai tidak dihitung sebagai uang fisik dalam laci.</p>
 {!canFinance&&<p className={styles.warning}>Transaksi finansial masih dikunci. Tidak ada posting kas ke produksi.</p>}
 {mayEdit&&<RecoverableForm className={styles.paymentForm} action={postNonSaleCash}
  recoveryKey={commandRecoveryKey('cashier',access.session.staff_id,'CASH_ENTRY')} recoverAction={recoverCashierCommand.bind(null,'CASH_ENTRY',null)}>
 {overview.open&&<details className={styles.refundPanel}><summary>Catat kas masuk / keluar non-penjualan</summary>
 <input type="hidden" name="requestId" value={randomUUID()}/>
 <label>Jenis<select name="direction"><option value="IN">Kas masuk</option><option value="OUT">Kas keluar</option></select></label>
 <label>Nominal (Rp)<input name="amountIdr" required inputMode="numeric" pattern="[1-9][0-9]*" maxLength={10}/></label>
 <label>Alasan<input name="reason" required minLength={3} maxLength={300} placeholder="Misalnya pembelian plastik"/></label>
 <PendingSubmit className={styles.mainButton} disabled={!canFinance} label="Simpan mutasi"/>
 </details>}</RecoverableForm>}
 {mayEdit&&<RecoverableForm className={styles.paymentForm} action={closeCashRegister}
  recoveryKey={commandRecoveryKey('cashier',access.session.staff_id,'CLOSE_SHIFT')} recoverAction={recoverCashierCommand.bind(null,'CLOSE_SHIFT',null)}>
 {overview.open&&<details className={styles.refundPanel}><summary>Tutup shift dan hitung uang tunai</summary>
 <input type="hidden" name="requestId" value={randomUUID()}/>
 <label>Uang fisik yang dihitung (Rp)<input name="countedIdr" required inputMode="numeric" pattern="(0|[1-9][0-9]*)" maxLength={10} placeholder={overview.expected_cash_idr}/></label>
 <label>Alasan selisih (wajib jika ada selisih)<input name="reason" maxLength={300}/></label>
 <p className={styles.muted}>Selisih dicatat, tidak menghapus jurnal lama. Setelah tutup, pembayaran baru wajib membuka shift baru.</p>
 <PendingSubmit className={styles.dangerButton} disabled={!canFinance} label="Konfirmasi tutup shift"/>
 </details>}</RecoverableForm>}
 {!overview.open&&<p className={styles.muted}>Buka shift baru dari halaman pembayaran nota dengan izin <strong>Terima pembayaran</strong>.</p>}
 </section>
 <section className={styles.card}><h2>Riwayat mutasi terakhir</h2>
 {overview.entries.length===0?<p className={styles.muted}>Belum ada mutasi.</p>:overview.entries.map((entry,i)=><div className={styles.receipt} key={i}>
 <div><strong>{entry.category==='PAYMENT'?'Pembayaran':entry.category==='REFUND'?'Refund':entry.direction==='IN'?'Kas masuk lainnya':'Kas keluar lainnya'}</strong>
 <small>{entry.invoice_no||entry.note||'Tanpa nota'} · {new Date(entry.occurred_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB</small></div>
 <strong>{entry.direction==='OUT'?'−':'+'}{formatIdr(entry.amount_idr)}</strong></div>)}
 </section></>}
 </main>;
}
