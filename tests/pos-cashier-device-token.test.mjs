import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { newCashierDeviceToken, validCashierDeviceToken, cashierTokenSha256 } from '../lib/pos/cashier-device-token.ts';

test('device credentials have 256 bits entropy, are canonical and unique', () => {
  const tokens = Array.from({ length:100 }, newCashierDeviceToken);
  assert.equal(new Set(tokens).size, tokens.length);
  for (const t of tokens) {
    assert.equal(t.length,43);
    assert.equal(validCashierDeviceToken(t),true);
    assert.equal(cashierTokenSha256(t),createHash('sha256').update(t,'utf8').digest('hex'));
  }
});
test('reject malformed, trivial and noncanonical device tokens', () => {
  const token = newCashierDeviceToken();
  for (const candidate of ['', token + '=', ' ' + token, token + ' ', token.toUpperCase() + '!',
      'a'.repeat(20), 'a'.repeat(44), null, undefined, {}, true, 12]) {
    assert.equal(validCashierDeviceToken(candidate),false);
  }
  assert.throws(() => cashierTokenSha256('invalid'),/INVALID_DEVICE_TOKEN/);
});