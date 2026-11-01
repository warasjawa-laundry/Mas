import type { QuantityUnit } from "./money";

/** Explicit allowlist bridging existing laundry_services.unit strings into POS math. */
const unitAliases: Readonly<Record<string, QuantityUnit>> = Object.freeze({
  kg: "kg",
  m: "m",
  M: "m", // Existing production KARPET service.
  meter: "m", // Existing production Gorden services.
  pcs: "pcs",
  satuan: "pcs", // Explicit future catalog unit.
});

export function posUnitFromCatalog(unit: unknown): QuantityUnit {
  if (typeof unit !== "string" || !Object.hasOwn(unitAliases, unit)) {
    throw new RangeError("UNSUPPORTED_CATALOG_UNIT");
  }
  return unitAliases[unit];
}
