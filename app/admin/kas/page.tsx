import {randomUUID} from 'node:crypto';
import Link from 'next/link';
import {requireOwner} from '@/lib/supabase/owner';
import PosWorkspace from '@/components/pos/pos-workspace';
import ContextNotice,{readDisplayContext} from '@/components/pos/context-notice';
import CashPanel,{type CashOverview} from '@/components/pos/cash-panel';
import ReconcileCash from '@/components/pos/reconcile-cash';
import {commandRecoveryKey} from '@/lib/pos/command-recovery';
import {cashEntryId,includeCashEntry} from '@/lib/pos/cash-history';
import {postOwnerCash,recoverOwnerOperation,reconcileOwnerCash} from '../pesanan/operations-actions';
export const dynamic='force-dynamic';
export const metadata={title:'Mutasi Kas - Mas Jawa Laundry',robots:{index:false,follow:false}};
export default async function OwnerCash({searchParams}:{searchParams:Promise<{entry?:string}>}){
 const {supabase,user}=await requireOwner();
 const requested=(await searchParams).entry;
 const [cash,display,selected]=await Promise.all([supabase.rpc('laundry_pos_v3_cash'),supabase.rpc('laundry_pos_display_context'),cashEntryId(requested)?supabase.rpc('laundry_pos_cash_entry_detail',{p_entry_id:requested}):Promise.resolve(null)]);
 const overview:CashOverview|null=!cash.error&&cash.data?.automatic_cash===true?cash.data:null;
 const context=display.error?null:readDisplayContext(display.data);
 const selection=includeCashEntry(overview,requested,selected);
 return <PosWorkspace title="Mutasi Kas" category="OPERASIONAL" description="Kas otomatis dengan identitas petugas dan referensi nota."><ContextNotice context={context}/><Link href="/admin/laporan">Laporan</Link>
 {selection.notice&&<p role="status" className="binatu-inline-notice">{selection.notice}</p>}
 <CashPanel overview={selection.overview} role="owner" mayEdit canFinance={context?.finance_enabled===true} requestId={randomUUID()} action={postOwnerCash} recoveryKey={commandRecoveryKey('owner',user.id,'CASH_ENTRY')} recoverAction={recoverOwnerOperation.bind(null,'CASH_ENTRY',null)}/>
 {overview&&<ReconcileCash expected={overview.expected_cash_idr} requestId={randomUUID()} action={reconcileOwnerCash} pilotTestOnly={context?.pilot_test_only!==false}/>}</PosWorkspace>;
}
