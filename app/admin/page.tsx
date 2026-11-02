
import { requireOwner } from "@/lib/supabase/owner";
import { timeAdmin } from "@/lib/admin/timing";
import PosBoard from "@/components/pos/pos-board";
export default async function AdminHome({searchParams}:{searchParams:Promise<{tab?:string;view?:string}>}){
 const {supabase}=await requireOwner();
 const [membersR,addedR,voidR]=await timeAdmin("admin.home.counts",()=>Promise.all([
  supabase.from("laundry_members").select("id",{count:"exact",head:true}).eq("is_active",true),
  supabase.from("laundry_checklist_events").select("id",{count:"exact",head:true}).eq("event_type","ADD"),
  supabase.from("laundry_checklist_events").select("id",{count:"exact",head:true}).eq("event_type","VOID")
 ]));
 const memberCount=membersR.error?null:String(membersR.count??0);
 const visitCount=addedR.error||voidR.error?null:String(Math.max(0,(addedR.count??0)-(voidR.count??0)));
 const {data:orderResult,error:orderError}=await supabase.rpc("laundry_pos_owner_order_board");
 const dbReady=!orderError&&Array.isArray(orderResult);
 const {tab,view}=await searchParams;
 return <PosBoard role="owner" tab={tab} view={view}
  orders={dbReady?orderResult:[]} dbReady={dbReady} writeEnabled={false}
  memberCount={memberCount} transactionCount={visitCount}/>;
}
