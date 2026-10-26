"use server";

import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/supabase/owner";
import { normalizeWhatsapp, validateMemberName } from "@/lib/laundry/validation";

const validUUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function updateMemberContact(formData:FormData) {
  const {supabase}=await requireOwner();
  const memberId=String(formData.get("memberId")??"");
  const requestId=String(formData.get("requestId")??"");
  if(!validUUID.test(memberId)||!validUUID.test(requestId))redirect("/admin/members");

  const back="/admin/members/"+memberId+"/edit";
  let name:string,phone:string|null;
  try{
    name=validateMemberName(String(formData.get("name")??""));
    phone=normalizeWhatsapp(String(formData.get("whatsapp")??""));
  }catch{
    return {error:"Periksa nama dan nomor WhatsApp. Isian perubahan tetap tersedia di formulir ini."};
  }
  const consentAction=String(formData.get("consentAction")??"");
  const customerConfirmed=formData.get("customerConfirmed")==="on";
  const expectedRaw=String(formData.get("expectedRevision")??"");
  const expected=Number(expectedRaw);
  if(!["KEEP","GRANT","REVOKE"].includes(consentAction) ||
     !/^(0|[1-9][0-9]{0,14})$/.test(expectedRaw) || !Number.isSafeInteger(expected))redirect(back+"?error=invalid");

  if(consentAction==="GRANT" && (!phone || !customerConfirmed)) {
    return {error:"Masukkan nomor WhatsApp dan konfirmasi persetujuan pelanggan untuk mengaktifkan promo."};
  }
  const {data,error}=await supabase.rpc("laundry_update_member_contact",{
    p_member_id:memberId,
    p_name:name,
    p_whatsapp_e164:phone,
    p_consent_action:consentAction,
    p_customer_confirmed:customerConfirmed,
    p_expected_revision:expected,
    p_request_id:requestId
  });
  if(error || (data!=="UPDATED" && data!=="UNCHANGED")) {
    return {error:error?.message?.includes("member_modified_reload")
      ?"Data member sudah berubah dari perangkat lain. Salin isian perubahan sebelum memuat ulang dan memeriksa data terbaru."
      :"Perubahan belum berhasil disimpan. Periksa koneksi lalu coba lagi. Isian tetap tersedia di formulir ini."};
  }
  redirect(back+"?result="+(data==="UPDATED"?"saved":"unchanged"));
}
