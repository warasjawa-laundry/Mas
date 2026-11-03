"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {requireOwner} from "@/lib/supabase/owner";
import {parseG4OrderForm} from "@/lib/pos/g4-order";
import type {CommandActionResult} from "@/lib/pos/command-recovery";
export async function createOwnerOrder(form:FormData):Promise<CommandActionResult>{
 const {supabase}=await requireOwner();
 const payload=parseG4OrderForm(form);
 if(!payload)return {error:"Periksa pelanggan dan jumlah layanan. Isian tetap tersedia."};
 const {data,error}=await supabase.rpc("laundry_pos_owner_create_order_with_delivery",{
  p_request_id:payload.requestId,p_guest_name:payload.guestName,
  p_member_number:payload.memberNumber,p_items:payload.items,
  p_perfume:payload.perfume,p_notes:payload.notes,
  p_delivery_code:payload.deliveryCode,p_delivery_revision:payload.deliveryRevision,
 });
 if(error?.message?.includes("POS_DELIVERY_PRICE_CHANGED"))return {error:"Tarif antar-jemput berubah. Muat ulang halaman sebelum membuat nota."};
 if(error||!data||typeof data.order_id!=="string")return {error:
  "Nota belum terkonfirmasi atau transaksi masih dikunci. Periksa Pesanan lalu coba kembali dari formulir ini dengan ID permintaan yang sama. Jangan buat nota baru."};
 revalidatePath("/admin");
 return {error:'',confirmed:true,redirectTo:`/admin/pesanan/${encodeURIComponent(data.order_id)}`};
}
