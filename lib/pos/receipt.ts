import {readPointSimulation,pointSimulationLines,pointSimulationMatchesPayment,type PointSimulation} from './point-simulation.ts';
export type ReceiptKind='NEW'|'READY'|'COLLECTED';
export type ReceiptContact={phone:string|null;address:string;verified_at:string|null};
export type ReceiptPayment={amount_idr:string;received_at:string;receiver:string;method:string;internal_reference?:string;payment_id?:string;cash_ledger_id?:string|null;original_receipt_id?:string|null};
export type ReceiptData={order_id?:string;order_version?:string;payment_version?:string;snapshot_at?:string;payments?:ReceiptPayment[];refunds?:ReceiptPayment[];lifecycle_status?:string;contact_draft?:ReceiptContact|null;
 is_test_order?:boolean;invoice:string;customer:string;actor:string;collector?:string|null;created_at:string;due_at:string|null;ready_at:string|null;collected_at:string|null;
 work_status:string;kind:ReceiptKind;package:string|null;minutes:number|null;perfume:string|null;notes:string|null;
 total:string;service_subtotal?:string;fees_idr?:string;discount_idr?:string;delivery?:{code:string;name:string;amount_idr:string}|null;paid:string;refunded:string;remaining:string;status:string;contact:ReceiptContact|null;
 member:{year:number;balance:string;awarded:number;projected:number|null}|null;point_simulation?:PointSimulation|null;
 settings:{revision:number;config:Record<string,string>};
 items:{name:string;package:string|null;duration:string|null;quantity_milli:number;unit:string;price:string;subtotal:string}[]};
