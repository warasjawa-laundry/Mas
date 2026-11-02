"use server";
import {redirect} from "next/navigation";
import {requireOwner} from "@/lib/supabase/owner";
/** No false staff identity or fallback cashier-session creation.
 * A separate owner-actor write RPC is required and remains G8 gated. */
export async function createOwnerOrder(_form:FormData):Promise<void>{
 await requireOwner();
 redirect("/admin/pesanan/baru?error=disabled");
}
