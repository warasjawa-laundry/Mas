"use server";
import {requireOwner} from "@/lib/supabase/owner";
import {revalidatePath} from "next/cache";
const path="/admin/settings/services";
async function save(rpc:string,args:Record<string,unknown>){
 const {supabase}=await requireOwner();const {error}=await supabase.rpc(rpc,args);
 if(error)return {error:error.message.includes('conflict')?'Pengaturan berubah. Muat ulang sebelum menyimpan.':'Belum tersimpan. Periksa isian, durasi aktif, harga dan koneksi.'};
 revalidatePath(path);revalidatePath('/');
 return {error:'',confirmed:true,redirectTo:path+'?saved=1'};
}
export async function savePackage(form:FormData){
 const code=String(form.get('code')),revision=String(form.get('revision')),minutes=String(form.get('minutes')),name=String(form.get('name')??'').trim();
 if(!['REGULAR','EXPRESS','FLASH'].includes(code)||!/^\d{1,12}$/.test(revision)||! /^[1-9]\d{0,5}$/.test(minutes)||Number(minutes)>525600||name.length<2||name.length>80)return {error:'Periksa nama dan durasi paket dalam menit.'};
 return save('laundry_pos_save_package',{p_code:code,p_revision:Number(revision),p_name:name,p_minutes:Number(minutes),p_active:form.get('active')==='yes'});
}
export async function saveFamily(form:FormData){
 const id=String(form.get('id')),revision=String(form.get('revision')),position=String(form.get('position'));
 if(!/^[0-9a-f-]{36}$/i.test(id)||!/^\d{1,12}$/.test(revision)||!/^\d{1,4}$/.test(position))return {error:'Identitas atau urutan layanan tidak valid.'};
 const tariffs=[];
 for(const code of ['REGULAR','EXPRESS','FLASH']){
  const active=form.get('active-'+code)==='yes',price=String(form.get('price-'+code)??'');
  if(active&&!/^(0|[1-9]\d{0,9})$/.test(price))return {error:'Isi harga setiap paket yang tersedia.'};
  tariffs.push({code,active,price_idr:price||'0',existing_id:String(form.get('existing-'+code)??''),existing_revision:String(form.get('existing-revision-'+code)??'0')});
 }
 return save('laundry_pos_save_family',{p_id:id,p_revision:Number(revision),p_input:{name:String(form.get('name')??'').trim(),category:String(form.get('category')??'').trim(),
 unit:String(form.get('unit')),position:Number(position),active:form.get('active')==='yes'},p_tariffs:tariffs});
}
export async function enablePackageWorkflow(){return save('laundry_pos_enable_package_workflow',{});}
export async function saveReceiptSettings(form:FormData){
 const revision=String(form.get('revision'));if(!/^\d{1,12}$/.test(revision))return {error:'Versi template tidak valid.'};
 const config:Record<string,string>={};for(const key of ['outlet_name','address','contact','new_title','ready_title','collected_title','terms','payment_notice','bank','ewallet','cs']){
  const value=form.get(key);if(typeof value!=='string'||value.length>4000)return {error:'Periksa teks template (maksimal 4000 karakter per bagian).'};config[key]=value;
 }
 return save('laundry_pos_save_receipt_settings',{p_revision:Number(revision),p_config:config});
}
