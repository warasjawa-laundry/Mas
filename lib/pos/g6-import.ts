/** Restricted Binatu export reader. XLSX = ZIP/XML data only, never formulas/macros.
 * Does not import orders/payments or grant customer points.
 */
import { inflateRawSync } from "node:zlib";

export type ImportRow = {
  row: string; invoice: string; customer: string; payment: "PAID"|"PARTIAL"|"UNPAID"|"UNKNOWN";
  status: "ANTRIAN"|"SIAP_AMBIL"|"SELESAI"|"LAINNYA";
  total: string; paid: string;
};
const MAX_BYTES = 1_500_000, MAX_UNZIP = 4_000_000, MAX_ROWS = 200;
const HEADERS = ["NOTA", "PELANGGAN", "PEMBAYARAN", "SUDAH BAYAR", "HARGA AKHIR", "STATUS"];
const UPPER = (x: string) => x.normalize("NFKC").trim().toUpperCase().replace(/\s+/g," ");
function textCell(v: unknown): string {return String(v ?? "").trim().slice(0,512);}
function money(v: string): string {
 const s = v.trim().replace(/^(?:Rp\s*)/i, "").replace(/\s/g, "");
 if (s === "" || s === "-") return "0";
 // IDR whole amounts, including Indonesian 1.250,00 and spreadsheet 1250.00.
 const normalized=s.replace(/^([0-9]{1,3}(?:\.[0-9]{3})+)(?:,00)?$/,(_,n:string)=>n.replace(/\./g,""))
  .replace(/^([0-9]{1,3}(?:,[0-9]{3})+)(?:\.00)?$/,(_,n:string)=>n.replace(/,/g,""))
  .replace(/^([0-9]+)[.,]00$/,"$1");
 if (!/^(0|[1-9][0-9]{0,9})$/.test(normalized) || BigInt(normalized)>BigInt(1000000000))
  throw new Error("Nominal harus Rupiah bulat 0–1 miliar");
 return normalized;
}
function fromGrid(grid: string[][]): ImportRow[] {
 if (grid.length>260 || grid.some(r=>r.length>35)) throw new Error("Laporan melewati batas baris/kolom");
 const index=grid.findIndex(row=>HEADERS.every(h=>row.some(x=>UPPER(x)===h)));
 if (index<0)throw new Error("Header Binatu tidak cocok: NOTA, PELANGGAN, PEMBAYARAN, SUDAH BAYAR, HARGA AKHIR, STATUS wajib ada");
 const header=grid[index].map(UPPER);
 const col=(x:string)=>header.indexOf(x);
 const result:ImportRow[]=[];
 const footers:{total:string;paid:string}[]=[];
 for (let k=index+1;k<grid.length;k++) {
  const row=grid[k]; const invoice=textCell(row[col("NOTA")]);
  if(!invoice || UPPER(invoice)==="NOTA") continue;
  if (/^(TOTAL|JUMLAH|GRAND TOTAL|SUBTOTAL)\b/i.test(invoice)) {
   const total=textCell(row[col("HARGA AKHIR")]),paid=textCell(row[col("SUDAH BAYAR")]);
   if(total||paid)footers.push({total:money(total),paid:money(paid)});
   continue;
  }
  const customer=textCell(row[col("PELANGGAN")]);
  if(!customer || customer.length<2 || customer.length>120 || invoice.length>100 ||
     /[\x00-\x1f\x7f]/.test(customer+invoice)) throw new Error(`Baris ${k+1}: nota atau pelanggan tidak valid`);
  const total=money(textCell(row[col("HARGA AKHIR")]));
  const paid=money(textCell(row[col("SUDAH BAYAR")]));
  if(BigInt(paid)>BigInt(total))throw new Error(`Baris ${k+1}: pembayaran melebihi total`);
  const raw=UPPER(textCell(row[col("PEMBAYARAN")]));
  let payment:ImportRow["payment"]="UNKNOWN";
  if(raw.startsWith("LUNAS"))payment=BigInt(total)===BigInt(paid)?"PAID":"UNKNOWN";
  else if(raw.includes("BELUM BAYAR") && paid==="0")payment="UNPAID";
  else if(raw.includes("SEBAGIAN")||raw.includes("DP"))payment="PARTIAL";
  else if(BigInt(paid)>BigInt(0) && BigInt(paid)<BigInt(total))payment="PARTIAL";
  const statusValue=UPPER(textCell(row[col("STATUS")]));
  if(/BATAL|CANCEL|VOID/.test(statusValue))payment="UNKNOWN";
  const status:ImportRow["status"]=statusValue==="ANTRIAN"?"ANTRIAN":
     statusValue.includes("SIAP")?"SIAP_AMBIL":statusValue.includes("SELESAI")?"SELESAI":"LAINNYA";
  result.push({row:String(k+1),invoice,customer,payment,status,total,paid});
  if(result.length>MAX_ROWS)throw new Error(`Maksimum ${MAX_ROWS} nota per unggahan`);
 }
 if(!result.length)throw new Error("Tidak ada baris nota yang dapat ditinjau");
 const totals=result.reduce((sum,row)=>({total:sum.total+BigInt(row.total),paid:sum.paid+BigInt(row.paid)}),{total:BigInt(0),paid:BigInt(0)});
 if(footers.some(f=>BigInt(f.total)!==totals.total||BigInt(f.paid)!==totals.paid))throw new Error("Total footer tidak cocok; rekonsiliasi laporan sebelum impor");
 return result;
}
function parseCsv(bytes:Buffer):string[][]{
 const source=new TextDecoder("utf-8",{fatal:true}).decode(bytes).replace(/^\uFEFF/,"");
 const first=source.split(/\r?\n/,1)[0];const delim=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?";":",";
 const rows:string[][]=[];let row:string[]=[],value="",quoted=false;
 for(let i=0;i<source.length;i++){
  const x=source[i];
  if(x==='"') {if(quoted&&source[i+1]==='"'){value+='"';i++;}else if(quoted||value==="") quoted=!quoted;else throw new Error("CSV kutip tidak valid");}
  else if(x===delim&&!quoted){row.push(value);value="";}
  else if((x==='\n'||x==='\r')&&!quoted){if(x==='\r'&&source[i+1]==='\n')i++;row.push(value);rows.push(row);row=[];value="";}
  else {value+=x;if(value.length>512)throw new Error("CSV sel terlalu panjang");}
  if(rows.length>260)throw new Error("CSV terlalu banyak baris");
 }
 if(quoted)throw new Error("CSV kutip tidak ditutup");
 if(value||row.length){row.push(value);rows.push(row);}
 return rows;
}
function xmlUnescape(s:string){
 return s.replace(/&(#(?:x[0-9a-f]+|[0-9]+)|amp|lt|gt|quot|apos);/gi,(m,entity:string)=>{
  const map:Record<string,string>={amp:"&",lt:"<",gt:">",quot:'"',apos:"'"};
  if(map[entity])return map[entity];
  const value=entity[1]?.toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);
  if(!Number.isInteger(value)||value<0||value>0x10ffff||value>=0xd800&&value<=0xdfff)throw new Error("XML entity invalid");
  return String.fromCodePoint(value);
 }).replace(/&(?!(?:amp|lt|gt|quot|apos|#(?:x[0-9a-f]+|[0-9]+));)/i,()=>{throw new Error("XML entity terlarang");});
}
function zipEntries(buffer:Buffer): Map<string,string>{
 // Read central directory instead of trusting zip local header sizes.
 let eocd=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--){if(buffer.readUInt32LE(i)===0x06054b50){eocd=i;break;}}
 if(eocd<0)throw new Error("Bukan file XLSX/ZIP valid");
 const count=buffer.readUInt16LE(eocd+10),offset=buffer.readUInt32LE(eocd+16);
 if(count>100||offset>=buffer.length)throw new Error("File XLSX terlalu kompleks");
 const entries=new Map<string,string>();let total=0,pos=offset;
 for(let i=0;i<count;i++){
  if(pos+46>buffer.length||buffer.readUInt32LE(pos)!==0x02014b50)throw new Error("ZIP directory rusak");
  const flags=buffer.readUInt16LE(pos+8),method=buffer.readUInt16LE(pos+10),
   compressed=buffer.readUInt32LE(pos+20),size=buffer.readUInt32LE(pos+24),
   nameLen=buffer.readUInt16LE(pos+28),extra=buffer.readUInt16LE(pos+30),comment=buffer.readUInt16LE(pos+32),
   local=buffer.readUInt32LE(pos+42);
  const name=buffer.subarray(pos+46,pos+46+nameLen).toString("utf8");
  pos+=46+nameLen+extra+comment;
  if((flags&1)!==0||size>MAX_UNZIP||compressed>MAX_BYTES||(!compressed&&size))throw new Error("ZIP terenkripsi atau terlalu besar");
  if(name.includes("..")||name.startsWith("/")||name.includes("\\"))throw new Error("ZIP path tidak aman");
  if(/(?:externalLinks|vbaProject|macros|embeddings|activeX)/i.test(name))throw new Error("XLSX memiliki konten aktif/eksternal");
  total+=size;if(total>MAX_UNZIP)throw new Error("XLSX dekompresi melebihi batas");
  if(local+30>buffer.length||buffer.readUInt32LE(local)!==0x04034b50)throw new Error("ZIP local header rusak");
  const begin=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28);
  if(begin+compressed>buffer.length)throw new Error("ZIP konten tidak lengkap");
  // Extract ONLY the bounded workbook metadata / first sheet / shared strings.
  if(name!=="xl/worksheets/sheet1.xml"&&name!=="xl/sharedStrings.xml"&&name!=="xl/workbook.xml")continue;
  if(![0,8].includes(method))throw new Error("ZIP compression tidak didukung");
  const raw=buffer.subarray(begin,begin+compressed);
  const inflated=method===0?raw:inflateRawSync(raw,{maxOutputLength:MAX_UNZIP});
  if(inflated.length!==size)throw new Error("ZIP ukuran ekstrak salah");
  const xml=new TextDecoder("utf-8",{fatal:true}).decode(inflated);
  if(/<!DOCTYPE|<!ENTITY|<f\b|<externalReference/i.test(xml))throw new Error("Rumus atau XML eksternal tidak diperbolehkan");
  entries.set(name,xml);
 }
 return entries;
}
function parseXlsx(buf:Buffer):string[][]{
 const xml=zipEntries(buf);
 const sheet=xml.get("xl/worksheets/sheet1.xml");if(!sheet)throw new Error("Sheet pertama XLSX tidak tersedia");
 const workbook=xml.get("xl/workbook.xml")||"";
 if((workbook.match(/<sheet\b/g)||[]).length>1)throw new Error("XLSX harus hanya berisi satu sheet laporan");
 const strings:string[]=[];const shared=xml.get("xl/sharedStrings.xml")||"";
 for(const si of shared.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)){
  strings.push([...si[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(t=>xmlUnescape(t[1])).join(""));
  if(strings.length>10000)throw new Error("XLSX string dictionary terlalu besar");
 }
 const grid:string[][]=[];
 for(const row of sheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)){
  const rowNumber=Number(row[1].match(/\br="([0-9]+)"/)?.[1]);
  if(!Number.isInteger(rowNumber)||rowNumber<1||rowNumber>260)throw new Error("XLSX baris terlalu jauh");
  const values:string[]=[];
  for(const cell of row[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
   const ref=cell[1].match(/\br="([A-Z]+)[0-9]+"/)?.[1]||"";
   let col=0;for(const ch of ref)col=col*26+(ch.charCodeAt(0)-64);
   if(col<1||col>35)throw new Error("XLSX kolom di luar batas");
   const type=cell[1].match(/\bt="([^"]+)"/)?.[1]||"n";
   const body=cell[2]||"";
   const raw=body.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1]||"";
   let value=xmlUnescape(raw);
   if(type==="s") {const idx=Number(value);if(!Number.isInteger(idx)||idx<0||idx>=strings.length)throw new Error("XLSX indeks string rusak");value=strings[idx];}
   if(type==="inlineStr") value=[...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(t=>xmlUnescape(t[1])).join("");
   if(!["s","n","str","inlineStr","b"].includes(type))throw new Error("XLSX jenis sel tidak didukung");
   values[col-1]=value;
  }
  grid[rowNumber-1]=values;
 }
 return Array.from({length:grid.length},(_,i)=>grid[i]||[]);
}
export function parseBinatuReport(name:string,bytes:Buffer):ImportRow[]{
 if(bytes.length<10||bytes.length>MAX_BYTES)throw new Error("Maksimum file 1,5 MB");
 if(/\.csv$/i.test(name))return fromGrid(parseCsv(bytes));
 if(/\.xlsx$/i.test(name))return fromGrid(parseXlsx(bytes));
 throw new Error("Hanya CSV UTF-8 atau XLSX tanpa rumus yang didukung");
}
export function escapeCsv(value:unknown):string{
 const s=String(value??"").replace(/^[\s\uFEFF]*[=+@-]/,m=>"'"+m);
 return `"${s.replace(/"/g,'""')}"`;
}
