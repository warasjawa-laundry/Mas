"use server";

import {redirect} from "next/navigation";
import {requireOwner} from "@/lib/supabase/owner";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const whole=/^(0|[1-9][0-9]{0,9})$/;

export async function recordAmountVisit(formData:FormData){
  const {supabase}=await requireOwner();
  const memberId=String(formData.get("memberId")??"");
  const requestId=String(formData.get("requestId")??"");
  if(!uuid.test(memberId)||!uuid.test(requestId))redirect("/admin/members");
  const amountText=String(formData.get("amountIdr")??"").trim();
  const desc=String(formData.get("description")??"").trim();
  if(!whole.test(amountText)||Number(amountText)<1||Number(amountText)>1_000_000_000||
    desc.length<3||desc.length>240||/[\x00-\x1f\x7f]/.test(desc)){
    return {error:"Periksa nominal transaksi dan isi keterangan 3–240 karakter dalam satu baris, tanpa Enter atau tab."};
  }

  const {data,error}=await supabase.rpc("laundry_record_amount_visit",{
    p_member_id:memberId,
    p_amount_idr:Number(amountText),
    p_description:desc,
    p_request_id:requestId
  });
  if(error || !Array.isArray(data) || data.length!==1){
    return {error:error?.message?.includes("point_year_not_configured")
      ?"Aturan poin tahun ini belum tersedia. Hubungi pengelola. Isian transaksi tetap tersimpan di formulir ini."
      :"Transaksi belum berhasil disimpan. Periksa koneksi lalu coba lagi. Isian transaksi tetap tersimpan di formulir ini."};
  }
  redirect("/admin/members/"+memberId+"?amountRecorded=1&pointsEarned="+(Number(data[0].points_awarded)||0));
}

