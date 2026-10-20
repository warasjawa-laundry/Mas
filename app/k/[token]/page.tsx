import type {Metadata} from "next";
import "./progress.css";
import {createHash} from "node:crypto";
import {notFound} from "next/navigation";
import {createClient} from "@supabase/supabase-js";
import {validCardToken,memberNumber} from "@/lib/laundry/card";
import {currentProgramYear} from "@/lib/laundry/program-years";
import {assertQaPreviewIsolation} from "@/lib/supabase/qa-preview-isolation";
import {memberHistoryPage,memberHistoryYear,memberHistoryHref,type PublicHistory} from "@/lib/laundry/public-history";
import MemberProgressView from "@/components/member-progress-view";
type Props={params:Promise<{token:string}>;searchParams:Promise<{year?:string;page?:string}>};
export const metadata:Metadata={title:"Catatan Kartu Member",robots:{index:false,follow:false,nocache:true},referrer:"no-referrer"};
export const dynamic="force-dynamic";
export default async function MemberProgress({params,searchParams}:Props){
 assertQaPreviewIsolation();
 const {token}=await params;const input=await searchParams;
 if(!validCardToken(token))notFound();
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw new Error("Card portal not configured");
 const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const digest=createHash("sha256").update(token).digest("hex");
 const currentYear=currentProgramYear();
 const year=memberHistoryYear(input.year,currentYear),page=memberHistoryPage(input.page);
 const [progressR,balancesR,historyR,nameR]=await Promise.all([
  supabase.rpc("laundry_public_card_progress",{p_digest_hex:digest}),
  supabase.rpc("laundry_public_point_balances",{p_digest_hex:digest}),
  supabase.rpc("laundry_public_transaction_history",{p_digest_hex:digest,p_year:year,p_page:page}),
  supabase.rpc("laundry_public_member_name",{p_digest_hex:digest})
 ]);
 const item=Array.isArray(progressR.data)?progressR.data[0]:null;
 if(progressR.error)throw new Error("Unable to load member card");
 if(!item)notFound();
 const balances=Array.isArray(balancesR.data)?balancesR.data:[];
 const selected=balances.find((r:{program_year:number})=>r.program_year===year);
 const years=[...new Set<number>([currentYear,year,...balances.map((r:{program_year:number})=>r.program_year)])].sort((a,b)=>a===b?0:a===currentYear?-1:b===currentYear?1:b-a);
 const history=historyR.data as PublicHistory|null;
 const historyFailed=!!historyR.error||!history||!Array.isArray(history.transactions);
 const base="/k/"+token;
 return <MemberProgressView name={typeof nameR.data==="string"&&!nameR.error?nameR.data:null} number={memberNumber(item.member_number)} total={Number(item.visit_count)||0}
  year={year} points={selected?Number(selected.points_total)||0:null} balancesFailed={!!balancesR.error}
  years={years.map(y=>({year:y,href:memberHistoryHref(base,y,1)}))}
  transactions={historyFailed?[]:history!.transactions} historyFailed={historyFailed} page={page}
  previousHref={page>1?memberHistoryHref(base,year,page-1):undefined}
  nextHref={!historyFailed&&history!.has_older&&page<10000?memberHistoryHref(base,year,page+1):undefined}
  promos={Array.isArray(item.promos)?item.promos:[]} />;
}
