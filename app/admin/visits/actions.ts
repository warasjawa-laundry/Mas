"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { timeAdmin } from "@/lib/admin/timing";
import { requireOwner } from "@/lib/supabase/owner";
import { validCardToken } from "@/lib/laundry/card";
import { extractLaundryToken } from "@/lib/laundry/scan";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function resolveOwnerScannedCard(text: string): Promise<{id:string;number:string;name:string}|null> {
  const {supabase} = await requireOwner();
  if(typeof text !== "string" || text.length > 500) return null;
  const token = extractLaundryToken(text);
  if(!token || !validCardToken(token)) return null;
  const digest=createHash("sha256").update(token).digest("hex");
  const {data,error} = await timeAdmin("owner.scan.resolve",()=>supabase.rpc("laundry_resolve_owner_card",{p_digest_hex:digest}));
  if(error || !Array.isArray(data) || data.length !== 1) return null;
  const row=data[0];
  if(!uuidRe.test(row.member_id)) return null;
  return {id:row.member_id,number:"MJL-"+String(row.member_number).padStart(6,"0"),name:row.display_name};
}

export async function recordOwnerVisit(formData:FormData) {
  const {supabase}=await requireOwner();
  const memberId=String(formData.get("memberId") || "");
  const requestId=String(formData.get("requestId") || "");
  if(!uuidRe.test(memberId) || !uuidRe.test(requestId)) redirect("/admin/members");
  const {data,error}=await supabase.rpc("laundry_record_visit",{
    p_member_id:memberId,p_request_id:requestId
  });
  if(error || !Array.isArray(data) || data.length !== 1){
    redirect("/admin/members/"+memberId+"?error=save&requestId="+encodeURIComponent(requestId));
  }
  redirect("/admin/members/"+memberId+"?recorded=1");
}

export async function correctOwnerVisit(formData:FormData) {
  const {supabase}=await requireOwner();
  const memberId=String(formData.get("memberId") || "");
  const eventId=String(formData.get("eventId") || "");
  const requestId=String(formData.get("requestId") || "");
  const reason=String(formData.get("reason") || "").trim();
  if(!uuidRe.test(memberId) || !uuidRe.test(eventId) || !uuidRe.test(requestId))
    redirect("/admin/members");
  if(reason.length<3 || reason.length>500){
    redirect("/admin/members/"+memberId+"?error=reason");
  }
  const {data,error}=await supabase.rpc("laundry_void_visit",{
    p_event_id:eventId,p_reason:reason,p_request_id:requestId
  });
  const match=Array.isArray(data)&&data.length===1&&data[0].member_id===memberId;
  if(error||!match)redirect("/admin/members/"+memberId+"?error=void");
  redirect("/admin/members/"+memberId+"?corrected=1");
}
