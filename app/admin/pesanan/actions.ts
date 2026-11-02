"use server";
import {redirect} from "next/navigation";
import {requireOwner} from "@/lib/supabase/owner";
/** Owner note posting is forbidden until owner-attributed DB commands and G8 are approved. */
export async function ownerPosWriteLocked(_form:FormData){
 await requireOwner();
 redirect("/admin/pesanan/baru?error=disabled");
}
