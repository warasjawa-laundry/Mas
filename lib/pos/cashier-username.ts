/** Public cashier ID: sequential, owner-issued. It is NOT an authentication secret. */
export function normalizeCashierUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!/^MAS-(?:0[0-9]{3}|[1-9][0-9]{3})$/.test(normalized) || normalized === "MAS-0000") {
    return null;
  }
  return normalized;
}