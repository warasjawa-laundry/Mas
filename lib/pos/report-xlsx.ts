import {Buffer} from 'node:buffer';

type Row = Record<string, unknown>;
type Cell = string | number | {date: string};
const MAX_ROWS=10000, MAX_BYTES=20*1024*1024;
const ERROR='Data ekspor tidak lengkap atau terlalu banyak. Persempit periode laporan.';
export class ReportExportError extends Error {constructor(){super(ERROR);this.name='ReportExportError';}}
function fail():never{throw new ReportExportError();}
function record(v:unknown):Row{if(!v||typeof v!=='object'||Array.isArray(v))fail();return v as Row;}
function list(v:unknown):Row[]{if(!Array.isArray(v)||v.length>MAX_ROWS)fail();return v.map(record);}
function text(v:unknown):string{if(v==null)return '';if(typeof v!=='string'||v.length>32767)fail();return v;}
function number(v:unknown):number{if(typeof v!=='string'&&typeof v!=='number')fail();if(!/^\d+(\.\d{1,3})?$/.test(String(v)))fail();const n=Number(v);if(!Number.isFinite(n)||n>999999999999999)fail();return n;}
function date(v:unknown):{date:string}{const d=text(v);if(!/^\d{4}-\d{2}-\d{2}T/.test(d)||!Number.isFinite(Date.parse(d)))fail();return {date:d};}
function sum(rows:Row[],key:string){const n=rows.reduce((total,row)=>total+number(row[key]),0);if(!Number.isSafeInteger(n)||n>999999999999999)fail();return n;}
function xml(v:string){return v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
function col(i:number):string{let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;}
function sheet(rows:Cell[][],money:number[]=[],quantity:number[]=[],summary=false){
 const width=rows[0].length;
 const body=rows.map((row,r)=>`<row r="${r+1}">${row.map((v,c)=>{
  const ref=`${col(c)}${r+1}`;
  if(typeof v==='string')return `<c r="${ref}" t="inlineStr"${r===0?' s="1"':''}><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  if(typeof v==='number')return `<c r="${ref}" s="${summary?(r>=6&&r<=14||r>=20?2:r>=16&&r<=18?3:0):money.includes(c)?2:quantity.includes(c)?3:0}"><v>${v}</v></c>`;
  // Excel dates have no time zone: shift the UTC instant to the WIB wall clock.
  const serial=(Date.parse(v.date)+7*3600000)/86400000+25569;
  return `<c r="${ref}" s="4"><v>${serial}</v></c>`;
 }).join('')}</row>`).join('');
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${col(width-1)}${rows.length}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${Array.from({length:width},(_,i)=>`<col min="${i+1}" max="${i+1}" width="${i===0?26:23}" customWidth="1"/>`).join('')}</cols><sheetData>${body}</sheetData><autoFilter ref="A1:${col(width-1)}${rows.length}"/></worksheet>`;
}

