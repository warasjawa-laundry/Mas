export type PosRow = {
  id: string; invoice_no: string; customer_name: string; total_idr: string | number;
  work_status: string; payment_status: string; created_at: string;
};
export type BoardTab = "queue" | "ready" | "unpaid" | "collected";

export function filterBoardOrders(orders: PosRow[], tab: BoardTab, search = "") {
  const query = search.trim().slice(0, 80).toLocaleLowerCase("id-ID");
  return orders.filter(order => {
    const matchesStatus = tab === "collected" ? order.work_status === "COLLECTED" : tab === "ready" ? order.work_status === "READY" :
      tab === "unpaid" ? ["UNPAID", "PARTIAL"].includes(order.payment_status) : ["QUEUED","PROCESSING"].includes(order.work_status);
    return matchesStatus && (!query || order.customer_name.toLocaleLowerCase("id-ID").includes(query) || order.invoice_no.toLocaleLowerCase("id-ID").includes(query));
  });
}
export function boardMoney(value: string | number) {
  try { return "Rp " + new Intl.NumberFormat("id-ID").format(BigInt(value)); }
  catch { return "Belum tersedia"; }
}
export function boardDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Tanggal belum tersedia";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(date) + " WIB";
}
export function paymentLabel(status: string) {
  const labels: Record<string, string> = { PAID: "Lunas", PARTIAL: "Dibayar sebagian", REFUNDED: "Refund penuh", ZERO_TOTAL: "Gratis", UNPAID: "Belum Bayar" };
  return labels[status] ?? "Status belum tersedia";
}
