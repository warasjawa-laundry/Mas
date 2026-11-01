import "server-only";
import { cookies } from "next/headers";
import { createOwnerClient } from "@/lib/supabase/server";
import type { CashierGrants } from "@/lib/pos/cashier-permissions";
import { validCashierDeviceToken } from "@/lib/pos/cashier-device-token";

export const CASHIER_DEVICE_COOKIE = "mj-pos-cashier-device";
export const CASHIER_DEVICE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const cashierCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: CASHIER_DEVICE_MAX_AGE_SECONDS,
};

export type CashierSession = {
  staff_id: string;
  outlet_id: string;
  display_name: string;
  permissions: CashierGrants;
  outlet_name: string;
  outlet_address: string;
  write_enabled: boolean;
  expires_at: string;
};

export async function getCashierSession(): Promise<CashierSession | null> {
  const token = (await cookies()).get(CASHIER_DEVICE_COOKIE)?.value;
  if (!validCashierDeviceToken(token)) return null;
  const client = await createOwnerClient();
  if (!client) return null;
  const { data, error } = await client.rpc("laundry_pos_cashier_session", { p_token: token });
  if (error || !Array.isArray(data) || data.length !== 1) return null;
  const record = data[0] as CashierSession;
  if (typeof record.staff_id !== "string" || typeof record.outlet_id !== "string" ||
      typeof record.display_name !== "string" || record.permissions === null ||
      typeof record.permissions !== "object") return null;
  return record;
}