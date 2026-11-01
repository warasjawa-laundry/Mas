"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/supabase/owner";
import { parseCashierGrants } from "@/lib/pos/cashier-permissions";
import { newCashierDeviceToken } from "@/lib/pos/cashier-device-token";
import { CASHIER_DEVICE_COOKIE, CASHIER_LOGIN_COOKIE, cashierCookieOptions, cashierLoginCookieOptions } from "@/lib/pos/cashier-device";
import { ADMIN_ACCESS_COOKIE, ADMIN_ENTRY_COOKIE, adminSessionCookieOptions } from "@/lib/admin/entry-pass";

const back = "/admin/pos/kasir";
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function saveCashier(form: FormData) {
  const { supabase } = await requireOwner();
  const id = String(form.get("staffId") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  if ((id && !isUuid(id)) || name.length < 2 || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)) {
    redirect(`${back}?error=invalid`);
  }
  const { error } = await supabase.rpc("laundry_pos_owner_save_cashier", {
    p_staff_id: id || null,
    p_display_name: name,
    p_permissions: parseCashierGrants(form),
    p_active: true,
  });
  if (error) redirect(`${back}?error=failed`);
  revalidatePath(back);
  redirect(`${back}?saved=1`);
}

/** "Hapus" means revoke access and hide from active cashier list; keep audit history. */
export async function removeCashier(form: FormData) {
  const { supabase } = await requireOwner();
  const staffId = String(form.get("staffId") ?? "");
  if (!isUuid(staffId)) redirect(`${back}?error=invalid`);
  const { error } = await supabase.rpc("laundry_pos_owner_save_cashier", {
    p_staff_id: staffId,
    p_display_name: String(form.get("name") ?? ""),
    p_permissions: {},
    p_active: false,
  });
  if (error) redirect(`${back}?error=failed`);
  revalidatePath(back);
  redirect(`${back}?removed=1`);
}

export async function revokeCashierDevices(form: FormData) {
  const { supabase } = await requireOwner();
  const staffId = String(form.get("staffId") ?? "");
  if (!isUuid(staffId)) redirect(`${back}?error=invalid`);
  const { error } = await supabase.rpc("laundry_pos_owner_revoke_cashier_devices", { p_staff_id: staffId });
  if (error) redirect(`${back}?error=failed`);
  revalidatePath(back);
  redirect(`${back}?revoked=1`);
}

/** Owner logs in on this device, pairs one employee, then owner session is removed. */
export async function activateCashierDevice(form: FormData) {
  const { supabase } = await requireOwner();
  const staffId = String(form.get("staffId") ?? "");
  if (!isUuid(staffId)) redirect(`${back}?error=invalid`);
  const token = newCashierDeviceToken();
  const { data: deviceId, error } = await supabase.rpc("laundry_pos_owner_pair_cashier", {
    p_staff_id: staffId,
    p_token: token,
  });
  if (error || typeof deviceId !== "string") redirect(`${back}?error=failed`);

  // Do not retain owner privileges on the employee's device.
  const { error: logoutError } = await supabase.auth.signOut({ scope: "local" });
  if (logoutError) {
    await supabase.rpc("laundry_pos_owner_revoke_device", { p_device_id: deviceId });
    redirect(`${back}?error=logout`);
  }
  const jar = await cookies();
  jar.set(ADMIN_ACCESS_COOKIE, "", { ...adminSessionCookieOptions, maxAge: 0 });
  jar.set(ADMIN_ENTRY_COOKIE, "", { ...adminSessionCookieOptions, maxAge: 0 });
  jar.set(CASHIER_DEVICE_COOKIE, token, cashierCookieOptions);
  jar.set(CASHIER_LOGIN_COOKIE, "", { ...cashierLoginCookieOptions, maxAge: 0 });
  redirect("/kasir");
}