const money=(n:string|bigint)=>'Rp'+BigInt(n).toLocaleString('id-ID');
const divider='----------------------------------------';
function date(n:string|null){
 if(!n)return 'Belum ditentukan';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(n)).map(p=>[p.type,p.value]));
 return `${parts.day}/${parts.month}/${parts.year} - ${parts.hour}:${parts.minute} WIB`;
}
export function normalizeReceiptPhone(raw:string){
 let phone=raw.trim().replace(/[ ()-]/g,'');if(phone.startsWith('0'))phone='+62'+phone.slice(1);else if(!phone.startsWith('+'))phone='+'+phone;
 return /^\+[1-9][0-9]{7,14}$/.test(phone)?phone:null;
}
export function receiptWhatsAppUrl(contact:ReceiptContact|null,text:string,isTestOrder=false){

 if(!contact?.verified_at||!contact.phone||!/^\+[1-9][0-9]{7,14}$/.test(contact.phone))return null;
 const url='https://wa.me/'+contact.phone.slice(1)+'?text='+encodeURIComponent(text);
 return url.length<=8000?url:null;
}
const amountPattern=/^(0|[1-9]\d{0,15})$/;
const uuidPattern=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
function amount(value:string){if(typeof value!=='string'||!amountPattern.test(value))throw Error('Nominal nota tidak valid');return BigInt(value);}
export function validateReceiptData(r:ReceiptData,{requireSnapshot=false}:{requireSnapshot?:boolean}={}){
 if(!r||!r.invoice?.trim()||r.invoice.length>70||/[\x00-\x1f\x7f]/.test(r.invoice)||!r.customer?.trim()||!r.actor?.trim()||uuidPattern.test(r.actor)||r.collector&&uuidPattern.test(r.collector))throw Error('Identitas nota tidak valid');
 if(!['NEW','READY','COLLECTED'].includes(r.kind)||!['QUEUED','PROCESSING','READY','COLLECTED','CANCELLED'].includes(r.work_status)||!['UNPAID','PARTIAL','PAID','REFUNDED','CANCELLED','ZERO_TOTAL'].includes(r.status))throw Error('Status nota tidak valid');
 if(r.contact_draft&&(r.contact_draft.verified_at!==null||r.contact_draft.phone!==null&&!/^\+[1-9][0-9]{7,14}$/.test(r.contact_draft.phone)||typeof r.contact_draft.address!=='string'||r.contact_draft.address.length>240||/[\x00-\x1f\x7f]/.test(r.contact_draft.address)))throw Error('Draf kontak belum valid');
 for(const value of [r.created_at,r.due_at,r.ready_at,r.collected_at])if(value!==null&&!Number.isFinite(Date.parse(value)))throw Error('Waktu nota tidak valid');
 if(!r.settings||!Number.isSafeInteger(r.settings.revision)||r.settings.revision<1||!r.settings.config?.outlet_name?.trim())throw Error('Pengaturan nota tidak valid');
 if(requireSnapshot&&(!r.order_id||!new RegExp('^'+uuidPattern.source+'$','i').test(r.order_id)||!r.order_version||!/^[1-9]\d*$/.test(r.order_version)||!r.payment_version||!/^(0|[1-9]\d*)$/.test(r.payment_version)||!r.snapshot_at||!Number.isFinite(Date.parse(r.snapshot_at))||typeof r.is_test_order!=='boolean'||r.service_subtotal===undefined||r.fees_idr===undefined||r.discount_idr===undefined||!Array.isArray(r.payments)||!Array.isArray(r.refunds)))throw Error('Snapshot nota belum lengkap');
 if(r.is_test_order&&r.member)throw Error("Nota uji tidak boleh terhubung dengan member");
 const total=amount(r.total),paid=amount(r.paid),refund=amount(r.refunded),remaining=amount(r.remaining);
 const closed=r.status==='REFUNDED'||r.work_status==='CANCELLED'||r.status==='CANCELLED';
 if(total<paid||refund>paid||remaining!==(closed&&r.order_id?BigInt(0):total-paid+refund))throw Error('Rincian pembayaran belum konsisten');
 if(refund>BigInt(0)&&(refund!==paid||r.status!=='REFUNDED'))throw Error('Refund sebagian belum didukung pada nota');
 const expected=refund>BigInt(0)?'REFUNDED':total===BigInt(0)?'ZERO_TOTAL':paid===BigInt(0)?'UNPAID':paid===total?'PAID':'PARTIAL';
 if(r.status!==expected&&!(r.status==='CANCELLED'&&paid===BigInt(0)&&r.work_status==='CANCELLED'))throw Error('Status dan nominal pembayaran tidak konsisten');
 if(!Array.isArray(r.items)||r.items.length===0)throw Error('Rincian layanan tidak valid');
 let itemTotal=BigInt(0);
 for(const item of r.items){
  if(!item.name?.trim()||!['pcs','kg','m'].includes(item.unit)||!Number.isSafeInteger(item.quantity_milli)||item.quantity_milli<1||item.quantity_milli>1000000000||item.unit==='pcs'&&item.quantity_milli%1000!==0)throw Error('Kuantitas atau satuan layanan tidak valid');
  const subtotal=amount(item.subtotal);
  if(subtotal!==(amount(item.price)*BigInt(item.quantity_milli)+BigInt(500))/BigInt(1000))throw Error('Subtotal layanan tidak konsisten');
  itemTotal+=subtotal;
 }
 const service=r.service_subtotal===undefined?itemTotal:amount(r.service_subtotal),fees=amount(r.fees_idr??'0'),discount=amount(r.discount_idr??'0');
 if(itemTotal!==service||discount>service||service+fees-discount!==total)throw Error('Total nota dan biaya tambahan tidak konsisten');
 for(const [records,expectedSum] of [[r.payments,paid],[r.refunds,refund]] as const){
  if(records!==undefined){
   if(!Array.isArray(records))throw Error('Transaksi terkonfirmasi tidak valid');
   let sum=BigInt(0);
   for(const p of records){if(amount(p.amount_idr)<=BigInt(0)||!['CASH','NONCASH','TRANSFER','QRIS'].includes(p.method)||!p.receiver?.trim()||uuidPattern.test(p.receiver)||!Number.isFinite(Date.parse(p.received_at)))throw Error('Transaksi terkonfirmasi tidak valid');sum+=amount(p.amount_idr);}
   if(sum!==expectedSum)throw Error('Jumlah transaksi terkonfirmasi tidak konsisten');
  }
 }
 if(r.delivery){
  if(!/^(0|[1-9]\d{0,15})$/.test(r.delivery.amount_idr)||
     !r.delivery.name||!r.delivery.code||
     (r.fees_idr!==undefined&&BigInt(r.delivery.amount_idr)>BigInt(r.fees_idr)))throw Error('Tarif antar-jemput tidak valid');
 }
 if(r.kind==='READY'&&r.work_status!=='READY'||r.kind==='COLLECTED'&&(r.work_status!=='COLLECTED'||r.status!=='PAID'||remaining!==BigInt(0)||!r.collected_at))throw Error('Status nota belum sesuai draf');
 if(requireSnapshot&&r.work_status==='COLLECTED'&&(!['PAID','REFUNDED'].includes(r.status)||remaining!==BigInt(0)||!r.collected_at))throw Error('Status pengambilan dan pembayaran tidak konsisten');
 if(r.point_simulation&&!pointSimulationMatchesPayment(readPointSimulation(r.point_simulation),{total_idr:r.total,paid_idr:r.paid,refunded_idr:r.refunded,payment_status:r.status}))throw Error('Simulasi dan pembayaran berbeda; baca ulang nota');
 return r;
}
export function buildWhatsAppReceipt(r:ReceiptData){
 validateReceiptData(r);
 const contact=r.contact,refund=BigInt(r.refunded),closed=r.status==='REFUNDED'||r.work_status==='CANCELLED'||r.status==='CANCELLED',payable=closed?'0':r.remaining;
 const c=r.settings.config;const title=r.kind==='NEW'?c.new_title:r.kind==='READY'?c.ready_title:c.collected_title;
 const lines=[...(r.is_test_order?["NOTA UJI - SIMULASI", "BUKAN BUKTI PEMBAYARAN NYATA", "Khusus penguji. Jangan terima uang sungguhan.", ""]:[]),c.outlet_name,c.address,c.contact,'',title,'',r.invoice,`Pelanggan : ${r.customer}`,
  `No Handphone : ${contact?.phone??'Belum diverifikasi'}`,`Alamat : ${contact?.address||'Belum diverifikasi'}`,`Kasir : ${r.actor}`,
  `Layanan : ${r.package??'Lihat rincian layanan'}${r.minutes?` (${r.minutes%60===0?r.minutes/60+' jam':r.minutes+' menit'})`:''}`,
  `Masuk : ${date(r.created_at)}`,`Est Selesai : ${date(r.due_at)}`];
 if(r.kind==='READY')lines.push(`Selesai : ${date(r.ready_at)}`,'','STATUS CUCIAN : SIAP DIAMBIL');
 if(r.kind==='COLLECTED')lines.push(`Tanggal Pengambilan : ${date(r.collected_at)}`,`Petugas : ${r.collector||'Belum tersedia'}`,'','STATUS : SUDAH DIAMBIL');
 lines.push(divider,'LAYANAN');
 for(const item of r.items){
  lines.push(`${item.name}${item.package?' ('+item.package+')':''}`,
   `${(item.quantity_milli/1000).toLocaleString('id-ID',{maximumFractionDigits:3})} ${item.unit} x ${money(item.price)} = ${money(item.subtotal)}`);
 }
 lines.push(divider,`Parfum : ${r.perfume||'Tidak dicatat'}`);if(r.notes)lines.push(`Catatan : ${r.notes}`);
 lines.push(divider,`Total Layanan : ${money(r.service_subtotal??r.total)}`);
 if(r.delivery&&r.delivery.code!=='NONE')lines.push(`Antar-Jemput (${r.delivery.name}) : ${money(r.delivery.amount_idr)}`);
 lines.push(`Total Tagihan : ${money(r.total)}`,divider,r.is_test_order?'PEMBAYARAN SIMULASI':'PEMBAYARAN',`Total : ${money(r.total)}`,
  `Sudah Dibayar : ${money(r.paid)}`,`Sisa Tagihan : ${money(payable)}`,
  `Status : ${r.work_status==='CANCELLED'&&r.status!=='REFUNDED'?'DIBATALKAN':{PAID:'LUNAS',PARTIAL:'DP / BELUM LUNAS',UNPAID:'BELUM BAYAR',REFUNDED:'REFUND',CANCELLED:'DIBATALKAN',ZERO_TOTAL:'TAGIHAN NOL — REVIEW DIPERLUKAN'}[r.status]??'Belum diketahui'}`);
 if(refund>BigInt(0))lines.push(`Refund : ${money(refund)}`);
 if(closed)lines.push('Nota ditutup. Tidak ada tagihan baru.');
 if(r.member){
  const m=r.member;lines.push(divider,'POIN MEMBER',`Periode : ${m.year}`,
   r.status==='PAID'?`Poin Transaksi : +${m.awarded} poin`:
   m.projected!==null?`Poin Transaksi : ${m.projected} poin (menunggu pelunasan)`:'Poin transaksi belum dibukukan',
   `Total Poin Aktif : ${m.balance} poin`);
  if(m.projected!==null){lines.push(`Perkiraan Total Setelah Lunas : ${BigInt(m.balance)+BigInt(m.projected)} poin`,'Perkiraan memakai aturan periode saat ini; diperiksa ulang saat pelunasan.');}
 }
 if(r.is_test_order){
  const simulation=readPointSimulation(r.point_simulation);
  if(r.point_simulation&&!pointSimulationMatchesPayment(simulation,{total_idr:r.total,paid_idr:r.paid,refunded_idr:r.refunded,payment_status:r.status}))throw Error('Simulasi dan pembayaran berbeda; baca ulang nota');
  lines.push(divider,...(simulation?pointSimulationLines(simulation):['POIN SIMULASI','SIMULASI — TIDAK DIBUKUKAN','Simulasi poin belum tersedia. Baca ulang setelah koneksi tersedia.']));
 }
 if(r.kind==='READY')lines.push(divider,`Halo Kak ${r.customer},`,'Cucian Kakak sudah selesai dan siap diambil di '+c.outlet_name+'.',
  r.status==='PAID'?'Pembayaran sudah lunas. Cucian dapat diambil.':r.status==='PARTIAL'?`Mohon melunasi ${money(r.remaining)} sebelum cucian diserahkan.`:
  r.status==='UNPAID'?`Mohon melakukan pembayaran ${money(r.remaining)} sebelum cucian diserahkan.`:'Hubungi petugas untuk pemeriksaan nota.',
  'Pengambilan hanya dapat dilakukan setelah pembayaran lunas.','Terima kasih telah mempercayakan cucian kepada kami.');
 if(r.kind==='NEW'&&!r.is_test_order&&!closed)lines.push('',c.terms,c.payment_notice,c.bank,c.ewallet);
 if(r.kind==='COLLECTED')lines.push('Terima kasih telah menggunakan jasa '+c.outlet_name+'.');
 lines.push('',c.cs);return lines.filter(v=>v!==undefined).join('\n');
}
export const buildReceipt=buildWhatsAppReceipt;
