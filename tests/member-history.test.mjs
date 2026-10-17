import { test } from "node:test";
import assert from "node:assert/strict";
import { loadMemberHistory, historyPageNumber, historyPageHref } from "../lib/laundry/member-history.ts";

const member = "00000000-0000-4000-8000-000000000012";
const otherMember = "00000000-0000-4000-8000-000000000099";
const event = (n, extra = {}) => ({ id: String(n).padStart(3,"0"), member_id: member,
  event_type: "ADD", reverses_event_id: null, occurred_at: "2026-10-17T01:00:00Z", ...extra });

function fixture({ events = [], amounts = [], failAmounts = false, failReversals = false, failHistory = false } = {}) {
  const calls = [];
  const db = { from(table) {
    const call = { table, filters: [], orders: [], range: null, count: false };
    calls.push(call);
    const query = {
      select(_columns, options) { call.count = !!options?.count; return query; },
      eq(key, value) { call.filters.push(row => row[key] === value); return query; },
      in(key, values) { call.filters.push(row => values.includes(row[key])); return query; },
      order(key, options) { call.orders.push([key, options.ascending]); return query; },
      range(start, end) { call.range = [start,end]; return query; },
      then(resolve) {
        const failed = table === "laundry_amount_transactions" ? failAmounts : call.range ? failHistory : failReversals;
        if (failed) return Promise.resolve({ data: null, count: null, error: { message: "synthetic timeout" } }).then(resolve);
        let rows = (table === "laundry_amount_transactions" ? amounts : events).filter(row => call.filters.every(f => f(row)));
        rows = [...rows].sort((a,b) => {
          for (const [key, asc] of call.orders) {
            if (a[key] !== b[key]) return (a[key] < b[key] ? -1 : 1) * (asc ? 1 : -1);
          }
          return 0;
        });
        const count = call.count ? rows.length : null;
        if (call.range) rows = rows.slice(call.range[0], call.range[1]+1);
        return Promise.resolve({ data: rows, count, error: null }).then(resolve);
      },
    };
    return query;
  }};
  return { db, calls };
}

test("history pagination reaches older transactions with deterministic timestamp ties", async () => {
  const { db, calls } = fixture({ events: Array.from({ length: 65 }, (_, i) => event(i+1)) });
  const first = await loadMemberHistory(db, member, 1);
  const second = await loadMemberHistory(db, member, 2);
  const third = await loadMemberHistory(db, member, 3);
  assert.equal(first.count,65);
  assert.equal(first.events[0].id,"065");
  assert.equal(second.events[0].id,"035");
  assert.equal(third.events.length,5);
  assert.equal(first.hasOlder,true);
  assert.equal(third.hasOlder,false);
  assert.equal(new Set([...first.events,...second.events,...third.events].map(x=>x.id)).size,65);
  assert.deepEqual(calls.filter(x=>x.range).map(x=>x.range),[[0,29],[30,59],[60,89]]);
});

test("older-page ADD resolves its amount and VOID from a newer page, under member scope", async () => {
  const { db } = fixture({
    events: [event(1), ...Array.from({ length: 31 },(_, i)=>event(i+2)),
      event(100,{event_type:"VOID",reverses_event_id:"001"}),
      event(101,{member_id:otherMember,event_type:"VOID",reverses_event_id:"002"})],
    amounts: [{visit_event_id:"001",member_id:member,amount_idr:50000,awarded_points:5},
      {visit_event_id:"002",member_id:otherMember,amount_idr:999,awarded_points:0}],
  });
  const page = await loadMemberHistory(db,member,2);
  assert.equal(page.events.some(x=>x.id==="001"),true);
  assert.equal(page.amounts.get("001").awarded_points,5);
  assert.equal(page.corrected.has("001"),true);
  assert.equal(page.corrected.has("002"),false);
  assert.equal(page.amounts.has("002"),false);
});

test("amount failure is explicit while history remains readable", async () => {
  const { db } = fixture({events:[event(1)],failAmounts:true});
  const result = await loadMemberHistory(db,member,1);
  assert.equal(result.failed,false);
  assert.equal(result.amountsFailed,true);
  assert.equal(result.events.length,1);
  assert.equal(result.amounts.size,0);
});

test("VOID lookup failure is explicit so UI can disable uncertain cancellation", async () => {
  const { db } = fixture({events:[event(1)],failReversals:true});
  const result = await loadMemberHistory(db,member,1);
  assert.equal(result.reversalsFailed,true);
  assert.equal(result.failed,false);
});

test("empty and failed pages do not fetch unbounded transaction metadata", async () => {
  for (const options of [{},{events:[event(1)],failHistory:true}]) {
    const { db, calls } = fixture(options);
    const result = await loadMemberHistory(db,member,1);
    assert.equal(result.events.length,0);
    assert.equal(calls.length,1);
    assert.equal(result.failed,!!options.failHistory);
  }
});

test("page input is bounded and links retain member and history location", () => {
  for (const raw of [undefined,"0","-1","1.5","1e2","10000","junk"]) assert.equal(historyPageNumber(raw),1);
  assert.equal(historyPageNumber("25"),25);
  assert.equal(historyPageHref(member,2),`/admin/members/${member}?historyPage=2#transaction-history`);
});
