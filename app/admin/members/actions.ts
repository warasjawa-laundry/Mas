"use server";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/supabase/owner";
import { cardIssuanceReady, newCardToken, encryptCardToken, tokenDigest } from "@/lib/laundry/card";
import { normalizeWhatsapp, validateMemberName } from "@/lib/laundry/validation";

export async function registerLaundryMember(formData: FormData) {
  const owner = await requireOwner();
  if (!cardIssuanceReady()) return {error:"Pendaftaran belum dapat diproses. Hubungi pengelola. Isian tetap tersedia di formulir ini."};
  let display_name: string, phone: string | null;
  try {
    display_name = validateMemberName(String(formData.get("name") ?? ""));
    phone = normalizeWhatsapp(String(formData.get("whatsapp") ?? ""));
  } catch { return {error:"Periksa nama dan nomor WhatsApp yang dimasukkan. Isian tetap tersedia di formulir ini."}; }
  const consent = formData.get("consent") === "on";
  if (consent && !phone) return {error:"Persetujuan promo memerlukan nomor WhatsApp pelanggan."};
  const requestId = String(formData.get("requestId") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) redirect("/admin/members/new?error=invalid");
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
    return {error:"Member belum tersimpan. Periksa koneksi lalu coba lagi. Isian tetap tersedia di formulir ini."};
  }
  redirect("/admin/members/" + data + "/card");
}
