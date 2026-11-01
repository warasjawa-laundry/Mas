import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeCashierUsername } from '../lib/pos/cashier-username.ts';

test('cashier username is exactly MAS-0001..MAS-9999, case-insensitive on input', () => {
  for (const x of ['MAS-0001','MAS-0002','MAS-0100','MAS-9999']) assert.equal(normalizeCashierUsername(x),x);
  assert.equal(normalizeCashierUsername(' mas-0007 '),'MAS-0007');
  assert.equal(normalizeCashierUsername('mas-1234'),'MAS-1234');
});
test('invalid usernames cannot be normalized into an authorized cashier', () => {
  for(const x of ['MAS-0000','MAS-10000','MAS-1','MJL-0001','MAS-123A','MAS-１２３４','MAS-999','MAS-0001-x',
      'MAS 0001','MAS-001 ',null,undefined,1,{},[], '', 'MAS-0001\nMAS-0002'])
    assert.equal(normalizeCashierUsername(x),null,String(x));
});
test('cashier user session needs two independent secrets and owner only provisions the device', () => {
  const device=readFileSync('lib/pos/cashier-device.ts','utf8');
  const actions=readFileSync('app/kasir/actions.ts','utf8');
  const page=readFileSync('app/kasir/page.tsx','utf8');
  const migration=readFileSync('supabase/migrations/20261101172500_pos_cashier_sequential_username_login.sql','utf8');
  assert.match(device,/CASHIER_DEVICE_COOKIE/);
  assert.match(device,/CASHIER_LOGIN_COOKIE/);
  assert.match(device,/laundry_pos_cashier_logged_in/);
  assert.doesNotMatch(device,/\.rpc\("laundry_pos_cashier_session", \{ p_token: token \}\)/);
  assert.match(actions,/laundry_pos_cashier_login/);
  assert.match(actions,/validCashierDeviceToken\(deviceToken\)/);
  assert.match(actions,/normalizeCashierUsername/);
  assert.match(actions,/cashierLoginCookieOptions/);
  assert.match(migration,/p_username=v_device\.username/);
  assert.match(migration,/failed_username_attempts/);
  assert.match(migration,/unique \(username\)/);
  assert.match(page,/form action=\{loginCashier\}/);
  assert.match(page,/Modul transaksi belum diaktifkan/);
  assert.doesNotMatch(page,/name="password"/);
});