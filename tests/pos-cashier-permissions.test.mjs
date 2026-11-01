import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CASHIER_PERMISSIONS, hasCashierGrant, parseCashierGrants } from '../lib/pos/cashier-permissions.ts';

test('cashier grant names are unique and never allow owner-only capabilities', () => {
  const keys = CASHIER_PERMISSIONS.map(([key]) => key);
  assert.equal(new Set(keys).size, keys.length);
  for (const forbidden of ['owner', 'owner_login', 'point_rule_edit', 'card_reissue', 'staff_manage', 'outlet_create', 'member_bulk_export']) {
    assert.ok(!keys.includes(forbidden));
  }
});
test('owner-provisioned permission form has a narrow allowlist and defaults deny', () => {
  const fields = new FormData();
  fields.set('permit_order_view', 'on');
  fields.set('permit_member_lookup', 'on');
  fields.set('permit_payment_collect', 'off');
  fields.set('permit_owner', 'on');
  fields.set('permit_refund_full', 'surprise');
  const p = parseCashierGrants(fields);
  assert.deepEqual(p, { order_view:true, member_lookup:true });
  assert.equal(hasCashierGrant(p,'payment_collect'),false);
  assert.equal(hasCashierGrant(p,'refund_full'),false);
  assert.equal(hasCashierGrant(p,'order_view'),true);
});
test('malformed rights never become true by truthiness or prototype inheritance', () => {
  for (const v of [null,undefined,[],false,'granted', {order_create:1},{order_create:'true'}]) {
    assert.equal(hasCashierGrant(v,'order_create'),false);
  }
});