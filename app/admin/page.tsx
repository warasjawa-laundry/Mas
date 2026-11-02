
import { requireOwner } from "@/lib/supabase/owner";
import { timeAdmin } from "@/lib/admin/timing";
import PosBoard from "@/components/pos/pos-board";
export default async function AdminHome({searchParams}:{searchParams:Promise<{tab?:string}>}){
 const {supabase}=await requireOwner();
 const [membersR,addedR,voidR]=await timeAdmin("admin.home.counts",()=>Promise.all([
  supabase.from("laundry_members").select("id",{count:"exact",head:true}).eq("is_active",true),
  supabase.from("laundry_checklist_events").select("id",{count:"exact",head:true}).eq("event_type","ADD"),
  supabase.from("laundry_checklist_events").select("id",{count:"exact",head:true}).eq("event_type","VOID")
 ]));
 const memberCount=membersR.error?null:String(membersR.count??0);
 const visitCount=addedR.error||voidR.error?null:String(Math.max(0,(addedR.count??0)-(voidR.count??0)));
 const {tab}=await searchParams;
 return <PosBoard role="owner" tab={tab} memberCount={memberCount} transactionCount={visitCount}/>;
}
