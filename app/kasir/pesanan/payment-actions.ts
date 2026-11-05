"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cashierRpcAccess } from "@/lib/pos/g4-server";
import { parseG5Payment,parseG5Refund,parseG5Shift } from "@/lib/pos/g5-payment";
import type {CommandActionResult} from "@/lib/pos/command-recovery";

/** A failed network response is an UNKNOWN COMMIT, not permission to create a second UUID. */
export async function collectCashierPayment(form:FormData):Promise<CommandActionResult>{
 const access=await cashierRpcAccess('payment_collect');
 if(!access)redirect('/kasir');
 const payload=parseG5Payment(form);
 if(!payload)return {error:'Periksa nominal dan metode pembayaran. Isian tetap tersedia.'};
 const path=`/kasir/pesanan/${payload.orderId}`;
 const {data,error}=await access.client.rpc('laundry_pos_v3_finance',{
  ...access.tokens,p_operation:'PAYMENT',p_request_id:payload.requestId,p_order_id:payload.orderId,
  p_amount_idr:payload.amountIdr,p_method:payload.method,p_expected_version:payload.expectedVersion,
 });
 if(error||!data||typeof data!=='object'||typeof data.payment_id!=='string'){
  return {error:'Pembayaran belum terkonfirmasi atau transaksi dikunci. Periksa hasil sebelum mencoba lagi dengan ID dan isian yang sama. Jangan menerima pembayaran lagi.'};
 }
 revalidatePath(path);revalidatePath('/kasir/pesanan');
 return {error:'',confirmed:true,redirectTo:`${path}?saved=payment`};
}

export async function openCashierShift(form:FormData):Promise<CommandActionResult>{
 const access=await cashierRpcAccess('payment_collect');
 if(!access)redirect('/kasir');
 const payload=parseG5Shift(form);
 if(!payload)return {error:'Periksa nota sebelum membuka kas.'};
 const path=`/kasir/pesanan/${payload.orderId}`;
 const {data,error}=await access.client.rpc('laundry_pos_g5_open_shift',{
  ...access.tokens,p_request_id:payload.requestId,
 });
 if(error||!data||typeof data!=='object'||data.status!=='OPEN'){
  return {error:'Hasil pembukaan kas belum terkonfirmasi atau transaksi dikunci. Periksa kembali dengan ID yang sama.'};
 }
 revalidatePath(path);return {error:'',confirmed:true,redirectTo:`${path}?saved=shift`};
}

export async function refundCashierOrder(form:FormData):Promise<CommandActionResult>{
 const access=await cashierRpcAccess('refund_full');
 if(!access)redirect('/kasir');
 const payload=parseG5Refund(form);
 if(!payload)return {error:"Periksa nomor nota dan alasan refund."};
 const path=`/kasir/pesanan/${payload.orderId}`;
 const {data,error}=await access.client.rpc('laundry_pos_v3_finance',{
  ...access.tokens,p_operation:'FULL_REFUND',p_request_id:payload.requestId,p_order_id:payload.orderId,
  p_reason:payload.reason,p_expected_version:payload.expectedVersion,
 });
 if(error||!data||typeof data!=='object'||data.payment_status!=='REFUNDED'){
  return {error:"Hasil refund belum terkonfirmasi atau transaksi dikunci. Periksa jurnal. Ulangi dari formulir ini dengan alasan dan ID permintaan yang sama."};
 }
 revalidatePath(path);revalidatePath('/kasir/pesanan');return {error:'',confirmed:true,redirectTo:`${path}?saved=refund`};
}
