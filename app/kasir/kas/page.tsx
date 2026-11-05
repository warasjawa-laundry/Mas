import {randomUUID} from 'node:crypto';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {cashierRpcAccess} from '@/lib/pos/g4-server';
import {hasCashierGrant} from '@/lib/pos/cashier-permissions';
import ContextNotice,{readDisplayContext} from '@/components/pos/context-notice';
import CashPanel,{type CashOverview} from '@/components/pos/cash-panel';
import {commandRecoveryKey} from '@/lib/pos/command-recovery';
import {postNonSaleCash} from './actions';
import {recoverCashierCommand} from '../pesanan/recovery-actions';
import styles from '../pesanan/orders.module.css';
export const dynamic='force-dynamic';
export const metadata={title:'Mutasi Kas - Mas Jawa Laundry',robots:{index:false,follow:false}};
export default async function CashierCash(){
 const access=await cashierRpcAccess('cash_view');if(!access)redirect('/kasir');
 const [cash,display]=await Promise.all([access.client.rpc('laundry_pos_v3_cash',access.tokens),access.client.rpc('laundry_pos_display_context',access.tokens)]);
 const overview:CashOverview|null=!cash.error&&cash.data?.automatic_cash===true?cash.data:null;
 const context=display.error?null:readDisplayContext(display.data);
 return <main className={styles.shell}><Link href="/kasir">Kembali ke Kasir</Link><h1>Mutasi Kas</h1><ContextNotice context={context}/>
 {hasCashierGrant(access.session.permissions,'reports_view')&&<Link href="/kasir/laporan">Laporan</Link>}
 <CashPanel overview={overview} role="cashier" mayEdit={hasCashierGrant(access.session.permissions,'cash_entry')} canFinance={context?.finance_enabled===true&&access.session.write_enabled} requestId={randomUUID()} action={postNonSaleCash} recoveryKey={commandRecoveryKey('cashier',access.session.staff_id,'CASH_ENTRY')} recoverAction={recoverCashierCommand.bind(null,'CASH_ENTRY',null)}/></main>;
}
