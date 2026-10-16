export function normalizeWhatsapp(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const compact = trimmed.replace(/[ .()-]/g, "");
  let phone = compact;
  if (/^08[0-9]+$/.test(phone)) phone = "+62" + phone.slice(1);
  else if (/^628[0-9]+$/.test(phone)) phone = "+" + phone;
  if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) throw new Error("Nomor WhatsApp tidak valid");
  return phone;
}
export function validateMemberName(raw: string) {
  const clean = raw.replace(/\s+/g, " ").trim();
  if (clean.length < 2 || clean.length > 100 || /[\u0000-\u001f\u007f]/.test(clean))
    throw new Error("Nama member harus 2–100 karakter");
  return clean;
}
