import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildReceipt,receiptWhatsAppUrl,normalizeReceiptPhone} from '../lib/pos/receipt.ts';
const receipt={invoice:'MJL-QA-001',customer:'QA Customer',actor:'QA Kasir',created_at:'2026-11-01T12:09:00Z',due_at:'2026-11-04T12:09:00Z',
 ready_at:'2026-11-04T12:00:00Z',collected_at:null,work_status:'READY',kind:'READY',package:'Reguler',minutes:4320,
 perfume:'Sakura',notes:null,total:'19600',paid:'10000',refunded:'0',remaining:'9600',status:'PARTIAL',
 contact:{phone:'+6280000000000',address:'Alamat QA',verified_at:'2026-11-01T12:09:00Z'},
 member:{year:2026,balance:'8',awarded:0,projected:1},settings:{revision:1,config:{outlet_name:'QA Laundry',address:'QA',contact:'QA',ready_title:'SIAP DIAMBIL',new_title:'',collected_title:'SUDAH DIAMBIL',terms:'Ketentuan QA',payment_notice:'Pembayaran di awal',bank:'Bank QA',ewallet:'Wallet QA',cs:'CS QA'}},
 items:[{name:'Setrika',package:'Reguler',duration:'4320 menit',quantity_milli:4900,unit:'kg',price:'4000',subtotal:'19600'}]};
test('ready receipt distinguishes DP and pending points from the live balance',()=>{
 const text=buildReceipt(receipt);assert.match(text,/Sisa Tagihan : Rp9.600/);assert.match(text,/Total Poin Aktif : 8 poin/);
 assert.match(text,/menunggu pelunasan/);assert.match(text,/Perkiraan Total Setelah Lunas : 9 poin/);assert.match(text,/melunasi Rp9.600/);
 assert.match(text,/4,9 kg/);assert.doesNotMatch(text,/Total Poin Aktif : 9 poin/);
});
test('settled initial receipt uses posted points and guest receipt has no point block',()=>{
 const paid={...receipt,kind:'NEW',paid:'19600',remaining:'0',status:'PAID',member:{year:2026,balance:'9',awarded:1,projected:null}};
 assert.match(buildReceipt(paid),/Poin Transaksi : \+1 poin/);assert.match(buildReceipt(paid),/Total Poin Aktif : 9 poin/);
 assert.doesNotMatch(buildReceipt({...paid,member:null}),/POIN MEMBER/);
 assert.match(buildReceipt({...receipt,paid:'0',remaining:'19600',status:'UNPAID'}),/pembayaran Rp19.600/);
});
test('WhatsApp requires a verified destination and only creates a manual URL',()=>{
 assert.equal(receiptWhatsAppUrl(null,'draft'),null);assert.equal(receiptWhatsAppUrl({...receipt.contact,verified_at:null},'draft'),null);
 assert.equal(receiptWhatsAppUrl(receipt.contact,'A & B'),'https://wa.me/6280000000000?text=A%20%26%20B');
 assert.equal(normalizeReceiptPhone('082313359989'),'+6282313359989');assert.equal(normalizeReceiptPhone('javascript:alert(1)'),null);
});
test('inconsistent money and premature ready/collected receipts fail closed',()=>{
 assert.throws(()=>buildReceipt({...receipt,remaining:'0'}));assert.throws(()=>buildReceipt({...receipt,work_status:'QUEUED'}));
 assert.throws(()=>buildReceipt({...receipt,kind:'COLLECTED',work_status:'COLLECTED'}));
});

test('delivery fee is displayed separately and reconciled into WhatsApp total',()=>{
 const billed={...receipt,total:'22600',remaining:'12600',service_subtotal:'19600',fees_idr:'3000',discount_idr:'0',delivery:{code:'NEAR',name:'Dekat',amount_idr:'3000'}};
 const txt=buildReceipt(billed);
 assert.match(txt,/Total Layanan : Rp19.600/);assert.match(txt,/Antar-Jemput \(Dekat\) : Rp3.000/);
 assert.match(txt,/Total Tagihan : Rp22.600/);assert.match(txt,/Sisa Tagihan : Rp12.600/);
 assert.throws(()=>buildReceipt({...billed,total:'19600',remaining:'9600'}),/Total nota dan biaya tambahan/);
});

test('test receipts never resemble a real payment receipt or expose bank instructions',()=>{
 const testReceipt={...receipt,is_test_order:true,kind:'NEW',status:'PAID',paid:'19600',remaining:'0',member:null};
 const text=buildReceipt(testReceipt);
 assert.match(text,/NOTA UJI - SIMULASI/);assert.match(text,/BUKAN BUKTI PEMBAYARAN/);
 assert.match(text,/PEMBAYARAN SIMULASI/);
 assert.doesNotMatch(text,/Bank QA|Wallet QA|Pembayaran di awal/);
 assert.equal(receiptWhatsAppUrl(testReceipt.contact,text,true),null);
 assert.throws(()=>buildReceipt({...testReceipt,member:receipt.member}));
});
