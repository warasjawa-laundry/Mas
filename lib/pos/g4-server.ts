import "server-only";
import { cookies } from "next/headers";
import { createOwnerClient } from "@/lib/supabase/server";
import { getCashierSession, CASHIER_DEVICE_COOKIE, CASHIER_LOGIN_COOKIE } from "@/lib/pos/cashier-device";
import { validCashierDeviceToken } from "@/lib/pos/cashier-device-token";
import { hasCashierGrant, type CashierPermission } from "@/lib/pos/cashier-permissions";

export async function cashierRpcAccess(permission:CashierPermission){
  const session=await getCashierSession();
  if(!session || !hasCashierGrant(session.permissions,permission))return null;
  const jar=await cookies();
  const deviceToken=jar.get(CASHIER_DEVICE_COOKIE)?.value;
  const loginToken=jar.get(CASHIER_LOGIN_COOKIE)?.value;
  if(!validCashierDeviceToken(deviceToken)||!validCashierDeviceToken(loginToken))return null;
  const client=await createOwnerClient();
  if(!client)return null;
  return {session,client,tokens:{p_device_token:deviceToken,p_login_token:loginToken}};
}