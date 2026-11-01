import {test} from 'node:test';
import assert from 'node:assert/strict';

import {parseMoneyIdr, parseQuantityMilli, calculateOrderTotals} from '../lib/pos/money.ts';
function fails(action, code) {
  assert.throws(action, error => error instanceof RangeError && error.message === code);
}
const item = (priceIdr, quantity = '1', unit = 'pcs') => ({priceIdr, quantity, unit});

test('money parser accepts canonical zero and the one-billion payment ceiling', () => {
  const parse = parseMoneyIdr;
  assert.equal(parse('0'), 0n);
  assert.equal(parse('93000'), 93000n);
  assert.equal(parse('1000000000'), 1000000000n);
});

test('money parser rejects coercion, noncanonical syntax and unbounded text', () => {
  const parse = parseMoneyIdr;
  for (const value of ['', '00', '01', '-1', '+1', '1.0', '1e3', 'NaN', '1,000', ' 1', '1 ', '1\n', 1, null, undefined, '9'.repeat(10000)]) {
    fails(() => parse(value), 'INVALID_MONEY');
  }
  fails(() => parse('1000000001'), 'MONEY_LIMIT');
});

test('quantity parser converts up to three decimal places into exact milliunits', () => {
  const parse = parseQuantityMilli;
  for (const unit of ['kg', 'm']) {
    assert.equal(parse('0.001', unit), 1n);
    assert.equal(parse('1.2', unit), 1200n);
    assert.equal(parse('1.255', unit), 1255n);
    assert.equal(parse('1.000', unit), 1000n);
    assert.equal(parse('1000000', unit), 1000000000n);
  }
  assert.equal(parse('5', 'pcs'), 5000n);
});

test('quantity parser rejects zero, malformed and excessive fractional quantities', () => {
  const parse = parseQuantityMilli;
  for (const quantity of ['', '0', '0.000', '-1', '+1', '.001', '1.', '01', '00.1', '1.0000', '1e3', 'NaN', ' 1', '1 ', '1\n', 1, null, '9'.repeat(10000)]) {
    fails(() => parse(quantity, 'kg'), 'INVALID_QUANTITY');
  }
  fails(() => parse('1000000.001', 'kg'), 'QUANTITY_LIMIT');
  fails(() => parse('1000001', 'pcs'), 'QUANTITY_LIMIT');
});

test('pieces require integer text and arbitrary units are rejected', () => {
  const parse = parseQuantityMilli;
  for (const quantity of ['1.0', '1.001', '0.1']) fails(() => parse(quantity, 'pcs'), 'INVALID_QUANTITY');
  for (const unit of ['KG', 'meter', 'pasang', '', null, undefined]) fails(() => parse('1', unit), 'INVALID_UNIT');
});

test('each service line rounds half up before subtotal without summing unlike units', () => {
  const calculate = calculateOrderTotals;
  assert.deepEqual(calculate([item('3500', '0.001', 'm'), item('6000', '1.255', 'kg'), item('5000', '2')]), {
    items: [{lineTotalIdr: '4'}, {lineTotalIdr: '7530'}, {lineTotalIdr: '10000'}],
    subtotalIdr: '17534', discountIdr: '0', feesIdr: '0', totalIdr: '17534',
  });
  assert.equal(calculate([item('499', '0.001', 'kg'), item('500', '0.001', 'm')]).subtotalIdr, '1');
});

test('percent discount uses integer basis points and half-up invoice rounding', () => {
  const calculate = calculateOrderTotals;
  const result = calculate([item('100')], {discount: {kind: 'percent', basisPoints: 50}});
  assert.equal(result.discountIdr, '1');
  assert.equal(result.totalIdr, '99');
  assert.equal(calculate([item('99')], {discount: {kind: 'percent', basisPoints: 50}}).discountIdr, '0');
});

test('delivery and service fees are excluded from the discount basis', () => {
  const calculate = calculateOrderTotals;
  assert.deepEqual(calculate([item('10000')], {
    deliveryIdr: '2000', serviceFeeIdr: '500', discount: {kind: 'percent', basisPoints: 1000},
  }), {
    items: [{lineTotalIdr: '10000'}], subtotalIdr: '10000', discountIdr: '1000', feesIdr: '2500', totalIdr: '11500',
  });
});

test('fixed discount may consume service subtotal but may not consume fees', () => {
  const calculate = calculateOrderTotals;
  assert.equal(calculate([item('100')], {deliveryIdr: '50', discount: {kind: 'fixed', amountIdr: '100'}}).totalIdr, '50');
  fails(() => calculate([item('100')], {deliveryIdr: '50', discount: {kind: 'fixed', amountIdr: '101'}}), 'DISCOUNT_EXCEEDS_SUBTOTAL');
});

