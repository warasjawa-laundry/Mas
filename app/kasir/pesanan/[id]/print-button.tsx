"use client";
/** Read-only browser print: does not produce a payment or point event. */
export function PrintButton(){
 return <button type="button" onClick={()=>window.print()} className="pos-print-button" style={{minHeight:44,padding:"10px 16px",borderRadius:10,border:"1px solid #cbd5e1",background:"white",fontWeight:700}}>Cetak Nota</button>;
}