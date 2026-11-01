"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createOwnerClient } from "@/lib/supabase/server";
import { validCashierDeviceToken } from "@/lib/pos/cashier-device-token";
import { CASHIER_DEVICE_COOKIE, cashierCookieOptions } from "@/lib/pos/cashier-device";

export async function leaveCashier() {
  const jar = await cookies();
  const token = jar.get(CASHIER_DEVICE_COOKIE)?.value;
  if (validCashierDeviceToken(token)) {
    const supabase = await createOwnerClient();
    if (supabase) await supabase.rpc("laundry_pos_cashier_end_session", { p_token: token });
  }
  jar.set(CASHIER_DEVICE_COOKIE, "", { ...cashierCookieOptions, maxAge: 0 });
  redirect("/kasir");
}