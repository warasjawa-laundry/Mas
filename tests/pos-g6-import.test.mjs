import {test} from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { parseBinatuReport, escapeCsv } from '../lib/pos/g6-import.ts';
import { reportingPeriod, parseCashEntry, parseCloseShift } from '../lib/pos/g6-cash.ts';

const HEADER='NO,NOTA,TANGGAL MASUK,ESTIMASI SELESAI,TANGGAL DISIAPKAN,TANGGAL SELESAI,PELANGGAN,DURASI,LAYANAN,KILOAN,SATUAN,METERAN,HARGA LAYANAN,HARGA ANTAR,DISKON,HARGA AKHIR,STATUS,PEMBAYARAN,BELUM BAYAR,SUDAH BAYAR,DIBUAT OLEH,PEMBAYARAN OLEH,DIBATALKAN OLEH';
const row=(n,invoice,name,payment,total,paid)=>`${n},${invoice},,,,,${name},,,0,0,0,${total},0,0,${total},antrian,${payment},0,${paid},,,`;
const csv=(a)=>Buffer.from(HEADER+'\r\n'+a.join('\r\n'),'utf8');

// A tiny synthetic standards-compliant XLSX ZIP; no customer data in the repo.
function zip(xmlFiles){
 const local=[],central=[];let offset=0;
 for(const [file,source] of Object.entries(xmlFiles)){
  const name=Buffer.from(file),plain=Buffer.from(source),packed=deflateRawSync(plain);
  const lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(8,8);
  lh.writeUInt32LE(packed.length,18);lh.writeUInt32LE(plain.length,22);lh.writeUInt16LE(name.length,26);
  local.push(lh,name,packed);
  const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(8,10);
  ch.writeUInt32LE(packed.length,20);ch.writeUInt32LE(plain.length,24);ch.writeUInt16LE(name.length,28);ch.writeUInt32LE(offset,42);
  central.push(ch,name);offset+=lh.length+name.length+packed.length;
 }
 const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);
 end.writeUInt16LE(Object.keys(xmlFiles).length,8);end.writeUInt16LE(Object.keys(xmlFiles).length,10);
 end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,cd,end]);
}
const xmlHeader=['NO','NOTA','PELANGGAN','PEMBAYARAN','HARGA AKHIR','SUDAH BAYAR','STATUS'];
const letters=['A','B','C','D','E','F','G'];
function xlsx(formula=false){
 const makeRow=(num,values)=>`<row r="${num}">${values.map((v,i)=>`<c r="${letters[i]}${num}" t="inlineStr"><is><t>${v}</t></is></c>`).join('')}</row>`;
 return zip({'xl/workbook.xml':'<workbook><sheets><sheet name="Worksheet" sheetId="1" r:id="rId1" /></sheets></workbook>',
 'xl/worksheets/sheet1.xml':`<worksheet><sheetData>${makeRow(9,xmlHeader)}${makeRow(10,['1','BNT-007','Pelanggan Sintetis','lunas - tunai','25000','25000','siap ambil'])}${formula?'<row r="11"><c r="B11"><f>HYPERLINK("bad")</f><v>1</v></c></row>':''}</sheetData></worksheet>`});
}
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('Binatu CSV: exact column mapping, payment statuses and quote escaping',()=>{
 const data=parseBinatuReport('binatu.csv',csv([row(1,'BNT-001','Pelanggan Sintetis','lunas - tunai',25000,25000),
 row(2,'BNT-002','Tamu Sintetis','belum bayar',10000,0)]));
 assert.equal(data.length,2);assert.equal(data[0].payment,'PAID');assert.equal(data[1].payment,'UNPAID');
 assert.equal(data[0].invoice,'BNT-001');assert.equal(data[0].total,'25000');
 assert.match(escapeCsv('=HYPERLINK("x")'),/^"'=HYPERLINK/);
 assert.match(escapeCsv(' -10'),/^"' -10/);assert.equal(escapeCsv('BNT-001'), '"BNT-001"');
});
test('XLSX first sheet reads synthetic Binatu layout without client libraries',()=>{
 const rows=parseBinatuReport('laporan.xlsx',xlsx());
 assert.equal(rows.length,1);assert.equal(rows[0].payment,'PAID');assert.equal(rows[0].invoice,'BNT-007');
});
test('Reject active formulas and malformed files instead of executing or guessing',()=>{
 assert.throws(()=>parseBinatuReport('unsafe.xlsx',xlsx(true)),/Rumus|XML eksternal/);
 assert.throws(()=>parseBinatuReport('unsafe.xlsm',xlsx()),/Hanya CSV/);
 assert.throws(()=>parseBinatuReport('bad.xlsx',Buffer.from('not-a-zip-file-long-enough')),/ZIP|XLSX/);
 assert.throws(()=>parseBinatuReport('bad.csv',Buffer.from('invoice,name\n1,abc')),/Header Binatu/);
});
test('Importer bounds row count and fails suspicious money',()=>{
 const lines=Array.from({length:201},(_,i)=>row(i+1,`BNT-${i+1}`,'Pelanggan QA','lunas - tunai',25000,25000));
 assert.throws(()=>parseBinatuReport('many.csv',csv(lines)),/Maksimum 200/);
 assert.throws(()=>parseBinatuReport('bad.csv',csv([row(1,'BNT-1','Pelanggan QA','lunas - tunai',10000,15000)])),/melebihi total/);
});
test('WIB reporting uses half-open UTC boundaries incl. month boundary',()=>{
 const v=reportingPeriod('2026-10-31','2026-11-02');
 assert.deepEqual(v,{p_start:'2026-10-30T17:00:00.000Z',p_end:'2026-11-01T17:00:00.000Z'});
 assert.equal(reportingPeriod('2026-02-30','2026-03-01'),null);
 assert.equal(reportingPeriod('2026-11-02','2026-11-02'),null);
 assert.equal(reportingPeriod('2026-01-01','2026-07-01'),null);
});
test('Cash mutations parse bounded IDR, UUID and explanatory notes',()=>{
 const form=new FormData();form.set('requestId',id);form.set('amountIdr','5000');form.set('direction','OUT');form.set('reason','Beli plastik');
 assert.deepEqual(parseCashEntry(form),{requestId:id,amountIdr:'5000',direction:'OUT',reason:'Beli plastik'});
 form.set('amountIdr','5000.5');assert.equal(parseCashEntry(form),null);
 const close=new FormData();close.set('requestId',id);close.set('countedIdr','0');close.set('reason','');
 assert.deepEqual(parseCloseShift(close),{requestId:id,countedIdr:'0',reason:''});
});