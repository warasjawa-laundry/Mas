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

/** Owner supplies the four-digit MAS ID; a device pairing is NOT required.
 * Only the database validates identity, grants, shared attempt limit and expiry.
 * Four digits are low-entropy; POS financial launch remains blocked by G8. */
export async function loginCashier(form: FormData) {
  const jar = await cookies();
  const username = normalizeCashierUsername(form.get("username"));
  if (!username) redirect("/kasir?error=invalid");
  const client = await createOwnerClient();
  if (!client) redirect("/kasir?error=unavailable");
  const deviceToken = newCashierDeviceToken();
  const loginToken = newCashierDeviceToken();
  const { data, error } = await client.rpc("laundry_pos_cashier_direct_id_login", {
    p_username: username,
    p_device_token: deviceToken,
    p_login_token: loginToken,
  });
  if (error || data !== true) redirect("/kasir?error=invalid");
  // The two opaque session secrets are issued after successful DB confirmation.
  // Both expire after twelve hours, never in localStorage/client JavaScript.
  jar.set(CASHIER_DEVICE_COOKIE, deviceToken, { ...cashierCookieOptions, maxAge: 12 * 60 * 60 });
  jar.set(CASHIER_LOGIN_COOKIE, loginToken, cashierLoginCookieOptions);
  redirect("/kasir");
}

/** Revoke both session credentials at logout. */
export async function leaveCashier() {
  const jar = await cookies();
  const loginToken = jar.get(CASHIER_LOGIN_COOKIE)?.value;
  const deviceToken = jar.get(CASHIER_DEVICE_COOKIE)?.value;
  const client = await createOwnerClient();
  if (client && validCashierDeviceToken(loginToken)) {
    await client.rpc("laundry_pos_cashier_logout", { p_login_token: loginToken });
  }
  if (client && validCashierDeviceToken(deviceToken)) {
    await client.rpc("laundry_pos_cashier_end_session", { p_token: deviceToken });
  }
  jar.set(CASHIER_LOGIN_COOKIE, "", { ...cashierLoginCookieOptions, maxAge: 0 });
  jar.set(CASHIER_DEVICE_COOKIE, "", { ...cashierCookieOptions, maxAge: 0 });
  redirect("/kasir");
}

/** Same explicit logout behavior for legacy bookmarked device-disconnect link. */
export async function disconnectCashierDevice() {
  await leaveCashier();
}