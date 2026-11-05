export type QuantityUnit = 'kg' | 'm' | 'pcs';

export type OrderMoneyItem = {
  priceIdr: string;
  quantity: string;
  unit: QuantityUnit;
};

export type OrderAdjustment = {
  deliveryIdr?: string;
  serviceFeeIdr?: string;
  discount?: {kind: 'fixed'; amountIdr: string} | {kind: 'percent'; basisPoints: number};
};

export type OrderTotals = {
  items: {lineTotalIdr: string}[];
  subtotalIdr: string;
  discountIdr: string;
  feesIdr: string;
  totalIdr: string;
};

const ZERO = BigInt(0);
const MILLI = BigInt(1000);
const MONEY_LIMIT = BigInt('1000000000');
// A line supports at most one million units; parsing never receives unbounded digits.
const QUANTITY_MILLI_LIMIT = BigInt('1000000000');
const ITEM_LIMIT = 1000;
const INTEGER = /^(?:0|[1-9][0-9]*)(?![\s\S])/;
const DECIMAL = /^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,3})?(?![\s\S])/;

function reject(code: string): never {
  throw new RangeError(code);
}

function boundedMoney(amount: bigint, code: string): bigint {
  if (amount > MONEY_LIMIT) reject(code);
  return amount;
}

export function parseMoneyIdr(text: string): bigint {
  if (typeof text !== 'string' || text.length > 10 || !INTEGER.test(text)) {
    reject('INVALID_MONEY');
  }
  return boundedMoney(BigInt(text), 'MONEY_LIMIT');
}

export function parseQuantityMilli(text: string, unit: QuantityUnit): bigint {
  if(typeof text==='string')text=text.replace(',','.');
  if (unit !== 'kg' && unit !== 'm' && unit !== 'pcs') reject('INVALID_UNIT');
  if (typeof text !== 'string' || text.length > 11 || !(unit === 'pcs' ? INTEGER : DECIMAL).test(text)) {
    reject('INVALID_QUANTITY');
  }
  const [whole, fraction = ''] = text.split('.');
  const quantity = BigInt(whole) * MILLI + BigInt(fraction.padEnd(3, '0'));
  if (quantity === ZERO) reject('INVALID_QUANTITY');
  if (quantity > QUANTITY_MILLI_LIMIT) reject('QUANTITY_LIMIT');
  return quantity;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasKeys(value: object, allowed: readonly string[], required: readonly string[] = allowed): boolean {
  return Reflect.ownKeys(value).every(key => typeof key === 'string' && allowed.includes(key))
    && required.every(key => Object.hasOwn(value, key));
}

function discountAmount(discount: OrderAdjustment['discount'], subtotal: bigint): bigint {
  if (discount === undefined) return ZERO;
  if (!isRecord(discount)) reject('INVALID_DISCOUNT');
  if (discount.kind === 'fixed') {
    if (!hasKeys(discount, ['kind', 'amountIdr'])) reject('INVALID_DISCOUNT');
    const amount = parseMoneyIdr(discount.amountIdr);
    if (amount > subtotal) reject('DISCOUNT_EXCEEDS_SUBTOTAL');
    return amount;
  }
  if (discount.kind !== 'percent' || !hasKeys(discount, ['kind', 'basisPoints']) || !Number.isInteger(discount.basisPoints) || discount.basisPoints < 0 || discount.basisPoints > 10000) {
    reject('INVALID_DISCOUNT');
  }
  return (subtotal * BigInt(discount.basisPoints) + BigInt(5000)) / BigInt(10000);
}

export function calculateOrderTotals(
  items: readonly OrderMoneyItem[],
  adjustment: OrderAdjustment = {},
): OrderTotals {
  if (!Array.isArray(items) || items.length === 0) reject('INVALID_ITEMS');
  if (items.length > ITEM_LIMIT) reject('ITEMS_LIMIT');
  if (!isRecord(adjustment) || !hasKeys(adjustment, ['deliveryIdr', 'serviceFeeIdr', 'discount'], [])) {
    reject('INVALID_ADJUSTMENT');
  }
  let subtotal = ZERO;
  const lines: OrderTotals['items'] = [];
  for (const item of items as readonly OrderMoneyItem[]) {
    if (!isRecord(item) || !hasKeys(item, ['priceIdr', 'quantity', 'unit'])) {
      reject('INVALID_ITEMS');
    }
    const price = parseMoneyIdr(item.priceIdr);
    const quantity = parseQuantityMilli(item.quantity, item.unit);
    const lineTotal = boundedMoney((price * quantity + BigInt(500)) / MILLI, 'LINE_TOTAL_LIMIT');
    subtotal = boundedMoney(subtotal + lineTotal, 'SUBTOTAL_LIMIT');
    lines.push({lineTotalIdr: lineTotal.toString()});
  }
  const fees = boundedMoney(
    parseMoneyIdr(adjustment.deliveryIdr === undefined ? '0' : adjustment.deliveryIdr)
      + parseMoneyIdr(adjustment.serviceFeeIdr === undefined ? '0' : adjustment.serviceFeeIdr),
    'FEES_LIMIT',
  );
  const discount = discountAmount(adjustment.discount, subtotal);
  const total = boundedMoney(subtotal - discount + fees, 'TOTAL_LIMIT');
  return {
    items: lines,
    subtotalIdr: subtotal.toString(),
    discountIdr: discount.toString(),
    feesIdr: fees.toString(),
    totalIdr: total.toString(),
  };
}
