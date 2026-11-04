"use server";
import {requireOwner} from "@/lib/supabase/owner";
import {normalizeMemberBarcode} from "@/lib/pos/member-code";
import {resolveOwnerScannedCard} from "@/app/admin/visits/actions";
export type OwnerPosMember={memberNumber:string;displayName:string};
/** Owner-authenticated, bounded name lookup: no contacts or balance returned. */
export async function findOwnerPosMembers(raw:string):Promise<OwnerPosMember[]>{
 const {supabase}=await requireOwner();
 if(typeof raw!=="string"||raw.length>60)return [];
 const term=raw.trim();
 if(term.length<3||term.length>60||/[\u0000-\u001f\u007f]/.test(term))return [];
 const escaped=term.replace(/[\\%_]/g,"\\$&");
 const {data,error}=await supabase.from("laundry_members").select("member_number,display_name")
  .eq("is_active",true).ilike("display_name",escaped+"%").order("display_name").limit(8);
 if(error||!Array.isArray(data))throw new Error("Pencarian member belum dapat dimuat.");
 return data.flatMap(x=>{
  const memberNumber=String(x.member_number??"");
  if(!/^[1-9][0-9]{0,11}$/.test(memberNumber)||typeof x.display_name!=="string")return [];
  return [{memberNumber,displayName:x.display_name}];
 });
}
/** Resolves QR by existing active-card digest, or printed member number. Read only. */
export async function resolveOwnerPosMemberCode(raw:string):Promise<OwnerPosMember|null>{
 const {supabase}=await requireOwner();
 if(typeof raw!=="string"||raw.length>500)return null;
 const number=normalizeMemberBarcode(raw);
 if(number){
  const {data,error}=await supabase.from("laundry_members").select("member_number,display_name")
   .eq("member_number",Number(number)).eq("is_active",true).maybeSingle();
  return error||!data||typeof data.display_name!=="string"?null:{memberNumber:String(data.member_number),displayName:data.display_name};
 }
 const qr=await resolveOwnerScannedCard(raw);
 if(!qr)return null;
 const digits=/^MJL-([0-9]{1,12})$/.exec(qr.number);
 if(!digits)return null;
 const memberNumber=String(Number(digits[1]));
 return /^[1-9][0-9]{0,11}$/.test(memberNumber)?{memberNumber,displayName:qr.name}:null;
}
