"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cashierRpcAccess } from "@/lib/pos/g4-server";
import { parseCashEntry, parseCloseShift } from "@/lib/pos/g6-cash";
const page="/kasir/kas";
export async function postNonSaleCash(form:FormData){
 const access=await cashierRpcAccess("cash_entry");if(!access)redirect("/kasir");
 const item=parseCashEntry(form);if(!item)redirect(`${page}?error=invalid`);
 if(!access.session.write_enabled)redirect(`${page}?error=disabled`);
 const {data,error}=await access.client.rpc("laundry_pos_g6_cash_entry",{
  ...access.tokens,p_request_id:item.requestId,p_direction:item.direction,
  p_amount_idr:item.amountIdr,p_reason:item.reason
 });
 if(error||!data||data.status!=="POSTED"){
  // Do not auto-retry unknown write with a different UUID.
  redirect(`${page}?error=unconfirmed`);
 }
 revalidatePath(page);redirect(`${page}?saved=entry`);
}
export async function closeCashRegister(form:FormData){
 const access=await cashierRpcAccess("cash_entry");if(!access)redirect("/kasir");
 const payload=parseCloseShift(form);if(!payload)redirect(`${page}?error=invalid`);
 if(!access.session.write_enabled)redirect(`${page}?error=disabled`);
 const {data,error}=await access.client.rpc("laundry_pos_g6_close_shift",{
   ...access.tokens,p_request_id:payload.requestId,p_counted_idr:payload.countedIdr,p_reason:payload.reason
 });
 if(error||!data||data.status!=="CLOSED")redirect(`${page}?error=unconfirmed`);
 revalidatePath(page);redirect(`${page}?saved=closed`);
}