"use server";
import {requireOwner} from "@/lib/supabase/owner";
import {commandUuid,type CommandActionResult} from "@/lib/pos/command-recovery";

export async function recoverOwnerOrder(requestId:string):Promise<CommandActionResult>{
 const {supabase}=await requireOwner();
 if(!commandUuid.test(requestId))return {error:"Penanda nota tidak valid. Hubungi penanggung jawab untuk rekonsiliasi."};
 const {data,error}=await supabase.rpc('laundry_pos_owner_command_result',{p_request_id:requestId});
 if(error||!data||typeof data!=='object')return {error:"Hasil belum dapat diperiksa. Penanda tetap disimpan; jangan membuat nota baru."};
 if(data.found!==true)return {error:"Nota belum ditemukan. Transaksi mungkin masih berjalan. Periksa lagi atau susun ulang isian persis dengan ID yang sama."};
 if(data.operation!=='CREATE_ORDER'||typeof data.result?.order_id!=='string'||!commandUuid.test(data.result.order_id))return {error:"Hasil belum cocok dengan pembuatan nota. Penanda tetap disimpan."};
 return {error:'',confirmed:true,redirectTo:`/admin/pesanan/${data.result.order_id}`};
}
