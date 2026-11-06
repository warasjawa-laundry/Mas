import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildReceipt} from '../lib/pos/receipt.ts';
import {receipt} from './pos-v3-receipt.fixture.mjs';
test('mixed units retain three decimal precision and nominal snapshots',()=>{
 const text=buildReceipt({...receipt,total:'78704',remaining:'68704',items:[...receipt.items,{...receipt.items[0],quantity_milli:1234,subtotal:'7404'}]});
 for(const line of ['1,25 kg x Rp6.000 = Rp7.500','2,35 m x Rp8.000 = Rp18.800','3 pcs x Rp15.000 = Rp45.000','1,234 kg'])assert.ok(text.includes(line));
 assert.match(text,/Kasir : Kasir Uji/);assert.match(text,/19:09 WIB/);
});
test('full refund does not invent a new customer bill while validating accounting balance',()=>{
 const refunded={...receipt,status:'REFUNDED',paid:'71300',refunded:'71300',remaining:'71300'};
 const text=buildReceipt(refunded);
 assert.match(text,/Sisa Tagihan : Rp0/);assert.match(text,/Status : REFUND/);assert.match(text,/Refund : Rp71.300/);
 assert.doesNotMatch(text,/Pembayaran\nBank outlet/);
 assert.throws(()=>buildReceipt({...refunded,remaining:'0'}),/konsisten/);
});
test('cancelled unpaid invoice shows no payable amount and no payment instructions',()=>{
 const text=buildReceipt({...receipt,work_status:'CANCELLED',status:'UNPAID',paid:'0',remaining:'71300'});
 assert.match(text,/Sisa Tagihan : Rp0/);assert.match(text,/Status : DIBATALKAN/);assert.doesNotMatch(text,/Bank outlet/);
});
test('unsupported partial refund fails closed rather than claiming settled refund',()=>{
 assert.throws(()=>buildReceipt({...receipt,status:'REFUNDED',refunded:'5000',remaining:'66300'}),/Refund sebagian/);
});

