import "server-only";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ADMIN_ACCESS_COOKIE, validAdminAccess } from "@/lib/admin/entry-pass";
import { createOwnerClient } from "@/lib/supabase/server";
import { timeAdmin } from "@/lib/admin/timing";

export async function getVerifiedOwner() {
  const supabase = await createOwnerClient();
  if (!supabase) return null;

  // getUser validates the Auth identity with the Supabase Auth server, not just local cookie claims.
  const { data: { user }, error } = await timeAdmin("owner.auth.getUser", () => supabase.auth.getUser());
  if (error || !user || user.is_anonymous) return null;
  if (!validAdminAccess((await cookies()).get(ADMIN_ACCESS_COOKIE)?.value,user.id)) return null;

  const { data: owner, error: roleError } = await timeAdmin("owner.role.lookup", () => supabase
    .from("laundry_owner_accounts")
    .select("is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle());

  if (roleError || owner?.is_active !== true) return null;
  return { user, supabase };
}

export async function requireOwner() {
  const owner = await getVerifiedOwner();
  if (!owner) redirect("/admin/login");
  return owner;
}
