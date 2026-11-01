import { test } from "node:test";
import assert from "node:assert/strict";
import { posUnitFromCatalog } from "../lib/pos/catalog-units.ts";
import { calculateOrderTotals } from "../lib/pos/money.ts";

test("catalog units from production map explicitly to strict POS units", () => {
  assert.equal(posUnitFromCatalog("kg"), "kg");
  assert.equal(posUnitFromCatalog("meter"), "m");
  assert.equal(posUnitFromCatalog("M"), "m");
  assert.equal(posUnitFromCatalog("m"), "m");
});
test("explicit future units support pieces without guessing service names", () => {
  assert.equal(posUnitFromCatalog("pcs"), "pcs");
  assert.equal(posUnitFromCatalog("satuan"), "pcs");
});
test("unknown and malformed units fail closed", () => {
  for (const unit of ["", "KG", "Meter", "PCS", "m2", "meter ", " meter", "pasang", "__proto__", "constructor", null, undefined, 1, {}, []]) {
    assert.throws(() => posUnitFromCatalog(unit), e => e instanceof RangeError && e.message === "UNSUPPORTED_CATALOG_UNIT");
  }
});
test("legacy meter aliases preserve exact integer calculations", () => {
  assert.deepEqual(calculateOrderTotals([
    {priceIdr:"15000",quantity:"5",unit:posUnitFromCatalog("M")},
    {priceIdr:"3000",quantity:"1",unit:posUnitFromCatalog("kg")},
    {priceIdr:"15000",quantity:"1",unit:posUnitFromCatalog("pcs")},
  ]), {
    items:[{lineTotalIdr:"75000"},{lineTotalIdr:"3000"},{lineTotalIdr:"15000"}],
    subtotalIdr:"93000", discountIdr:"0", feesIdr:"0", totalIdr:"93000",
  });
  assert.deepEqual(calculateOrderTotals([{priceIdr:"3500",quantity:"1.255",unit:posUnitFromCatalog("meter")}]),
    calculateOrderTotals([{priceIdr:"3500",quantity:"1.255",unit:"m"}]));
});
test("calculator remains strict and never accepts unnormalized catalog units", () => {
  assert.throws(() => calculateOrderTotals([{priceIdr:"3500",quantity:"1",unit:"meter"}]), /INVALID_UNIT/);
});
