"use server";
import {revalidatePath} from "next/cache";
import {requireOwner} from "@/lib/supabase/owner";
import {parseG5Payment,parseG5Refund,parseG5Shift} from "@/lib/pos/g5-payment";
import {parseCashEntry,parseCloseShift} from "@/lib/pos/g6-cash";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const unknown="Hasil belum terkonfirmasi atau transaksi dikunci. Periksa nota dan jurnal; ulangi hanya dari formulir ini dengan isian serta ID permintaan yang sama.";
import {commandUuid,type CommandActionResult,type RecoverableOperation} from "@/lib/pos/command-recovery";
type Result=CommandActionResult;
async function post(rpc:string,args:Record<string,unknown>,path:string,check:(data:Record<string,unknown>)=>boolean):Promise<Result>{
 const {supabase}=await requireOwner();
 const {data,error}=await supabase.rpc(rpc,args);
 if(error||!data||typeof data!=="object"||!check(data))return {error:unknown};
 revalidatePath(path);revalidatePath("/admin");revalidatePath("/admin/kas");revalidatePath("/admin/laporan");
 return {error:"",confirmed:true,redirectTo:`${path}?saved=1`};
}
export async function collectOwnerPayment(form:FormData):Promise<Result>{
 const p=parseG5Payment(form);if(!p)return {error:"Periksa nominal, metode, dan versi nota."};
 return post("laundry_pos_owner_payment",{p_request_id:p.requestId,p_order_id:p.orderId,
  p_amount_idr:p.amountIdr,p_method:p.method,p_expected_version:p.expectedVersion},
  `/admin/pesanan/${p.orderId}`,d=>typeof d.payment_id==="string");
}
export async function refundOwnerOrder(form:FormData):Promise<Result>{
 const p=parseG5Refund(form);if(!p)return {error:"Periksa alasan refund dan versi nota."};
 return post("laundry_pos_owner_refund_full",{p_request_id:p.requestId,p_order_id:p.orderId,
  p_reason:p.reason,p_expected_version:p.expectedVersion},`/admin/pesanan/${p.orderId}`,d=>d.payment_status==="REFUNDED");
}
export async function openOwnerShift(form:FormData):Promise<Result>{
 const p=parseG5Shift(form);if(!p)return {error:"Permintaan buka kas tidak valid."};
 return post("laundry_pos_owner_open_shift",{p_request_id:p.requestId},`/admin/pesanan/${p.orderId}`,d=>d.status==="OPEN");
}
export async function advanceOwnerWork(form:FormData):Promise<Result>{
 const orderId=form.get("orderId"),requestId=form.get("requestId"),target=form.get("target");
 if(typeof orderId!=="string"||!uuid.test(orderId)||typeof requestId!=="string"||!uuid.test(requestId)
  ||(target!=="PROCESSING"&&target!=="READY"&&target!=="COLLECTED"))return {error:"Perubahan status tidak valid."};
 return post("laundry_pos_owner_work_status",{p_request_id:requestId,p_order_id:orderId,p_new_status:target},
  `/admin/pesanan/${orderId}`,d=>d.work_status===target);
}
export async function cancelOwnerOrder(form:FormData):Promise<Result>{
 const p=parseG5Refund(form);if(!p)return {error:"Alasan pembatalan wajib diisi (3–300 karakter)."};
 const {supabase}=await requireOwner();
 const {data,error}=await supabase.rpc("laundry_pos_owner_cancel_order",{p_request_id:p.requestId,
  p_order_id:p.orderId,p_reason:p.reason,p_expected_version:p.expectedVersion});
 if(error?.message?.includes("POS_REFUND_REQUIRED"))return {error:"Masih ada dana diterima. Selesaikan refund penuh sebelum membatalkan nota."};
 if(error||!data||data.lifecycle_status!=="CANCELLED")return {error:unknown};
 revalidatePath("/admin");revalidatePath(`/admin/pesanan/${p.orderId}`);return {error:"",confirmed:true,redirectTo:"/admin?saved=cancelled"};
}
export async function postOwnerCash(form:FormData):Promise<Result>{
 const p=parseCashEntry(form);if(!p)return {error:"Periksa nominal dan alasan mutasi."};
 return post("laundry_pos_owner_cash_entry",{p_request_id:p.requestId,p_direction:p.direction,
  p_amount_idr:p.amountIdr,p_reason:p.reason},"/admin/kas",d=>d.status==="POSTED");
}
export async function closeOwnerRegister(form:FormData):Promise<Result>{
 const p=parseCloseShift(form);if(!p)return {error:"Periksa uang fisik dan alasan selisih."};
 return post("laundry_pos_owner_close_shift",{p_request_id:p.requestId,p_counted_idr:p.countedIdr,
  p_reason:p.reason},"/admin/kas",d=>d.status==="CLOSED");
}
export async function openOwnerCashRegister(form:FormData):Promise<Result>{
 const requestId=form.get("requestId");
 if(typeof requestId!=="string"||!uuid.test(requestId))return {error:"Permintaan buka kas tidak valid."};
 return post("laundry_pos_owner_open_shift",{p_request_id:requestId},"/admin/kas",d=>d.status==="OPEN");
}

export async function recoverOwnerOperation(operation:RecoverableOperation,orderId:string|null,requestId:string):Promise<Result>{
 const allowed=["PAYMENT","FULL_REFUND","CASH_ENTRY","CLOSE_SHIFT","OPEN_SHIFT","SET_WORK","CANCEL"];
 if(!allowed.includes(operation)||!commandUuid.test(requestId)||
  (orderId!==null&&!commandUuid.test(orderId))||(["PAYMENT","FULL_REFUND","SET_WORK","CANCEL"].includes(operation)&&!orderId))
 return {error:"Permintaan pemeriksaan tidak valid."};
 const {supabase}=await requireOwner();
 const {data,error}=await supabase.rpc("laundry_pos_owner_command_result",{p_request_id:requestId});
 if(error||!data||data.found!==true||data.operation!==operation||!data.result||typeof data.result!=="object")
 return {error:"Hasil belum ditemukan atau belum dapat diperiksa. Penanda disimpan; periksa jurnal dan hubungi penanggung jawab sebelum membuat transaksi baru."};
 const result=data.result;
 if(orderId&&["PAYMENT","FULL_REFUND","SET_WORK","CANCEL"].includes(operation)&&result.order_id!==orderId)
 return {error:"Hasil permintaan tidak sesuai nota. Hubungi penanggung jawab untuk rekonsiliasi."};
 if((operation==="PAYMENT"&&typeof result.payment_id!=="string")||
  (operation==="FULL_REFUND"&&result.payment_status!=="REFUNDED")||
  (operation==="OPEN_SHIFT"&&result.status!=="OPEN")||
  (operation==="CASH_ENTRY"&&result.status!=="POSTED")||
  (operation==="CLOSE_SHIFT"&&result.status!=="CLOSED")||
  (operation==="SET_WORK"&&!["PROCESSING","READY","COLLECTED"].includes(result.work_status))||
  (operation==="CANCEL"&&result.lifecycle_status!=="CANCELLED"))return {error:"Bukti transaksi belum lengkap. Penanda tetap disimpan."};
 const path=orderId?`/admin/pesanan/${orderId}`:"/admin/kas";
 revalidatePath(path);revalidatePath("/admin");revalidatePath("/admin/kas");
 return {error:"",confirmed:true,redirectTo:operation==="CANCEL"?"/admin?saved=cancelled":`${path}?saved=1`};
}
