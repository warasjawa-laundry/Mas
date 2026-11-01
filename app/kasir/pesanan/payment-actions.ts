"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cashierRpcAccess } from "@/lib/pos/g4-server";
import { parseG5Payment,parseG5Refund,parseG5Shift } from "@/lib/pos/g5-payment";

/** A failed network response is an UNKNOWN COMMIT, not permission to create a second UUID. */
export async function collectCashierPayment(form:FormData){
 const access=await cashierRpcAccess('payment_collect');
 if(!access)redirect('/kasir');
 const payload=parseG5Payment(form);
 if(!payload)redirect('/kasir/pesanan?error=invalid');
 const path=`/kasir/pesanan/${payload.orderId}`;
 if(!access.session.write_enabled)redirect(`${path}?error=disabled`);
 const {data,error}=await access.client.rpc('laundry_pos_g5_payment',{
  ...access.tokens,p_request_id:payload.requestId,p_order_id:payload.orderId,
  p_amount_idr:payload.amountIdr,p_method:payload.method,p_expected_version:payload.expectedVersion,
 });
 if(error||!data||typeof data!=='object'||typeof data.payment_id!=='string'){
  // Preserve the same request-id + EXACT payload across an uncertain response.
  const query=new URLSearchParams({error:'payment-unconfirmed',retry:payload.requestId,
   amount:payload.amountIdr,method:payload.method,version:String(payload.expectedVersion)});
  redirect(`${path}?${query.toString()}`);
 }
 revalidatePath(path);revalidatePath('/kasir/pesanan');
 redirect(`${path}?saved=payment`);
}

export async function openCashierShift(form:FormData){
 const access=await cashierRpcAccess('payment_collect');
 if(!access)redirect('/kasir');
 const payload=parseG5Shift(form);
 if(!payload)redirect('/kasir/pesanan?error=invalid');
 const path=`/kasir/pesanan/${payload.orderId}`;
 if(!access.session.write_enabled)redirect(`${path}?error=disabled`);
 const {data,error}=await access.client.rpc('laundry_pos_g5_open_shift',{
  ...access.tokens,p_request_id:payload.requestId,
 });
 if(error||!data||typeof data!=='object'||data.status!=='OPEN'){
  redirect(`${path}?error=shift-unconfirmed`);
 }
 revalidatePath(path);redirect(`${path}?saved=shift`);
}

export async function refundCashierOrder(form:FormData){
 const access=await cashierRpcAccess('refund_full');
 if(!access)redirect('/kasir');
 const payload=parseG5Refund(form);
 if(!payload)redirect('/kasir/pesanan?error=invalid');
 const path=`/kasir/pesanan/${payload.orderId}`;
 if(!access.session.write_enabled)redirect(`${path}?error=disabled`);
 const {data,error}=await access.client.rpc('laundry_pos_g5_refund_full',{
  ...access.tokens,p_request_id:payload.requestId,p_order_id:payload.orderId,
  p_reason:payload.reason,p_expected_version:payload.expectedVersion,
 });
 if(error||!data||typeof data!=='object'||data.payment_status!=='REFUNDED'){
  const query=new URLSearchParams({error:'refund-unconfirmed',retryRefund:payload.requestId,
   version:String(payload.expectedVersion)});
  redirect(`${path}?${query.toString()}`);
 }
 revalidatePath(path);revalidatePath('/kasir/pesanan');redirect(`${path}?saved=refund`);
}