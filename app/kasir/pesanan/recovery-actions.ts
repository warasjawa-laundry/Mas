"use server";
import {cashierRpcAccess} from "@/lib/pos/g4-server";
import {commandUuid,type CommandActionResult,type RecoverableOperation} from "@/lib/pos/command-recovery";

export async function recoverCashierCommand(operation:RecoverableOperation,orderId:string|null,requestId:string):Promise<CommandActionResult>{
 if(!commandUuid.test(requestId)||!['CREATE_ORDER','PAYMENT','FULL_REFUND','CASH_ENTRY','CLOSE_SHIFT','OPEN_SHIFT','SET_WORK','CANCEL'].includes(operation)||
  (orderId!==null&&!commandUuid.test(orderId)))return {error:"Penanda transaksi tidak valid. Hubungi penanggung jawab untuk rekonsiliasi."};
 const permission={CREATE_ORDER:'order_create',PAYMENT:'payment_collect',FULL_REFUND:'refund_full',CASH_ENTRY:'cash_entry',CLOSE_SHIFT:'cash_entry',OPEN_SHIFT:'payment_collect',SET_WORK:'order_work',CANCEL:'order_work'} as const;
 const access=await cashierRpcAccess(permission[operation]);
 if(!access)return {error:"Masuk kembali sebagai kasir yang sama lalu periksa transaksi ini. Penanda belum dihapus."};
 const {data,error}=await access.client.rpc('laundry_pos_g4_command_result',{...access.tokens,p_request_id:requestId});
 if(error||!data||typeof data!=='object')return {error:"Hasil belum dapat diperiksa. Penanda tetap disimpan; jangan membuat transaksi baru."};
 if(data.found!==true)return {error:"Hasil belum ditemukan. Transaksi mungkin masih berjalan. Periksa lagi atau susun ulang isian persis dengan ID yang sama."};
 if(data.operation!==operation||!data.result||typeof data.result!=='object')return {error:"Jenis transaksi tidak cocok. Penanda tetap disimpan; minta rekonsiliasi."};
 const result=data.result;
 if(operation==='CREATE_ORDER'){
  if(typeof result.order_id!=='string'||!commandUuid.test(result.order_id))return {error:"Hasil nota belum valid. Penanda tetap disimpan."};
  return {error:'',confirmed:true,redirectTo:`/kasir/pesanan/${result.order_id}`};
 }
 if(['PAYMENT','FULL_REFUND','SET_WORK','CANCEL'].includes(operation)&&result.order_id!==orderId)return {error:"Hasil transaksi tidak cocok dengan nota ini. Penanda tetap disimpan."};
 if((operation==='PAYMENT'&&typeof result.payment_id!=='string')||
  (operation==='FULL_REFUND'&&result.payment_status!=='REFUNDED')||
  (operation==='OPEN_SHIFT'&&result.status!=='OPEN')||
  (operation==='CASH_ENTRY'&&result.status!=='POSTED')||
  (operation==='CLOSE_SHIFT'&&result.status!=='CLOSED')||
  (operation==='SET_WORK'&&!['PROCESSING','READY','COLLECTED'].includes(result.work_status))||
  (operation==='CANCEL'&&result.lifecycle_status!=='CANCELLED'))return {error:"Bukti transaksi belum lengkap. Penanda tetap disimpan."};
 const destination=orderId?`/kasir/pesanan/${orderId}`:'/kasir/kas';
 const saved=operation==='PAYMENT'?'payment':operation==='FULL_REFUND'?'refund':operation==='CASH_ENTRY'?'entry':operation==='CLOSE_SHIFT'?'closed':operation==='CANCEL'?'cancelled':operation==='SET_WORK'?'1':'shift';
 return {error:'',confirmed:true,redirectTo:`${destination}?saved=${saved}`};
}