test('free lines and zero totals serialize normally without mutating input', () => {
  const calculate = calculateOrderTotals;
  const items = Object.freeze([Object.freeze(item('0', '0.001', 'kg'))]);
  assert.deepEqual(calculate(items), {
    items: [{lineTotalIdr: '0'}], subtotalIdr: '0', discountIdr: '0', feesIdr: '0', totalIdr: '0',
  });
  assert.equal(calculate([item('100')], {discount: {kind: 'percent', basisPoints: 0}}).totalIdr, '100');
  assert.equal(calculate([item('100')], {discount: {kind: 'percent', basisPoints: 10000}}).totalIdr, '0');
  assert.doesNotThrow(() => JSON.stringify(calculate(items)));
});

test('discounts reject noninteger, nonnumeric or out-of-range basis points and unknown kinds', () => {
  const calculate = calculateOrderTotals;
  for (const basisPoints of [-1, 10001, 0.5, NaN, Infinity, '50', null, undefined]) {
    fails(() => calculate([item('100')], {discount: {kind: 'percent', basisPoints}}), 'INVALID_DISCOUNT');
  }
  for (const discount of [null, {}, {kind: 'other'}, {kind: 'fixed', amountIdr: 1}]) {
    fails(() => calculate([item('100')], {discount}), discount?.kind === 'fixed' ? 'INVALID_MONEY' : 'INVALID_DISCOUNT');
  }
});

test('per-line, subtotal, combined fees and final total overflow are rejected', () => {
  const calculate = calculateOrderTotals;
  fails(() => calculate([item('1000000000', '2')]), 'LINE_TOTAL_LIMIT');
  fails(() => calculate([item('1000000000'), item('1')], {discount: {kind: 'percent', basisPoints: 10000}}), 'SUBTOTAL_LIMIT');
  fails(() => calculate([item('0')], {deliveryIdr: '1000000000', serviceFeeIdr: '1'}), 'FEES_LIMIT');
  fails(() => calculate([item('1000000000')], {deliveryIdr: '1'}), 'TOTAL_LIMIT');
  assert.equal(calculate([item('1000000000')], {deliveryIdr: '1', discount: {kind: 'fixed', amountIdr: '1'}}).totalIdr, '1000000000');
});

test('order boundary validates items, adjustments and collection size', () => {
  const calculate = calculateOrderTotals;
  for (const items of [null, {}, [], [null], [{}]]) fails(() => calculate(items), 'INVALID_ITEMS');
  fails(() => calculate(Array.from({length: 1001}, () => item('0'))), 'ITEMS_LIMIT');
  for (const adjustment of [null, [], '0']) fails(() => calculate([item('1')], adjustment), 'INVALID_ADJUSTMENT');
  fails(() => calculate([item('1', '1', 'bad')]), 'INVALID_UNIT');
  fails(() => calculate([item('1', '0')]), 'INVALID_QUANTITY');
  fails(() => calculate([item(1)]), 'INVALID_MONEY');
  fails(() => calculate([item('1')], {deliveryIdr: '1.1'}), 'INVALID_MONEY');
  fails(() => calculate([item('1')], {serviceFeeIdr: '-1'}), 'INVALID_MONEY');
});

test('item boundary rejects unknown fields instead of silently dropping quoted amounts', () => {
  for (const extra of [{priceIDR: '50'}, {deliveryIdr: '50'}, {[Symbol('amount')]: '50'}]) {
    fails(() => calculateOrderTotals([{...item('100'), ...extra}]), 'INVALID_ITEMS');
  }
});

test('adjustment boundary rejects misspelled or unknown charge fields', () => {
  for (const adjustment of [{deliveryIDR: '50'}, {serviceFeeIDR: '50'}, {deliveryIdr: '50', amountIdr: '100'}]) {
    fails(() => calculateOrderTotals([item('100')], adjustment), 'INVALID_ADJUSTMENT');
  }
});

test('discount boundary rejects mixed variants and unknown fields', () => {
  for (const discount of [
    {kind: 'percent', basisPoints: 5000, amountIdr: '50'},
    {kind: 'fixed', amountIdr: '50', basisPoints: 5000},
    {kind: 'percent', basisPoints: 5000, amountIDR: '50'},
    {kind: 'fixed', amountIdr: '50', amountIDR: '50'},
  ]) {
    fails(() => calculateOrderTotals([item('100')], {discount}), 'INVALID_DISCOUNT');
  }
});
