"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {requireOwner} from "@/lib/supabase/owner";
import {parseService} from "@/lib/services/catalog";
const path="/admin/settings/services";
export async function saveService(_previous:{error:string},form:FormData):Promise<{error:string}>{
 const {supabase}=await requireOwner();
 const id=String(form.get("id")??""),revision=String(form.get("revision")??"");
 const input=parseService(form);
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)||!/^(0|[1-9][0-9]{0,14})$/.test(revision)||!input)return {error:"Periksa kategori, nama layanan, harga, satuan, dan urutan."};
 const {error}=await supabase.rpc("laundry_save_service",{p_id:id,p_expected_revision:Number(revision),p_input:input});
 if(error)return {error:error.message.includes("catalog_conflict")?"Layanan ini sudah berubah sejak halaman dibuka. Muat ulang sebelum menyimpan lagi.":error.message.includes("catalog_limit")?"Batas 200 layanan sudah tercapai.":"Perubahan belum tersimpan. Isian tetap tersedia; periksa koneksi lalu coba lagi."};
 revalidatePath("/");revalidatePath(path);
 redirect(path+"?saved=1");
}

