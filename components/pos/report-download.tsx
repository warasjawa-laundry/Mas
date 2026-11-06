'use client';
import {useState} from 'react';

export default function ReportDownload({href,filename,format,className,children}:{href:string;filename:string;format:'csv'|'xlsx';className?:string;children:React.ReactNode}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function download(){
  if(busy)return;
  setBusy(true);setError('');
  try{
   const response=await fetch(href,{credentials:'same-origin',cache:'no-store'});
   const mime=format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/csv';
   if(!response.ok||response.redirected||!response.headers.get('content-type')?.includes(mime)){
    if(response.status===403)throw Error('Sesi atau izin laporan tidak tersedia. Masuk kembali jika sesi berakhir.');
    if(response.status===422)throw Error('Data terlalu banyak. Persempit periode laporan.');
    throw Error('Laporan belum dapat diunduh. Periksa koneksi lalu coba kembali.');
   }
   const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');
   link.href=url;link.download=filename;link.hidden=true;document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),10000);
  }catch(reason){setError(reason instanceof Error?reason.message:'Unduhan terputus. Coba kembali.');}
  finally{setBusy(false);}
 }
 return <><button type="button" className={className} onClick={download} disabled={busy} aria-busy={busy}>{busy?'Menyiapkan unduhan…':children}</button>{error&&<p role="alert">{error}</p>}</>;
}
