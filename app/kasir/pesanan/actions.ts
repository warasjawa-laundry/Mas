"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cashierRpcAccess } from "@/lib/pos/g4-server";
import { parseG4OrderForm } from "@/lib/pos/g4-order";

/** The payload deliberately has no amount/price/actor field from the browser. */
export async function createCashierOrder(form:FormData){
  const access=await cashierRpcAccess("order_create");
  if(!access)redirect("/kasir");
  const payload=parseG4OrderForm(form);
  if(!payload)redirect("/kasir/pesanan/baru?error=invalid");
  if(!access.session.write_enabled)redirect("/kasir/pesanan/baru?error=disabled");
  const {data,error}=await access.client.rpc("laundry_pos_g4_create_order",{
    ...access.tokens,p_request_id:payload.requestId,
    p_guest_name:payload.guestName,p_member_number:payload.memberNumber,
    p_items:payload.items,p_perfume:payload.perfume,p_notes:payload.notes,
  });
  if(error || !data || typeof data!=="object" || typeof data.order_id!=="string"){
    // No success until the DB returns a committed receipt. Never auto-retry
    // under a different request ID; caller must reconcile unknown commits.
    redirect("/kasir/pesanan?error=unconfirmed");
  }
  revalidatePath("/kasir/pesanan");
  redirect(`/kasir/pesanan/${encodeURIComponent(data.order_id)}`);
}

export async function advanceWorkStatus(form:FormData){
  const access=await cashierRpcAccess("order_work");
  if(!access)redirect("/kasir");
  const orderId=form.get("orderId"),target=form.get("target"),requestId=form.get("requestId");
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if(typeof orderId!=="string" || !uuid.test(orderId) ||
     (target!=="READY"&&target!=="COLLECTED") ||
     typeof requestId!=="string" || !uuid.test(requestId))redirect("/kasir/pesanan?error=invalid");
  if(!access.session.write_enabled)redirect(`/kasir/pesanan/${orderId}?error=disabled`);
  const {data,error}=await access.client.rpc("laundry_pos_g4_work_status",{
    ...access.tokens,p_request_id:requestId,p_order_id:orderId,p_new_status:target,
  });
  if(error||!data||data.work_status!==target)redirect(`/kasir/pesanan/${orderId}?error=unconfirmed`);
  revalidatePath(`/kasir/pesanan/${orderId}`);
  revalidatePath("/kasir/pesanan");
  redirect(`/kasir/pesanan/${orderId}?saved=1`);
}