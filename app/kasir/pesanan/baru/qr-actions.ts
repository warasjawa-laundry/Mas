"use server";
import { tokenDigest } from "@/lib/laundry/card";
import { extractLaundryToken } from "@/lib/laundry/scan";
import { cashierRpcAccess } from "@/lib/pos/g4-server";
export type CashierQrResult={memberNumber:string;displayName:string}|null;
/** QR is a bearer secret. Validate locally, hash before SQL; never log or persist. */
export async function resolveCashierMemberQr(raw:string):Promise<CashierQrResult>{
 if(typeof raw!=="string"||raw.length>500)return null;
 const token=extractLaundryToken(raw);
 if(!token)return null;
 const access=await cashierRpcAccess("member_lookup");
 if(!access)return null;
 const {data,error}=await access.client.rpc("laundry_pos_g7_resolve_card",{
  ...access.tokens,p_digest_hex:tokenDigest(token)
 });
 if(error||!Array.isArray(data)||data.length!==1)return null;
 const row=data[0] as Record<string,unknown>;
 const number=String(row.member_number??"");
 if(!/^[1-9][0-9]{0,11}$/.test(number)||typeof row.display_name!=="string"||
   row.display_name.length<2||row.display_name.length>120)return null;
 return {memberNumber:number,displayName:row.display_name};
}
import {normalizeMemberBarcode} from "@/lib/pos/member-code";
/** QR token or MJL barcode, resolved by separate read-only role-scoped RPCs. */
export async function resolveCashierMemberCode(raw:string):Promise<CashierQrResult>{
 if(typeof raw!=="string"||raw.length>500)return null;
 const number=normalizeMemberBarcode(raw);
 if(!number)return resolveCashierMemberQr(raw);
 const access=await cashierRpcAccess("member_lookup");if(!access)return null;
 const {data,error}=await access.client.rpc("laundry_pos_g4_member_number",{...access.tokens,p_member_number:number});
 if(error||!Array.isArray(data)||data.length!==1)return null;
 const row=data[0] as Record<string,unknown>;
 if(String(row.member_number)!==number||typeof row.display_name!=="string"||row.display_name.length<2||row.display_name.length>120)return null;
 return {memberNumber:number,displayName:row.display_name};
}
