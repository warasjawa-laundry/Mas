"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cashierRpcAccess } from "@/lib/pos/g4-server";
import { parseStructuredCashEntry, parseCloseShift } from "@/lib/pos/g6-cash";
import type {CommandActionResult} from "@/lib/pos/command-recovery";
const page="/kasir/kas";
export async function postNonSaleCash(form:FormData):Promise<CommandActionResult>{
 const access=await cashierRpcAccess("cash_entry");if(!access)redirect("/kasir");
 const item=parseStructuredCashEntry(form);if(!item)return {error:"Periksa nominal, kategori, arah kas, dan catatan. Pengeluaran memakai Kas keluar. Isian tetap tersedia."};
 if(item.categoryCode==='CAPITAL'||item.categoryCode==='CASH_TRANSFER')return {error:'Modal dan perpindahan uang laci hanya dapat dicatat Owner.'};
 const {data,error}=await access.client.rpc("laundry_pos_v31_cash_entry",{
  ...access.tokens,p_request_id:item.requestId,p_direction:item.direction,
  p_amount_idr:item.amountIdr,p_category_code:item.categoryCode,p_note:item.note
 });
 if(error||!data||data.status!=="POSTED"){
  // Do not auto-retry unknown write with a different UUID.
  return {error:"Hasil mutasi belum diketahui atau transaksi dikunci. Periksa jurnal; ulangi hanya dari formulir ini dengan ID permintaan yang sama."};
 }
 revalidatePath(page);return {error:'',confirmed:true,redirectTo:`${page}?saved=entry`};
}
export async function closeCashRegister(form:FormData):Promise<CommandActionResult>{
 const access=await cashierRpcAccess("cash_entry");if(!access)redirect("/kasir");
 const payload=parseCloseShift(form);if(!payload)return {error:"Periksa uang fisik dan alasan selisih. Isian tetap tersedia."};
 const {data,error}=await access.client.rpc("laundry_pos_g6_close_shift",{
   ...access.tokens,p_request_id:payload.requestId,p_counted_idr:payload.countedIdr,p_reason:payload.reason
 });
 if(error||!data||data.status!=="CLOSED")return {error:"Hasil tutup shift belum diketahui atau transaksi dikunci. Periksa jurnal dan ulangi dari formulir ini dengan ID permintaan yang sama."};
 revalidatePath(page);return {error:'',confirmed:true,redirectTo:`${page}?saved=closed`};
}
