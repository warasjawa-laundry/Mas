export type PointSimulation={booked:false;total_idr:string;paid_idr:string;refunded_idr:string;state:string;
 points:number|null;rule_available:boolean;program_year:number;rule_revision:number|null;persisted_order:boolean;calculated_at?:string};
const states=['ESTIMATE','UNPAID','PARTIAL','PAID','REFUNDED','CANCELLED','ZERO_TOTAL'];
export function readPointSimulation(value:unknown):PointSimulation|null{
 if(!value||typeof value!=='object')return null;
 const v=value as PointSimulation;
 if(v.booked!==false||!states.includes(v.state)||typeof v.persisted_order!=='boolean'||
  !Number.isSafeInteger(v.program_year)||v.program_year<2026||v.program_year>2100||typeof v.rule_available!=='boolean')return null;
 for(const n of [v.total_idr,v.paid_idr,v.refunded_idr])if(typeof n!=='string'||!/^(0|[1-9][0-9]{0,9})$/.test(n)||BigInt(n)>BigInt(1000000000))return null;
 if(v.rule_available?(typeof v.points!=='number'||!Number.isSafeInteger(v.points)||v.points<0||v.points>10000||typeof v.rule_revision!=='number'||!Number.isSafeInteger(v.rule_revision)||v.rule_revision<1):(v.points!==null||v.rule_revision!==null))return null;
 return v;
}
export function pointSimulationStatus(state:string){
 return ({ESTIMATE:'Menunggu pelunasan',UNPAID:'Perkiraan poin — menunggu pembayaran',PARTIAL:'Perkiraan poin — menunggu pelunasan',
  PAID:'Poin simulasi setelah pelunasan',REFUNDED:'Simulasi poin dibatalkan',CANCELLED:'Simulasi poin dibatalkan',ZERO_TOTAL:'Tagihan nol — tinjau nota'} as Record<string,string>)[state]??'Status belum tersedia';
}
export function pointSimulationMatchesPayment(sim:PointSimulation|null,financial:{total_idr:string;paid_idr:string;refunded_idr:string;payment_status:string}|null){
 return !!sim&&!!financial&&sim.total_idr===financial.total_idr&&sim.paid_idr===financial.paid_idr&&sim.refunded_idr===financial.refunded_idr&&
  (sim.state===financial.payment_status||(sim.state==='CANCELLED'&&['UNPAID','ZERO_TOTAL'].includes(financial.payment_status)));
}
export function pointSimulationLines(data:PointSimulation){
 const cancelled=['REFUNDED','CANCELLED'].includes(data.state);
 return ['POIN SIMULASI','SIMULASI — TIDAK DIBUKUKAN',
  ...(!data.rule_available?[`Aturan poin periode ${data.program_year} belum tersedia. Poin belum dapat dihitung.`]:
   cancelled?[]:[`${data.state==='PAID'?'Poin simulasi setelah pelunasan':'Perkiraan poin transaksi'} : +${data.points} poin`]),
  `Status : ${pointSimulationStatus(data.state)}`,`Periode : ${data.program_year}${data.rule_available?' · aturan versi '+data.rule_revision:''}`,
  'Simulasi, tidak menambah saldo member. Aturan simulasi dapat berubah; ini bukan riwayat poin yang dibukukan.'];
}
