"use server";
import {cashierRpcAccess} from "@/lib/pos/g4-server";
export type NamedCashierMember={memberNumber:string;displayName:string};
/** PII-minimal prefix lookup: only public-facing name and member number. */
export async function findCashierMembers(raw:string):Promise<NamedCashierMember[]>{
 if(typeof raw!=="string"||raw.length>60)return [];
 const prefix=raw.trim();
 if(prefix.length<3||prefix.length>60||/[\u0000-\u001f\u007f]/.test(prefix))return [];
 const access=await cashierRpcAccess("member_lookup");
 if(!access)return [];
 const {data,error}=await access.client.rpc("laundry_pos_g7_member_name",{
  ...access.tokens,p_name_prefix:prefix,
 });
 if(error||!Array.isArray(data))return [];
 return data.slice(0,8).flatMap((row:unknown)=>{
  if(!row||typeof row!=="object")return [];
  const value=row as Record<string,unknown>;
  const memberNumber=String(value.member_number??"");
  const displayName=value.display_name;
  if(!/^[1-9][0-9]{0,11}$/.test(memberNumber)||typeof displayName!=="string"||
    displayName.length<2||displayName.length>120)return [];
  return [{memberNumber,displayName}];
 });
}