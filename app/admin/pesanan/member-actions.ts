"use server";
import {requireOwner} from "@/lib/supabase/owner";
import {resolveOwnerScannedBarcode,resolveOwnerScannedCard} from "@/app/admin/visits/actions";
import {normalizeMemberBarcode} from "@/lib/pos/member-code";
export type OwnerPosMember={memberNumber:string;displayName:string};
export async function findOwnerPosMembers(raw:string):Promise<OwnerPosMember[]>{
 const {supabase}=await requireOwner();
 if(typeof raw!=="string"||raw.length>60)return [];
 const prefix=raw.trim();
 if(prefix.length<3||prefix.length>60||/[\u0000-\u001f\u007f]/.test(prefix))return [];
 const {data,error}=await supabase.from("laundry_members")
  .select("member_number,display_name").eq("is_active",true)
  .ilike("display_name",prefix.replace(/[\\%_]/g,"")+"%")
  .order("member_number").limit(8);
 if(error||!Array.isArray(data))return [];
 return data.flatMap(x=>{
  const memberNumber=String(x.member_number??"");
  return /^[1-9][0-9]{0,11}$/.test(memberNumber)&&typeof x.display_name==="string"&&x.display_name.length<=120?
   [{memberNumber,displayName:x.display_name}]:[];
 });
}
export async function resolveOwnerPosMemberCode(raw:string):Promise<OwnerPosMember|null>{
 await requireOwner();
 if(typeof raw!=="string"||raw.length>500)return null;
 const matched=normalizeMemberBarcode(raw);
 const member=matched?await resolveOwnerScannedBarcode(raw):await resolveOwnerScannedCard(raw);
 if(!member)return null;
 const number=normalizeMemberBarcode(member.number);
 return number?{memberNumber:number,displayName:member.name}:null;
}
