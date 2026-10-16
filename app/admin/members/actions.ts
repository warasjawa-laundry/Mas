"use server";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/supabase/owner";
import { cardIssuanceReady, newCardToken, encryptCardToken, tokenDigest } from "@/lib/laundry/card";
import { normalizeWhatsapp, validateMemberName } from "@/lib/laundry/validation";

export async function registerLaundryMember(formData: FormData) {
  const owner = await requireOwner();
  if (!cardIssuanceReady()) redirect("/admin/members/new?error=unavailable");
  let display_name: string, phone: string | null;
  try {
    display_name = validateMemberName(String(formData.get("name") ?? ""));
    phone = normalizeWhatsapp(String(formData.get("whatsapp") ?? ""));
  } catch { redirect("/admin/members/new?error=invalid"); }
  const consent = formData.get("consent") === "on";
  if (consent && !phone) redirect("/admin/members/new?error=consent");
  const requestId = String(formData.get("requestId") ?? "");
  if (!/^[a-f0-9-]{36}$/i.test(requestId)) redirect("/admin/members/new?error=invalid");
  const token = newCardToken();
  const { data, error } = await owner.supabase.rpc("laundry_register_member", {
    p_display_name: display_name,
    p_whatsapp_e164: phone,
    p_whatsapp_consent: consent,
    p_token_digest_hex: tokenDigest(token),
    p_token_ciphertext_hex: encryptCardToken(token),
    p_request_id: requestId,
  });
  if (error || !data || typeof data !== "string") {
    // Avoid log payloads/QR material. Server response never includes an untrusted error.
    redirect("/admin/members/new?error=save");
  }
  redirect("/admin/members/" + data + "/card");
}
export function newRegistrationId() { return randomUUID(); }
