"use server";
import {requireOwner} from "@/lib/supabase/owner";
import {cashierRpcAccess} from "@/lib/pos/g4-server";
import {commandUuid} from "@/lib/pos/command-recovery";
import {buildWhatsAppReceipt,validateReceiptData,normalizeReceiptPhone,type ReceiptData,type ReceiptKind} from "@/lib/pos/receipt";
import {readPointSimulation} from "@/lib/pos/point-simulation";
async function access(role:'owner'|'cashier',permission:'receipt_print'|'whatsapp_draft'='whatsapp_draft'){
 if(role==='owner'){const {supabase}=await requireOwner();return {client:supabase,tokens:{}};}
 return cashierRpcAccess(permission);
}
async function readReceiptDraft(role:'owner'|'cashier',orderId:string,kind:ReceiptKind,print=false):Promise<{error:string;data?:ReceiptData;text?:string}>{
 if(!commandUuid.test(orderId)||!['NEW','READY','COLLECTED'].includes(kind))return {error:'Nota atau jenis pesan tidak valid.'};
 const auth=await access(role,print?'receipt_print':'whatsapp_draft');if(!auth)return {error:print?'Masuk kembali dengan identitas dan izin mencetak nota.':'Masuk kembali dengan identitas dan izin WhatsApp yang sesuai.'};
 const {data,error}=await auth.client.rpc(print?'laundry_pos_v31_print_receipt':'laundry_pos_v31_whatsapp_receipt',{...auth.tokens,p_order_id:orderId,...(print?{}:{p_kind:kind})});
 if(error||!data||typeof data.is_test_order!=='boolean')return {error:'Draf terbaru belum dapat dibaca. Periksa koneksi dan status nota.'};
 if(data.is_test_order){
  const simulation=readPointSimulation(data.point_simulation);
  if(!simulation)return {error:'Simulasi poin belum tersedia. Baca ulang draf setelah koneksi tersedia.'};
  data.point_simulation=simulation;
 }
 try{validateReceiptData(data,{requireSnapshot:true});return print?{error:'',data}:{error:'',data,text:buildWhatsAppReceipt(data)}}catch{return {error:'Data pembayaran atau status nota belum lengkap. Draf tidak dibuat.'};}
}
export async function prepareOrderReceipt(role:'owner'|'cashier',orderId:string,kind:ReceiptKind){
 return readReceiptDraft(role,orderId,kind);
}
export async function preparePrintReceipt(role:'owner'|'cashier',orderId:string){
 return readReceiptDraft(role,orderId,'NEW',true);
}
export async function verifyOrderContact(role:'owner'|'cashier',orderId:string,form:FormData){
 const requestId=form.get('requestId'),raw=String(form.get('phone')??''),address=String(form.get('address')??'').trim();
 const phone=raw?normalizeReceiptPhone(raw):null;
 if(!commandUuid.test(orderId)||typeof requestId!=='string'||!commandUuid.test(requestId)||(raw&&!phone)||address.length>240||/[\x00-\x1f\x7f]/.test(address)||form.get('confirmed')!=='yes')return {error:'Periksa nomor dan alamat bersama pelanggan, lalu centang konfirmasi.'};
 const auth=await access(role);if(!auth)return {error:'Sesi atau izin WhatsApp tidak tersedia.'};
 const {error}=await auth.client.rpc('laundry_pos_verify_order_contact',{...auth.tokens,p_order_id:orderId,p_request_id:requestId,p_phone:phone,p_address:address,p_confirmed:true});
 return error?{error:'Kontak belum terkonfirmasi. Coba kembali dengan isian yang sama.'}:{error:'',confirmed:true};
}
