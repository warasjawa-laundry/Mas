import "server-only";
import { cookies } from "next/headers";
import { createOwnerClient } from "@/lib/supabase/server";
import type { CashierGrants } from "@/lib/pos/cashier-permissions";
import { validCashierDeviceToken } from "@/lib/pos/cashier-device-token";

/** Owner-paired device cookie, not sufficient to open cashier data. */
export const CASHIER_DEVICE_COOKIE = "mj-pos-cashier-device";
/** Short-lived cashier login cookie, issued after username verification. */
export const CASHIER_LOGIN_COOKIE = "mj-pos-cashier-login";
export const CASHIER_DEVICE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const CASHIER_LOGIN_MAX_AGE_SECONDS = 12 * 60 * 60;
const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};
export const cashierCookieOptions = {
  ...cookieBase,
  maxAge: CASHIER_DEVICE_MAX_AGE_SECONDS,
};
export const cashierLoginCookieOptions = {
  ...cookieBase,
  maxAge: CASHIER_LOGIN_MAX_AGE_SECONDS,
};

export type CashierSession = {
  staff_id: string;
  username: string;
  outlet_id: string;
  display_name: string;
  permissions: CashierGrants;
  outlet_name: string;
  outlet_address: string;
  write_enabled: boolean;
  expires_at: string;
};

/** A paired device only permits the username entry form; never payments/PII. */
export async function isCashierDevicePaired(): Promise<boolean> {
  const deviceToken = (await cookies()).get(CASHIER_DEVICE_COOKIE)?.value;
  if (!validCashierDeviceToken(deviceToken)) return false;
  const client = await createOwnerClient();
  if (!client) return false;
  const { data, error } = await client.rpc("laundry_pos_cashier_session", { p_token: deviceToken });
  return !error && Array.isArray(data) && data.length === 1;
}

/** All future cashier business actions MUST require both live DB-validated tokens. */
export async function getCashierSession(): Promise<CashierSession | null> {
  const jar = await cookies();
  const deviceToken = jar.get(CASHIER_DEVICE_COOKIE)?.value;
  const loginToken = jar.get(CASHIER_LOGIN_COOKIE)?.value;
  if (!validCashierDeviceToken(deviceToken) || !validCashierDeviceToken(loginToken)) return null;
  const client = await createOwnerClient();
  if (!client) return null;
  const { data, error } = await client.rpc("laundry_pos_cashier_logged_in", {
    p_device_token: deviceToken,
    p_login_token: loginToken,
  });
  if (error || !Array.isArray(data) || data.length !== 1) return null;
  const row = data[0] as CashierSession;
  if (typeof row.staff_id !== "string" || typeof row.username !== "string" ||
      typeof row.outlet_id !== "string" || typeof row.display_name !== "string" ||
      typeof row.outlet_name !== "string" || typeof row.write_enabled !== "boolean" ||
      !row.permissions || typeof row.permissions !== "object" || Array.isArray(row.permissions)) return null;
  return row;
}