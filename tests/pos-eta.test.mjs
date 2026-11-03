import {test} from 'node:test';
import assert from 'node:assert/strict';
import {durationMinutes,estimateCompletion,formatDurationHours,formatEta} from '../lib/pos/eta.ts';

test('calendar ETA reads the full timestamp and rolls into the next year in WIB',()=>{
 const due=estimateCompletion('2026-12-31T16:30:00.000Z',360);
 assert.equal(due,'2026-12-31T22:30:00.000Z');
 assert.equal(formatEta(due),'01/01/2027 - 05:30 WIB');
});
test('calendar ETA handles month ends and leap years without replacing the month manually',()=>{
 assert.equal(formatEta(estimateCompletion('2026-01-31T03:15:00Z',1440)),'01/02/2026 - 10:15 WIB');
 assert.equal(formatEta(estimateCompletion('2024-02-28T03:15:00Z',1440)),'29/02/2024 - 10:15 WIB');
 assert.equal(formatEta(estimateCompletion('2025-02-28T03:15:00Z',1440)),'01/03/2025 - 10:15 WIB');
});
test('calendar hours include nights and weekends and preserve minutes',()=>{
 assert.equal(formatEta(estimateCompletion('2026-11-01T12:09:00Z',4320)),'04/11/2026 - 19:09 WIB');
 assert.equal(estimateCompletion('2026-12-31T23:59:00+07:00',1),'2026-12-31T17:00:00.000Z');
});
test('only exact owner duration labels become minutes; ranges and unitless labels remain unset',()=>{
 assert.equal(durationMinutes('360 menit'),360);
 assert.equal(durationMinutes('6 jam'),360);
 assert.equal(durationMinutes('2 hari'),2880);
 for(const value of ['1–3 hari','1-2 hari','2-3','','0 jam','1.5 jam','525601 menit'])assert.equal(durationMinutes(value),null,value);
});
test('invalid inputs never show a made-up date or depend on the browser timezone',()=>{
 for(const minutes of [null,undefined,0,-1,1.5,525601,Infinity])assert.equal(estimateCompletion('2026-01-01T00:00:00Z',minutes),null);
 for(const timestamp of ['',null,'invalid','2026-01-01T10:00:00'])assert.equal(estimateCompletion(timestamp,60),null);
 assert.equal(formatEta(null),'Belum dapat dihitung');
});

test('duration package labels use hours while preserving exact calendar minutes',()=>{
 assert.equal(formatDurationHours('4320 menit'),'72 jam');
 assert.equal(formatDurationHours('1440 menit'),'24 jam');
 assert.equal(formatDurationHours('360 menit'),'6 jam');
 assert.equal(formatDurationHours('90 menit'),'1,5 jam');
 assert.equal(formatDurationHours('61 menit'),'≈1,02 jam');
 assert.equal(formatDurationHours('bad'),'Durasi belum diatur');
 assert.equal(durationMinutes('4320 menit'),4320);
});
