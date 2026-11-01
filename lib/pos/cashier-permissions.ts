/** Capabilities owner may grant to a passwordless cashier device. */
export const CASHIER_PERMISSIONS = [
  ["order_view", "Lihat pesanan"],
  ["order_create", "Buat nota"],
  ["order_work", "Ubah status cucian"],
  ["member_lookup", "Cari member dan scan QR"],
  ["payment_collect", "Terima pembayaran"],
  ["receipt_print", "Cetak nota"],
  ["whatsapp_draft", "Buat pesan WhatsApp"],
  ["cash_view", "Lihat mutasi kas"],
  ["cash_entry", "Catat kas masuk/keluar"],
  ["reports_view", "Lihat laporan"],
  ["refund_full", "Refund penuh (risiko tinggi)"],
] as const;

export type CashierPermission = (typeof CASHIER_PERMISSIONS)[number][0];
export type CashierGrants = Partial<Record<CashierPermission, boolean>>;

export function parseCashierGrants(formData: FormData): CashierGrants {
  const grants: CashierGrants = {};
  for (const [key] of CASHIER_PERMISSIONS) {
    if (formData.get(`permit_${key}`) === "on") grants[key] = true;
  }
  return grants;
}

export function hasCashierGrant(grants: unknown, grant: CashierPermission): boolean {
  if (typeof grants !== "object" || grants === null || Array.isArray(grants)) return false;
  return (grants as Record<string, unknown>)[grant] === true;
}