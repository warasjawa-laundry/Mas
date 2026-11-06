import Link from 'next/link';
import RecoverableForm from '@/components/admin/recoverable-form';
import PendingSubmit from '@/components/admin/pending-submit';
import Disclosure from './disclosure';
import {formatIdr} from '@/lib/pos/g4-order';
import CashEntryFields from './cash-entry-fields';
import type {CommandActionResult} from '@/lib/pos/command-recovery';
import styles from '@/app/kasir/pesanan/orders.module.css';
export type CashOverview={open:boolean;opening_idr:string;expected_cash_idr:string;cash_in_idr:string;cash_out_idr:string;finance_enabled?:boolean;entries:{id?:string;direction:string;category:string;method:string;amount_idr:string;note:string|null;invoice_no:string|null;occurred_at:string;order_id?:string|null;actor?:string;customer?:string|null;can_view_order?:boolean;item_count?:number;quantity_summary?:string|null;expense_category_code?:string|null;expense_category_label?:string|null;accounting_classification?:string|null}[]};
export default function CashPanel({overview,role,mayEdit,canFinance,requestId,recoveryKey,action,recoverAction}:{overview:CashOverview|null;role:'owner'|'cashier';mayEdit:boolean;canFinance:boolean;requestId:string;recoveryKey:string;action:(form:FormData)=>Promise<CommandActionResult>;recoverAction:(id:string)=>Promise<CommandActionResult>}){
 if(!overview)return <p role="status" className={styles.warning}>Kas otomatis belum tersedia. Periksa pemasangan modul V3 dan koneksi; tidak ada uang yang dicatat.</p>;
 const history=(overview as CashOverview&{reconciliations?:{at:string;owner:string;expected:string;counted:string;difference:string;reason:string;is_test?:boolean}[]}).reconciliations??[];
 return <><section className={styles.card}><h2>Ringkasan kas</h2><p className={styles.muted}>Kas dikelola otomatis. Login, cetak, dan WhatsApp tidak mengubah saldo.</p>
 <div className={styles.paymentTotals}><div><small>Saldo awal historis</small><strong>{formatIdr(overview.opening_idr)}</strong></div><div><small>Masuk tunai</small><strong>{formatIdr(overview.cash_in_idr)}</strong></div><div><small>Saldo diharapkan</small><strong>{formatIdr(overview.expected_cash_idr)}</strong></div></div>
 <p>Keluar tunai: {formatIdr(overview.cash_out_idr)}. Transfer/QRIS tidak termasuk uang fisik.</p>
 {!canFinance&&<p className={styles.warning}>Pencatatan kas belum diizinkan.</p>}
 {mayEdit&&<RecoverableForm action={action} recoveryKey={recoveryKey} recoverAction={recoverAction} className={styles.paymentForm}><Disclosure title="Catat kas masuk / keluar non-penjualan" className={styles.refundPanel}>
 <input type="hidden" name="requestId" value={requestId}/><CashEntryFields role={role}/>
 <PendingSubmit disabled={!canFinance} className={styles.mainButton} label="Simpan mutasi"/></Disclosure></RecoverableForm>}
 </section><section className={styles.card}><h2>Riwayat mutasi terakhir</h2>{overview.entries.length===0?<p>Belum ada mutasi.</p>:overview.entries.map((entry,index)=><div className={styles.receipt} key={entry.id??index} id={entry.id?`mutasi-${entry.id}`:undefined}>
 <div><strong>{entry.invoice_no||entry.note||'Mutasi non-penjualan'}</strong><small>{entry.category==='PAYMENT'?'Pembayaran':entry.category==='REFUND'?'Refund':entry.direction==='IN'?'Kas masuk':'Kas keluar'} · {entry.method==='CASH'?'Tunai':entry.method==='TRANSFER'?'Transfer':entry.method==='QRIS'?'QRIS':'Non-tunai'} · {new Date(entry.occurred_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB</small>
 <small>Petugas: {entry.actor||'Identitas historis belum tersedia'}{entry.customer?' · '+entry.customer:''}</small>
 {entry.can_view_order===true&&entry.item_count!==undefined&&entry.item_count>0&&<small>{entry.item_count} layanan{entry.quantity_summary?' · '+entry.quantity_summary:''}</small>}
 {(entry.category==='NON_SALE_IN'||entry.category==='NON_SALE_OUT')&&<small>{entry.expense_category_code==='CASH_TRANSFER'?'Perpindahan uang laci (satu sisi)':entry.expense_category_label||'Belum dikategorikan (histori)'}{entry.accounting_classification==='EQUITY'?' · Modal':''}{entry.expense_category_code&&entry.note?' · '+entry.note:''}</small>}
 {entry.order_id&&entry.can_view_order&&<Link className={styles.mainLink} href={`${role==='owner'?'/admin':'/kasir'}/pesanan/${entry.order_id}`}>Lihat Rincian Layanan</Link>}</div>
 <strong>{entry.direction==='OUT'?'−':'+'}{formatIdr(entry.amount_idr)}</strong></div>)}</section>
 {role==='owner'&&<section className={styles.card}><h2>Riwayat Cocokkan Kas</h2>{history.length===0?<p>Belum ada hasil penghitungan.</p>:history.map((r,index)=><div className={styles.receipt} key={index}><div><strong>{new Date(r.at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB{r.is_test?' · Simulasi':''}</strong><small>Owner {r.owner} · {r.reason}</small><small>Diharapkan {formatIdr(r.expected)} · Dihitung {formatIdr(r.counted)}</small></div><strong>Selisih {formatIdr(r.difference)}</strong></div>)}</section>}</>;
}
