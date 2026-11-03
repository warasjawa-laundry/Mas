import Link from "next/link";
import { randomUUID } from "node:crypto";
import {requireOwner} from "@/lib/supabase/owner";
import PosWorkspace from "@/components/pos/pos-workspace";
import {commandRecoveryKey} from "@/lib/pos/command-recovery";
import { formatIdr } from "@/lib/pos/g4-order";
import {postOwnerCash as postNonSaleCash,closeOwnerRegister as closeCashRegister,openOwnerCashRegister,recoverOwnerOperation} from "../pesanan/operations-actions";
import styles from "@/app/kasir/pesanan/orders.module.css";
import RecoverableForm from "@/components/admin/recoverable-form";
import PendingSubmit from "@/components/admin/pending-submit";
export const dynamic="force-dynamic";
export const metadata={title:"Mutasi Kas - Mas Jawa Laundry",robots:{index:false,follow:false}};
type Entry={direction:string;category:string;method:string;amount_idr:string;note:string|null;invoice_no:string|null;occurred_at:string};
type Overview={open:boolean;shift_id:string|null;opening_idr:string;expected_cash_idr:string;
 cash_in_idr:string;cash_out_idr:string;entries:Entry[]};
export default async function OwnerCash({searchParams}:{searchParams:Promise<{error?:string;saved?:string}>}){
 const {supabase,user}=await requireOwner();
 const [overviewResult,capabilities]=await Promise.all([supabase.rpc("laundry_pos_owner_cash_overview"),supabase.rpc("laundry_pos_owner_capabilities")]);
 const {data,error}=overviewResult;
 const canFinance=!capabilities.error&&capabilities.data?.owner_operations===true&&capabilities.data?.finance_enabled===true;
 const query=await searchParams;const overview:Overview|null=error||!data||typeof data!=="object"||
 typeof data.open!=="boolean"?null:data as Overview;
 return <PosWorkspace title="Mutasi Kas" category="OPERASIONAL" description="Kas utama Mas Jawa Laundry melalui sesi Owner.">
 <nav className={styles.header} aria-label="Navigasi operasional">
 <Link className={styles.mainLink} href="/admin/laporan">Laporan</Link></nav>
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
 {!canFinance&&<p className={styles.warning}>Transaksi masih dikunci. Tidak ada posting kas ke produksi.</p>}
 <RecoverableForm className={overview.open?styles.paymentForm:undefined} action={postNonSaleCash}
 recoveryKey={commandRecoveryKey('owner',user.id,'CASH_ENTRY')} recoverAction={recoverOwnerOperation.bind(null,'CASH_ENTRY',null)}>
 {overview.open&&<><h3>Catat kas masuk / keluar non-penjualan</h3>
 <input type="hidden" name="requestId" value={randomUUID()}/>
 <label>Jenis<select name="direction"><option value="IN">Kas masuk</option><option value="OUT">Kas keluar</option></select></label>
 <label>Nominal (Rp)<input name="amountIdr" required inputMode="numeric" pattern="[1-9][0-9]*" maxLength={10}/></label>
 <label>Alasan<input name="reason" required minLength={3} maxLength={300} placeholder="Misalnya pembelian plastik"/></label>
 <PendingSubmit className={styles.mainButton} disabled={!canFinance} label="Simpan mutasi"/>
 </>}</RecoverableForm>
 <RecoverableForm className={overview.open?styles.paymentForm:undefined} action={closeCashRegister}
 recoveryKey={commandRecoveryKey('owner',user.id,'CLOSE_SHIFT')} recoverAction={recoverOwnerOperation.bind(null,'CLOSE_SHIFT',null)}>
 {overview.open&&<><h3>Tutup shift dan hitung uang tunai</h3>
 <input type="hidden" name="requestId" value={randomUUID()}/>
 <label>Uang fisik yang dihitung (Rp)<input name="countedIdr" required inputMode="numeric" pattern="(0|[1-9][0-9]*)" maxLength={10} placeholder={overview.expected_cash_idr}/></label>
 <label>Alasan selisih (wajib jika ada selisih)<input name="reason" maxLength={300}/></label>
 <p className={styles.muted}>Selisih dicatat, tidak menghapus jurnal lama. Setelah tutup, pembayaran baru wajib membuka shift baru.</p>
 <PendingSubmit className={styles.dangerButton} disabled={!canFinance} label="Konfirmasi tutup shift"/>
 </>}</RecoverableForm>
 <RecoverableForm action={openOwnerCashRegister} className={!overview.open?styles.paymentForm:undefined}
 recoveryKey={commandRecoveryKey('owner',user.id,'OPEN_SHIFT')} recoverAction={recoverOwnerOperation.bind(null,'OPEN_SHIFT',null)}>
 {!overview.open&&<>
 <input type="hidden" name="requestId" value={randomUUID()}/>
 <p>Shift baru memakai saldo awal nol.</p><PendingSubmit className={styles.mainButton} disabled={!canFinance} label="Buka kas utama"/>
 </>}</RecoverableForm>
 </section>
 <section className={styles.card}><h2>Riwayat mutasi terakhir</h2>
 {overview.entries.length===0?<p className={styles.muted}>Belum ada mutasi.</p>:overview.entries.map((entry,i)=><div className={styles.receipt} key={i}>
 <div><strong>{entry.category==='PAYMENT'?'Pembayaran':entry.category==='REFUND'?'Refund':entry.direction==='IN'?'Kas masuk lainnya':'Kas keluar lainnya'}</strong>
 <small>{entry.invoice_no||entry.note||'Tanpa nota'} · {new Date(entry.occurred_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB</small></div>
 <strong>{entry.direction==='OUT'?'−':'+'}{formatIdr(entry.amount_idr)}</strong></div>)}
 </section></>}
 </PosWorkspace>;
}
