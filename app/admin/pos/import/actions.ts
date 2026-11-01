"use server";
import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { getVerifiedOwner } from "@/lib/supabase/owner";
import { parseBinatuReport } from "@/lib/pos/g6-import";
const ROOT="/admin/pos/import";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function importBinatuPreview(form:FormData){
 const owner=await getVerifiedOwner();if(!owner)redirect("/admin/login");
 const file=form.get("report");
 if(!(file instanceof File)||file.size<10||file.size>1_500_000||
  !/\.(csv|xlsx)$/i.test(file.name))redirect(`${ROOT}?error=file`);
 let rows;
 let bytes:Buffer;
 try{
  bytes=Buffer.from(await file.arrayBuffer());
  rows=parseBinatuReport(file.name,bytes);
 }catch{redirect(`${ROOT}?error=template`);}
 const hash=createHash('sha256').update(bytes).digest('hex');
 const {data,error}=await owner.supabase.rpc("laundry_pos_g6b_import_preview",{
  p_source:'BINATU',p_sha_hex:hash,p_rows:rows,
 });
 if(error||!data||typeof data.batch_id!=="string"||!UUID.test(data.batch_id))
  redirect(`${ROOT}?error=save`);
 redirect(`${ROOT}?batch=${encodeURIComponent(data.batch_id)}`);
}
export async function reviewBinatuRow(form:FormData){
 const owner=await getVerifiedOwner();if(!owner)redirect('/admin/login');
 const batch=form.get('batch'),row=form.get('row'),decision=form.get('decision'),
  member=form.get('member'),reason=form.get('reason');
 if(typeof batch!=="string"||!UUID.test(batch)||typeof row!=="string"||!UUID.test(row)||
  typeof decision!=="string"||!['MATCHED','CONFLICT','SKIPPED'].includes(decision)||
  typeof reason!=="string"||reason.length>300||
  (decision==='MATCHED'&&(typeof member!=="string"||!UUID.test(member)))||
  (decision!=='MATCHED'&&reason.trim().length<3))redirect(`${ROOT}?error=review`);
 const {data,error}=await owner.supabase.rpc('laundry_pos_g6b_review_row',{
  p_row_id:row,p_member_id:decision==='MATCHED'?member:null,p_decision:decision,p_reason:reason.trim()
 });
 if(error||!data||data.financial_posted!==false)redirect(`${ROOT}?batch=${batch}&error=review`);
 redirect(`${ROOT}?batch=${batch}&saved=review`);
}