// ZIP method 0 keeps the export dependency free. CRC and directory offsets are
// written explicitly; the hard size limit bounds server memory and ZIP32 sizes.
function crc32(data:Buffer){let crc=0xffffffff;for(const byte of data){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function zip(files:Record<string,string>):Buffer{
 const chunks:Buffer[]=[],central:Buffer[]=[];let offset=0;
 for(const [path,value] of Object.entries(files)){
  const name=Buffer.from(path),data=Buffer.from(value);if(offset+data.length>MAX_BYTES)fail();
  const crc=crc32(data),local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(33,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);
  const entry=Buffer.alloc(46);entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(0x800,8);entry.writeUInt16LE(33,14);entry.writeUInt32LE(crc,16);entry.writeUInt32LE(data.length,20);entry.writeUInt32LE(data.length,24);entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(offset,42);
  chunks.push(local,name,data);central.push(entry,name);offset+=local.length+name.length+data.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...chunks,directory,end]);
}

export function buildReportXlsx(value:unknown):Buffer{
 const data=record(value),summary=record(data.summary);
 if(data.schema_version!==3||data.balance_scope!=='CURRENT'||data.truncated===true||summary.truncated===true)fail();
 const orders=list(data.orders),items=list(data.items),cash=list(data.cash);
 let inputBytes=0;for(const rows of [orders,items,cash])for(const row of rows)for(const value of Object.values(row)){if(typeof value==='string')inputBytes+=Buffer.byteLength(value);if(inputBytes>MAX_BYTES/6)fail();}
 const start=date(data.start),end=date(data.end);
 const created=orders.filter(o=>o.created_in_period===true),periodItems=items.filter(i=>i.created_in_period===true);
 const ids=new Map<string,Row>(),invoices=new Set<string>();for(const o of orders){const id=text(o.id),invoice=text(o.invoice);if(!id||ids.has(id)||!invoice||invoices.has(invoice))fail();ids.set(id,o);invoices.add(invoice);if(typeof o.created_in_period!=='boolean')fail();}
 const cashIds=new Set<string>();for(const c of cash){const id=text(c.id);if(!id||cashIds.has(id)||!['IN','OUT'].includes(text(c.direction)))fail();cashIds.add(id);if(c.order_id!=null&&(!ids.has(text(c.order_id))||c.invoice!==ids.get(text(c.order_id))?.invoice))fail();}
 for(const i of items){const o=ids.get(text(i.order_id));if(!o||i.invoice!==o.invoice||i.created_in_period!==o.created_in_period||!['kg','m','pcs'].includes(text(i.unit))||typeof i.created_in_period!=='boolean')fail();const q=number(i.quantity_milli);if(!Number.isInteger(q)||q<=0||(i.unit==='pcs'&&q%1000!==0))fail();}
 const incoming=cash.filter(c=>c.direction==='IN'),outgoing=cash.filter(c=>c.direction==='OUT');
 const totals:Cell[][]=[['Keterangan','Nilai'],['Mulai periode (WIB)',start],['Batas akhir eksklusif (WIB)',end],['Cakupan saldo','Kondisi terkini (CURRENT), bukan saldo akhir periode'],['Cakupan nota','Nota dibuat dalam periode; daftar juga mencakup nota lama dengan mutasi dalam periode'],['Total nota dibuat dalam periode',created.length],['Total tagihan nota dibuat dalam periode',sum(created,'total')],['Pembayaran diterima dalam periode',sum(incoming.filter(c=>c.category==='PAYMENT'),'amount')],['Refund dalam periode',sum(outgoing.filter(c=>c.category==='REFUND'),'amount')],['Piutang terkini nota dibuat dalam periode',sum(created,'remaining')],['Kas masuk tunai dalam periode',sum(incoming.filter(c=>c.method==='CASH'),'amount')],['Kas masuk non-tunai dalam periode',sum(incoming.filter(c=>c.method!=='CASH'),'amount')],['Kas keluar dalam periode',sum(outgoing,'amount')],['Kas keluar non-penjualan (semua klasifikasi)',sum(outgoing.filter(c=>c.category==='NON_SALE_OUT'),'amount')],['Kas masuk non-penjualan (semua klasifikasi)',sum(incoming.filter(c=>c.category!=='PAYMENT'),'amount')],['Saldo dibayar/refund/sisa pada Daftar Nota','Kondisi terkini untuk setiap nota; refund disajikan terpisah']];
 for(const unit of ['kg','m','pcs'])totals.push([`Kuantitas ${unit} nota dibuat dalam periode`,sum(periodItems.filter(i=>i.unit===unit),'quantity_milli')/1000]);
 totals.push(['Status data',data.pilot_test_only===true||orders.some(o=>o.is_test_order===true)?'MODE UJI / MEMUAT DATA UJI. Bukan bukti penerimaan uang nyata.':data.pilot_test_only===false?'Sesuai catatan database. Periksa penanda Nota uji pada setiap baris.':'Status mode belum dipastikan. Periksa pengaturan dan penanda Nota uji sebelum memakai laporan.']);
 const notes:Cell[][]=[['Nomor nota','Tanggal masuk (WIB)','Pelanggan','Pembuat','Total (Rp)','Dibayar terkini (Rp)','Sisa terkini (Rp)','Status terkini','Refund terkini (Rp)','Dibuat dalam periode','Nota uji']];
 for(const o of orders)notes.push([text(o.invoice),date(o.created_at),text(o.customer),text(o.creator),number(o.total),number(o.paid),number(o.remaining),text(o.status),number(o.refunded),o.created_in_period?'Ya':'Tidak',o.is_test_order?'Ya':'Tidak']);
 const detail:Cell[][]=[['Nomor nota','Layanan','Paket','Jumlah','Satuan','Harga/satuan (Rp)','Subtotal (Rp)','Nota dibuat dalam periode']];
 for(const i of items)detail.push([text(i.invoice),text(i.name),text(i.package),number(i.quantity_milli)/1000,text(i.unit),number(i.price),number(i.subtotal),i.created_in_period?'Ya':'Tidak']);
 totals.push(['Pengeluaran operasional terklasifikasi',sum(outgoing.filter(c=>c.accounting_classification==='EXPENSE'),'amount')],['Modal keluar (bukan biaya)',sum(outgoing.filter(c=>c.accounting_classification==='EQUITY'),'amount')],['Modal masuk (bukan pendapatan)',sum(incoming.filter(c=>c.accounting_classification==='EQUITY'),'amount')],['Transfer antar kas keluar (bukan biaya)',sum(outgoing.filter(c=>c.accounting_classification==='TRANSFER'),'amount')],['Transfer antar kas masuk (bukan pendapatan)',sum(incoming.filter(c=>c.accounting_classification==='TRANSFER'),'amount')],['Belum dikategorikan: kas keluar historis',sum(outgoing.filter(c=>c.category==='NON_SALE_OUT'&&!c.expense_category_code),'amount')],['Belum dikategorikan: kas masuk historis',sum(incoming.filter(c=>c.category==='NON_SALE_IN'&&!c.expense_category_code),'amount')]);
 const expenseCodes=new Set(outgoing.filter(c=>c.accounting_classification==='EXPENSE').map(c=>text(c.expense_category_code)));
 for(const code of expenseCodes){const group=outgoing.filter(c=>c.accounting_classification==='EXPENSE'&&c.expense_category_code===code);totals.push([`Biaya: ${text(group[0].expense_category_label)||code}`,sum(group,'amount')]);}
 const movement:Cell[][]=[['Tanggal (WIB)','Nomor nota','Jenis','Metode','Masuk (Rp)','Keluar (Rp)','Petugas','Pelanggan','Catatan','Kode kategori','Kategori terstruktur','Perlakuan akuntansi']];
 const category:Record<string,string>={PAYMENT:'Pembayaran',REFUND:'Refund',NON_SALE_IN:'Kas masuk non-penjualan',NON_SALE_OUT:'Kas keluar non-penjualan',OPENING:'Saldo awal',MANUAL:'Mutasi lainnya'};
 for(const c of cash)movement.push([date(c.at),text(c.invoice),category[text(c.category)]??text(c.category),c.method==='CASH'?'Tunai':c.method==='NONCASH'?'Non-tunai':text(c.method),c.direction==='IN'?number(c.amount):0,c.direction==='OUT'?number(c.amount):0,text(c.actor),text(c.customer),text(c.note),text(c.expense_category_code),text(c.expense_category_label)||(['NON_SALE_IN','NON_SALE_OUT'].includes(text(c.category))?'Belum dikategorikan (histori)':''),text(c.accounting_classification)]);
 const names=['Ringkasan','Daftar Nota','Rincian Layanan','Mutasi Kas'];
 const files:Record<string,string>={
  '[Content_Types].xml':`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${names.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
  '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n,i)=>`<sheet name="${n}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><calcPr calcId="0"/></workbook>`,
  'xl/_rels/workbook.xml.rels':`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  'xl/styles.xml':'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="[$Rp-421] #,##0"/><numFmt numFmtId="165" formatCode="0.###"/><numFmt numFmtId="166" formatCode="dd/mm/yyyy hh:mm &quot;WIB&quot;"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
  'xl/worksheets/sheet1.xml':sheet(totals,[],[],true),'xl/worksheets/sheet2.xml':sheet(notes,[4,5,6,8]),'xl/worksheets/sheet3.xml':sheet(detail,[5,6],[3]),'xl/worksheets/sheet4.xml':sheet(movement,[4,5]),
 };
 return zip(files);
}

export function reportXlsxResponse(data:unknown,start:string,end:string):Response{
 try{return new Response(new Uint8Array(buildReportXlsx(data)),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="masjawa-laporan-${start}-${end}.xlsx"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
 catch(error){if(error instanceof ReportExportError)return new Response(error.message,{status:422,headers:{'Cache-Control':'private, no-store'}});throw error;}
}
