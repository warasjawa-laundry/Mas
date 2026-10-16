"use server";

import { redirect } from "next/navigation";
import { createOwnerClient, ownerAuthReady } from "@/lib/supabase/server";
import { getVerifiedOwner } from "@/lib/supabase/owner";

const loginId = process.env.OWNER_LOGIN_ID || "masjawalaundry";
const targetEmail = process.env.OWNER_AUTH_EMAIL;

export async function loginOwner(formData: FormData) {
  const id = String(formData.get("loginId") || "").trim();
  const password = String(formData.get("password") || "");
  if (!ownerAuthReady() || !targetEmail) redirect("/admin/login?error=unavailable");
  if (id !== loginId || !password || password.length > 1024) redirect("/admin/login?error=invalid");

  const supabase = await createOwnerClient();
  if (!supabase) redirect("/admin/login?error=unavailable");
  // The user in this response was just verified by Supabase Auth itself.
  // Avoid a redundant getUser() network round-trip immediately after login.
  const { data: { user }, error } = await supabase.auth.signInWithPassword({
    email: targetEmail,
    password,
  });
  if (error || !user || user.is_anonymous) redirect("/admin/login?error=invalid");
  const { data: owner } = await supabase
    .from("laundry_owner_accounts")
    .select("is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (owner?.is_active !== true) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=invalid");
  }
  redirect("/admin/scan");
}

export async function logoutOwner() {
  const supabase = await createOwnerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/admin/login?notice=logout");
}

export async function changeOwnerPassword(formData: FormData) {
  const owner = await getVerifiedOwner();
  if (!owner) redirect("/admin/login");
  const current = String(formData.get("currentPassword") || "");
  const next = String(formData.get("newPassword") || "");
  const confirmation = String(formData.get("confirmPassword") || "");

  if (!next || next.length < 12 || next.length > 128 || !/[a-z]/.test(next) ||
      !/[A-Z]/.test(next) || !/[0-9]/.test(next) || !/[^a-zA-Z0-9]/.test(next) ||
      next !== confirmation || next === current) {
    redirect("/admin/settings?error=invalid");
  }
  if (!current || !targetEmail) redirect("/admin/settings?error=invalid");

  // Reauthenticate to verify the old password before allowing a credential change.
  const { error: proofError } = await owner.supabase.auth.signInWithPassword({
    email: targetEmail,
    password: current,
  });
  if (proofError) redirect("/admin/settings?error=invalid");

  const { error: changeError } = await owner.supabase.auth.updateUser({ password: next });
  if (changeError) redirect("/admin/settings?error=failed");

  await owner.supabase.auth.signOut({ scope: "global" });
  redirect("/admin/login?notice=password-changed");
}
