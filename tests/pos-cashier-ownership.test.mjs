import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(file, 'utf8');

test('owner management is guarded server-side and never creates employee credentials', () => {
  const page = read('app/admin/pos/kasir/page.tsx');
  const actions = read('app/admin/pos/kasir/actions.ts');
  assert.match(page, /await requireOwner\(\)/);
  for (const fn of ['saveCashier','removeCashier','revokeCashierDevices','activateCashierDevice']) {
    assert.match(actions,new RegExp(`export async function ${fn}\\(`));
  }
  assert.ok((actions.match(/await requireOwner\(\)/g)??[]).length >= 4);
  assert.doesNotMatch(page, /type=["']password["']/);
  assert.doesNotMatch(actions, /signUp\(|createUser\(|inviteUser/);
});

test('owner session is removed when the device is paired; device is limited to 7 days', () => {
  const actions = read('app/admin/pos/kasir/actions.ts');
  const device = read('lib/pos/cashier-device.ts');
  const sql = read('supabase/migrations/20261101155000_pos_single_outlet_owner_managed_cashier.sql');
  assert.match(actions,/supabase\.auth\.signOut\(\{ scope: "local" \}\)/);
  assert.match(actions,/ADMIN_ACCESS_COOKIE/);
  assert.match(actions,/ADMIN_ENTRY_COOKIE/);
  assert.match(actions,/jar\.set\(CASHIER_DEVICE_COOKIE, token/);
  assert.match(device,/httpOnly: true/);
  assert.match(device,/sameSite: "strict"/);
  assert.match(sql,/clock_timestamp\(\)\+interval '7 days'/);
  assert.match(sql,/extensions\.digest\(p_token,'sha256'\)/);
});

test('only one fixed outlet is seeded; no business permission or financial write is activated', () => {
  const sql = read('supabase/migrations/20261101155000_pos_single_outlet_owner_managed_cashier.sql');
  const page = read('app/kasir/page.tsx');
  assert.match(sql,/constraint laundry_pos_outlets_only_one unique \(singleton_key\)/);
  assert.match(sql,/values \('MJL','Mas Jawa Laundry'/);
  assert.match(sql,/true,false\)/);
  assert.doesNotMatch(sql,/update public\.laundry_pos_outlets set write_enabled\s*=\s*true/i);
  assert.match(page,/getCashierSession\(\)/);
  assert.match(page,/Modul transaksi belum diaktifkan/);
});