"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cashierRpcAccess } from "@/lib/pos/g4-server";
import { parseG4OrderForm } from "@/lib/pos/g4-order";
import type {CommandActionResult} from "@/lib/pos/command-recovery";
import {parseG5Refund} from "@/lib/pos/g5-payment";

/** The payload deliberately has no amount/price/actor field from the browser. */
export async function createCashierOrder(form:FormData):Promise<CommandActionResult>{
  const access=await cashierRpcAccess("order_create");
  if(!access)redirect("/kasir");
  const payload=parseG4OrderForm(form);
  if(!payload)return {error:"Periksa identitas pelanggan dan jumlah layanan. Isian tetap tersedia."};
  if(!access.session.write_enabled)return {error:"Transaksi belum diaktifkan. Isian tetap tersedia."};
  const withContact=payload.contactPhone||payload.contactAddress;
  const {data,error}=await access.client.rpc(withContact?"laundry_pos_v31_create_order":"laundry_pos_g4_create_order_with_delivery",{
    ...access.tokens,p_request_id:payload.requestId,
    p_guest_name:payload.guestName,p_member_number:payload.memberNumber,
    p_items:payload.items,p_perfume:payload.perfume,p_notes:payload.notes,
    p_delivery_code:payload.deliveryCode,p_delivery_revision:payload.deliveryRevision,
    ...(withContact?{p_phone:payload.contactPhone??null,p_address:payload.contactAddress??''}:{}),
  });
  if(error?.message?.includes("POS_DELIVERY_PRICE_CHANGED"))return {error:"Tarif antar-jemput berubah. Muat ulang katalog sebelum membuat nota."};
  if(error || !data || typeof data!=="object" || typeof data.order_id!=="string"){
    // No success until the DB returns a committed receipt. Never auto-retry
    // under a different request ID; caller must reconcile unknown commits.
    return {error:"Nota belum terkonfirmasi. Periksa Pesanan; jika perlu, coba kembali dari formulir ini dengan ID permintaan yang sama. Jangan buat nota baru."};
  }
  revalidatePath("/kasir/pesanan");
  return {error:'',confirmed:true,redirectTo:`/kasir/pesanan/${encodeURIComponent(data.order_id)}`};
}

export async function advanceWorkStatus(form:FormData):Promise<CommandActionResult>{
  const access=await cashierRpcAccess("order_work");
  if(!access)redirect("/kasir");
  const orderId=form.get("orderId"),target=form.get("target"),requestId=form.get("requestId");
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if(typeof orderId!=="string" || !uuid.test(orderId) ||
     (target!=="PROCESSING"&&target!=="READY"&&target!=="COLLECTED") ||
     typeof requestId!=="string" || !uuid.test(requestId))return {error:'Periksa nota dan perubahan status.'};
  const {data,error}=await access.client.rpc("laundry_pos_g4_work_status",{
    ...access.tokens,p_request_id:requestId,p_order_id:orderId,p_new_status:target,
  });
  if(error||!data||data.work_status!==target)return {error:'Status belum terkonfirmasi atau transaksi dikunci. Periksa hasil dengan ID permintaan yang sama.'};
  revalidatePath(`/kasir/pesanan/${orderId}`);
  revalidatePath("/kasir/pesanan");
  return {error:'',confirmed:true,redirectTo:`/kasir/pesanan/${orderId}?saved=1`};
}

export async function cancelCashierOrder(form:FormData):Promise<CommandActionResult>{
 const access=await cashierRpcAccess('order_work');if(!access)redirect('/kasir');
 const payload=parseG5Refund(form);
 if(!payload)return {error:'Periksa nota, versi, dan alasan pembatalan (3–300 karakter).'};
 const {data,error}=await access.client.rpc('laundry_pos_g4_cancel_order',{
  ...access.tokens,p_request_id:payload.requestId,p_order_id:payload.orderId,
  p_reason:payload.reason,p_expected_version:payload.expectedVersion,
 });
 if(error?.message?.includes('POS_REFUND_REQUIRED'))return {error:'Masih ada dana diterima. Selesaikan refund penuh sebelum membatalkan nota.'};
 if(error||!data||data.lifecycle_status!=='CANCELLED')return {error:'Pembatalan belum terkonfirmasi atau transaksi dikunci. Periksa hasil dengan ID permintaan yang sama.'};
 revalidatePath('/kasir/pesanan');revalidatePath(`/kasir/pesanan/${payload.orderId}`);
 return {error:'',confirmed:true,redirectTo:`/kasir/pesanan/${payload.orderId}?saved=cancelled`};
}
