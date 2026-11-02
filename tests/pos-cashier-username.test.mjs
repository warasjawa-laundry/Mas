import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeCashierUsername } from '../lib/pos/cashier-username.ts';

test('owner-generated cashier ID has exactly four decimal digits', () => {
 for(const x of ['MAS-0001','MAS-0002','MAS-0100','MAS-9999'])assert.equal(normalizeCashierUsername(x),x);
 assert.equal(normalizeCashierUsername(' mas-0007 '),'MAS-0007');
});
test('reserved zero and malformed IDs fail closed',()=>{
 for(const x of ['MAS-0000','MAS-10000','MAS-1','MJL-0001','MAS-12AB','MAS-１２３４','MAS-999','MAS-0001-x','MAS 0001',null,undefined,{},[],'', 'MAS-0001\nMAS-0002'])
  assert.equal(normalizeCashierUsername(x),null,String(x));
});
test('cashier login no longer requires owner device pairing, still requires two opaque session cookies',()=>{
 const actions=readFileSync('app/kasir/actions.ts','utf8');
 const page=readFileSync('app/kasir/page.tsx','utf8');
 const migration=readFileSync('supabase/migrations/20261102093000_pos_cashier_direct_id_login.sql','utf8');
 const device=readFileSync('lib/pos/cashier-device.ts','utf8');
 assert.match(actions,/laundry_pos_cashier_direct_id_login/);
 assert.match(actions,/normalizeCashierUsername/);
 assert.match(actions,/CASHIER_DEVICE_COOKIE/);
 assert.match(actions,/CASHIER_LOGIN_COOKIE/);
 assert.match(actions,/cashierLoginCookieOptions/);
 assert.doesNotMatch(actions,/validCashierDeviceToken\(deviceToken\)\) redirect/);
 assert.doesNotMatch(page,/isCashierDevicePaired\(\)|Perangkat belum diaktifkan/);
 assert.match(page,/form action=\{loginCashier\}/);
 assert.doesNotMatch(page,/name="password"/);
 assert.match(page,/Masuk sebagai pemilik/);
 assert.match(device,/laundry_pos_cashier_logged_in/);
 assert.match(migration,/pos_cashier_id_login_throttle/);
 assert.match(migration,/login_origin='DIRECT_ID'/);
 assert.match(migration,/issued_by is null/);
 assert.match(migration,/interval '12 hours'/);
 assert.match(migration,/attempts>=10/);
 assert.doesNotMatch(migration,/set write_enabled\s*=\s*true/i);
});