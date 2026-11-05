import {buildReceipt,type ReceiptData} from '@/lib/pos/receipt';
import './thermal-receipt.css';

export type ThermalWidth=58|80;
export function ThermalReceipt({data,width=58}:{data:ReceiptData;width?:ThermalWidth}){
 const lines=buildReceipt(data).split('\n');
 return <article className="thermal-receipt" data-width={width} aria-label={`Nota thermal ${width} mm`}>
  {lines.map((line,index)=>{
   if(/^--+$/.test(line))return <hr key={index}/>;
   const amount=line.match(/^(.*? : )(Rp[\d.]+)$/);
   const item=line.match(/^(.*? x Rp[\d.]+) = (Rp[\d.]+)$/);
   const heading=line===data.settings.config.outlet_name||line===data.invoice||line==='NOTA UJI - SIMULASI'||line==='BUKAN BUKTI PEMBAYARAN NYATA';
   return <div key={index} className={`thermal-line${amount||item?' thermal-amount-row':''}${heading?' thermal-heading':''}`}>
    {amount||item?<><span>{amount?amount[1]:`${item![1]} =`}</span><span className="thermal-nominal">{(amount||item)![2]}</span></>:line||'\u00a0'}
   </div>;
  })}
 </article>;
}
