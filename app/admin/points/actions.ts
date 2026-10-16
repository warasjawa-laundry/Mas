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
    redirect("/admin/members/"+memberId+"?error=amount&amountRequestId="+requestId);
  }

  const {data,error}=await supabase.rpc("laundry_record_amount_visit",{
    p_member_id:memberId,
    p_amount_idr:Number(amountText),
    p_description:desc,
    p_request_id:requestId
  });
  if(error || !Array.isArray(data) || data.length!==1){
    const suffix=error?.message?.includes("point_year_not_configured")?"rules":"save";
    redirect("/admin/members/"+memberId+"?error="+suffix+"&amountRequestId="+requestId);
  }
  redirect("/admin/members/"+memberId+"?amountRecorded=1&pointsEarned="+(Number(data[0].points_awarded)||0));
}

export async function savePointRules(formData:FormData){
  const {supabase}=await requireOwner();
  const year=Number(String(formData.get("year")??""));
  const revision=Number(String(formData.get("revision")??""));
  if(![2026,2027].includes(year) || !Number.isSafeInteger(revision) || revision<1)
    redirect("/admin/points/rules");

  const tiers:{minimum:number,points:number}[]=[];
  let prior=-1;
  for(let i=0;i<5;i++){
    const minimumText=String(formData.get("minimum"+i)??"");
    const pointsText=String(formData.get("points"+i)??"");
    if(!whole.test(minimumText)||!whole.test(pointsText)){
      redirect("/admin/points/rules?year="+year+"&error=invalid");
    }
    const minimum=Number(minimumText),points=Number(pointsText);
    if(!Number.isSafeInteger(minimum)||minimum<=prior||minimum>1_000_000_000||
       !Number.isSafeInteger(points)||points>10_000){
      redirect("/admin/points/rules?year="+year+"&error=invalid");
    }
    tiers.push({minimum,points});
    prior=minimum;
  }
  const {data,error}=await supabase.rpc("laundry_set_point_rules",{
    p_year:year,p_tiers:tiers,p_expected_revision:revision
  });
  if(error || !Number.isSafeInteger(data)){
    const code=error?.message?.includes("rules_modified_reload")?"conflict":"save";
    redirect("/admin/points/rules?year="+year+"&error="+code);
  }
  redirect("/admin/points/rules?year="+year+"&saved=1");
}
