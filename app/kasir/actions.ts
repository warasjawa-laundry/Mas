"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createOwnerClient } from "@/lib/supabase/server";
import { validCashierDeviceToken, newCashierDeviceToken } from "@/lib/pos/cashier-device-token";
import { normalizeCashierUsername } from "@/lib/pos/cashier-username";
import {
  CASHIER_DEVICE_COOKIE, CASHIER_LOGIN_COOKIE,
  cashierCookieOptions, cashierLoginCookieOptions,
} from "@/lib/pos/cashier-device";

/** Username-only entry, but only on an active owner-paired physical device. */
export async function loginCashier(form: FormData) {
  const jar = await cookies();
  const deviceToken = jar.get(CASHIER_DEVICE_COOKIE)?.value;
  const username = normalizeCashierUsername(form.get("username"));
  if (!validCashierDeviceToken(deviceToken)) redirect("/kasir?error=device");
  if (!username) redirect("/kasir?error=invalid");
  const client = await createOwnerClient();
  if (!client) redirect("/kasir?error=unavailable");
  const loginToken = newCashierDeviceToken();
  const { data, error } = await client.rpc("laundry_pos_cashier_login", {
    p_device_token: deviceToken,
    p_username: username,
    p_login_token: loginToken,
  });
  if (error || data !== true) redirect("/kasir?error=invalid");
  jar.set(CASHIER_LOGIN_COOKIE, loginToken, cashierLoginCookieOptions);
  redirect("/kasir");
}

/** Log out the cashier, keep this approved workstation paired for next shift. */
export async function leaveCashier() {
  const jar = await cookies();
  const loginToken = jar.get(CASHIER_LOGIN_COOKIE)?.value;
  if (validCashierDeviceToken(loginToken)) {
    const client = await createOwnerClient();
    if (client) await client.rpc("laundry_pos_cashier_logout", { p_login_token: loginToken });
  }
  jar.set(CASHIER_LOGIN_COOKIE, "", { ...cashierLoginCookieOptions, maxAge: 0 });
  redirect("/kasir");
}

/** Explicit unlink for a lost/reassigned workstation; owner can also revoke. */
export async function disconnectCashierDevice() {
  const jar = await cookies();
  const token = jar.get(CASHIER_DEVICE_COOKIE)?.value;
  if (validCashierDeviceToken(token)) {
    const client = await createOwnerClient();
    if (client) await client.rpc("laundry_pos_cashier_end_session", { p_token: token });
  }
  jar.set(CASHIER_LOGIN_COOKIE, "", { ...cashierLoginCookieOptions, maxAge: 0 });
  jar.set(CASHIER_DEVICE_COOKIE, "", { ...cashierCookieOptions, maxAge: 0 });
  redirect("/kasir");
}