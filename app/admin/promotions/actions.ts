"use server";

import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/supabase/owner";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function grantManualPromo(formData: FormData) {
  const { supabase } = await requireOwner();
  const memberId=String(formData.get("memberId") ?? "");
  const requestId=String(formData.get("requestId") ?? "");
  if (!uuid.test(memberId) || !uuid.test(requestId)) redirect("/admin/members");

  const title=String(formData.get("title") ?? "").trim();
  const terms=String(formData.get("terms") ?? "").trim();
  const expires=String(formData.get("expires") ?? "").trim();

  if (title.length<3 || title.length>120 || terms.length>2000 ||
      (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires))) {
    redirect("/admin/members/"+memberId+"?promoError=invalid&promoRequestId="+requestId);
  }

  let expiresAt: string|null=null;
  if(expires) {
    // End of the chosen calendar date in Indonesian Western Time (WIB).
    const date=new Date(expires+"T23:59:59+07:00");
    if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==
       new Date(date.getTime()+7*3600000).toISOString().slice(0,10)) {
      // Safeguard against malformed dates and timezone rollover.
      redirect("/admin/members/"+memberId+"?promoError=invalid&promoRequestId="+requestId);
    }
    expiresAt=date.toISOString();
    if(date.getTime()<=Date.now())redirect("/admin/members/"+memberId+"?promoError=invalid&promoRequestId="+requestId);
  }

  const { data,error }=await supabase.rpc("laundry_grant_manual_promotion",{
    p_member_id:memberId,p_title:title,p_terms:terms||null,
    p_expires_at:expiresAt,p_request_id:requestId
  });
  if(error||typeof data!=="string") {
    redirect("/admin/members/"+memberId+"?promoError=save&promoRequestId="+requestId);
  }
  redirect("/admin/members/"+memberId+"?promo=created");
}

export async function finishManualPromo(formData:FormData) {
  const {supabase}=await requireOwner();
  const memberId=String(formData.get("memberId")??"");
  const promoId=String(formData.get("promoId")??"");
  const action=String(formData.get("action")??"");
  const reason=String(formData.get("reason")??"").trim();
  if(!uuid.test(memberId)||!uuid.test(promoId))redirect("/admin/members");
  if(!["USE","CANCEL"].includes(action))redirect("/admin/members/"+memberId+"?promoError=invalid");
  if(action==="CANCEL"&&(reason.length<3||reason.length>500))
    redirect("/admin/members/"+memberId+"?promoError=reason");

  const {data,error}=await supabase.rpc("laundry_finish_manual_promotion",{
    p_member_id:memberId,p_promotion_id:promoId,p_action:action,p_reason:action==="CANCEL"?reason:null
  });
  if(error||data!==true)redirect("/admin/members/"+memberId+"?promoError=finish");
  redirect("/admin/members/"+memberId+"?promo="+(action==="USE"?"used":"cancelled"));
}
