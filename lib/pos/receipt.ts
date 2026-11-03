export type ReceiptKind='NEW'|'READY'|'COLLECTED';
export type ReceiptContact={phone:string|null;address:string;verified_at:string|null};
export type ReceiptData={is_test_order?:boolean;invoice:string;customer:string;actor:string;collector?:string|null;created_at:string;due_at:string|null;ready_at:string|null;collected_at:string|null;
 work_status:string;kind:ReceiptKind;package:string|null;minutes:number|null;perfume:string|null;notes:string|null;
 total:string;service_subtotal?:string;fees_idr?:string;discount_idr?:string;delivery?:{code:string;name:string;amount_idr:string}|null;paid:string;refunded:string;remaining:string;status:string;contact:ReceiptContact|null;
 member:{year:number;balance:string;awarded:number;projected:number|null}|null;
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
export function buildReceipt(r:ReceiptData){
 if(r.is_test_order&&r.member)throw Error("Nota uji tidak boleh terhubung dengan member");
 const contact=r.contact;
 for(const key of ['total','paid','refunded','remaining'] as const)if(!/^(0|[1-9]\d{0,15})$/.test(r[key]))throw Error('Nominal nota tidak valid');
 const total=BigInt(r.total),paid=BigInt(r.paid),refund=BigInt(r.refunded),remaining=BigInt(r.remaining);
 if(total<paid-refund||remaining!==total-paid+refund||refund>paid)throw Error('Rincian pembayaran belum konsisten');
 if(r.delivery){
  if(!/^(0|[1-9]\d{0,15})$/.test(r.delivery.amount_idr)||
     !r.delivery.name||!r.delivery.code||
     (r.fees_idr!==undefined&&BigInt(r.delivery.amount_idr)>BigInt(r.fees_idr)))throw Error('Tarif antar-jemput tidak valid');
 }
 if(r.service_subtotal!==undefined&&(!/^(0|[1-9]\d{0,15})$/.test(r.service_subtotal)||
    (r.fees_idr!==undefined&&r.discount_idr!==undefined&&
    total!==BigInt(r.service_subtotal)-BigInt(r.discount_idr)+BigInt(r.fees_idr))))
  throw Error('Total nota dan biaya tambahan tidak konsisten');
 if(r.kind==='READY'&&r.work_status!=='READY'||r.kind==='COLLECTED'&&(r.work_status!=='COLLECTED'||r.status!=='PAID'||remaining!==BigInt(0)||!r.collected_at))throw Error('Status nota belum sesuai draf');
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
  `Sudah Dibayar : ${money(r.paid)}`,`Sisa Tagihan : ${money(r.remaining)}`,
  `Status : ${{PAID:'LUNAS',PARTIAL:'DP / BELUM LUNAS',UNPAID:'BELUM BAYAR',REFUNDED:'REFUND',ZERO_TOTAL:'TAGIHAN NOL — REVIEW DIPERLUKAN'}[r.status]??'Belum diketahui'}`);
 if(refund>BigInt(0))lines.push(`Refund : ${money(refund)}`);
 if(r.member){
  const m=r.member;lines.push(divider,'POIN MEMBER',`Periode : ${m.year}`,
   r.status==='PAID'?`Poin Transaksi : +${m.awarded} poin`:
   m.projected!==null?`Poin Transaksi : ${m.projected} poin (menunggu pelunasan)`:'Poin transaksi belum dibukukan',
   `Total Poin Aktif : ${m.balance} poin`);
  if(m.projected!==null){lines.push(`Perkiraan Total Setelah Lunas : ${BigInt(m.balance)+BigInt(m.projected)} poin`,'Perkiraan memakai aturan periode saat ini; diperiksa ulang saat pelunasan.');}
 }
 if(r.kind==='READY')lines.push(divider,`Halo Kak ${r.customer},`,'Cucian Kakak sudah selesai dan siap diambil di '+c.outlet_name+'.',
  r.status==='PAID'?'Pembayaran sudah lunas. Cucian dapat diambil.':r.status==='PARTIAL'?`Mohon melunasi ${money(r.remaining)} sebelum cucian diserahkan.`:
  r.status==='UNPAID'?`Mohon melakukan pembayaran ${money(r.remaining)} sebelum cucian diserahkan.`:'Hubungi petugas untuk pemeriksaan nota.',
  'Pengambilan hanya dapat dilakukan setelah pembayaran lunas.','Terima kasih telah mempercayakan cucian kepada kami.');
 if(r.kind==='NEW'&&!r.is_test_order)lines.push('',c.terms,c.payment_notice,c.bank,c.ewallet);
 if(r.kind==='COLLECTED')lines.push('Terima kasih telah menggunakan jasa '+c.outlet_name+'.');
 lines.push('',c.cs);return lines.filter(v=>v!==undefined).join('\n');
}
