import {randomUUID} from 'node:crypto';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {cashierRpcAccess} from '@/lib/pos/g4-server';
import {hasCashierGrant} from '@/lib/pos/cashier-permissions';
import ContextNotice,{readDisplayContext} from '@/components/pos/context-notice';
import CashPanel,{type CashOverview} from '@/components/pos/cash-panel';
import {commandRecoveryKey} from '@/lib/pos/command-recovery';
import {cashEntryId,includeCashEntry} from '@/lib/pos/cash-history';
import {postNonSaleCash} from './actions';
import {recoverCashierCommand} from '../pesanan/recovery-actions';
import styles from '../pesanan/orders.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Mutasi Kas - Mas Jawa Laundry',robots:{index:false,follow:false}};
export default async function CashierCash({searchParams}:{searchParams:Promise<{entry?:string}>}){
 const access=await cashierRpcAccess('cash_view');if(!access)redirect('/kasir');
 const requested=(await searchParams).entry;
 const [cash,display,selected]=await Promise.all([access.client.rpc('laundry_pos_v3_cash',access.tokens),access.client.rpc('laundry_pos_display_context',access.tokens),cashEntryId(requested)?access.client.rpc('laundry_pos_cash_entry_detail',{...access.tokens,p_entry_id:requested}):Promise.resolve(null)]);
 const overview:CashOverview|null=!cash.error&&cash.data?.automatic_cash===true?cash.data:null;
 const context=display.error?null:readDisplayContext(display.data);
 const selection=includeCashEntry(overview,requested,selected);
 return <main className={styles.shell}><Link href="/kasir">Kembali ke Kasir</Link><h1>Mutasi Kas</h1><ContextNotice context={context}/>
 {hasCashierGrant(access.session.permissions,'reports_view')&&<Link href="/kasir/laporan">Laporan</Link>}
 {selection.notice&&<p role="status" className={styles.warning}>{selection.notice}</p>}
 <CashPanel overview={selection.overview} role="cashier" mayEdit={hasCashierGrant(access.session.permissions,'cash_entry')} canFinance={context?.finance_enabled===true&&access.session.write_enabled} requestId={randomUUID()} action={postNonSaleCash} recoveryKey={commandRecoveryKey('cashier',access.session.staff_id,'CASH_ENTRY')} recoverAction={recoverCashierCommand.bind(null,'CASH_ENTRY',null)}/></main>;
}
