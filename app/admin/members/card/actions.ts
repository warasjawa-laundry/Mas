"use server";

import {redirect} from "next/navigation";
import {requireOwner} from "@/lib/supabase/owner";
import {
 cardIssuanceReady,newCardToken,tokenDigest,encryptCardToken
} from "@/lib/laundry/card";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function issueImportedMemberCard(formData:FormData) {
 const {supabase}=await requireOwner();
 const memberId=String(formData.get("memberId")??"");
 if(!uuid.test(memberId))redirect("/admin/members");
 const back="/admin/members/"+memberId+"/card";
 if(!cardIssuanceReady())redirect(back+"?issueError=unavailable");
 const token=newCardToken();
 const {data,error}=await supabase.rpc("laundry_issue_imported_member_card",{
  p_member_id:memberId,p_token_digest_hex:tokenDigest(token),
  p_token_ciphertext_hex:encryptCardToken(token)
 });
 if(error||typeof data!=="string"||!uuid.test(data))redirect(back+"?issueError=save");
 redirect(back);
}

export async function reissueOwnerCard(formData:FormData) {
 const {supabase}=await requireOwner();
 const memberId=String(formData.get("memberId")??"");
 const requestId=String(formData.get("requestId")??"");
 if(!uuid.test(memberId)||!uuid.test(requestId))redirect("/admin/members");
 const back="/admin/members/"+memberId+"/card";
 // Rollout explicitly disabled in every environment until the QA migration
 // is applied and tested. No existing card is touched while disabled.
 if(process.env.OWNER_CARD_REISSUE_ENABLED!=="1"||!cardIssuanceReady()){
   redirect(back+"?reissueError=unavailable");
 }
 const reason=String(formData.get("reason")??"").trim();
 const confirmed=formData.get("confirmInvalidation")==="yes";
 if(!confirmed||reason.length<3||reason.length>200||/[\x00-\x1f\x7f]/.test(reason)){
   redirect(back+"?reissueError=invalid&reissueRequestId="+requestId);
 }
 const token=newCardToken();
 const {data,error}=await supabase.rpc("laundry_reissue_card",{
   p_member_id:memberId,p_reason:reason,
   p_token_digest_hex:tokenDigest(token),
   p_token_ciphertext_hex:encryptCardToken(token),
   p_request_id:requestId
 });
 if(error||typeof data!=="string"||!uuid.test(data)){
   // Retry with the *same* request UUID; database resolves the original
   // card on network ambiguity without duplicating issuance.
   redirect(back+"?reissueError=save&reissueRequestId="+requestId);
 }
 redirect(back+"?reissued=1");
}
