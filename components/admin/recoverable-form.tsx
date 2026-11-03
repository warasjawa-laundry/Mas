"use client";

import {useEffect,useRef,useState,type ReactNode} from "react";
import {unstable_rethrow,useRouter} from "next/navigation";
import {commandUuid,type CommandActionResult} from "@/lib/pos/command-recovery";

type Props={action:(data:FormData)=>Promise<CommandActionResult>;children:ReactNode;className?:string;
 recoveryKey?:string;recoverAction?:(requestId:string)=>Promise<CommandActionResult>;
 onRecoveryPendingChange?:(pending:boolean)=>void};

export default function RecoverableForm({action,children,className,recoveryKey,recoverAction,onRecoveryPendingChange}:Props){
 const router=useRouter();
 const [error,setError]=useState("");
 const [ready,setReady]=useState(!recoveryKey);
 const [restored,setRestored]=useState(false);
 const [lookupBusy,setLookupBusy]=useState(false);
 const [confirmed,setConfirmed]=useState(false);
 const request=useRef<string|null>(null);
 const submitting=useRef(false);
 const scope=useRef<string|undefined>(undefined);
 const form=useRef<HTMLFormElement>(null);
 useEffect(()=>{onRecoveryPendingChange?.(restored)},[restored,onRecoveryPendingChange]);
 useEffect(()=>{
  scope.current=recoveryKey;request.current=null;setRestored(false);setConfirmed(false);setError('');
  if(!recoveryKey){setReady(true);return;}
  setReady(false);
  try{
   const saved=sessionStorage.getItem(recoveryKey);
   if(saved!==null){
    if(!commandUuid.test(saved)){setError("Penanda transaksi tidak valid. Hubungi penanggung jawab untuk rekonsiliasi sebelum membuat transaksi lagi.");return;}
    request.current=saved;setRestored(true);
    const input=form.current?.elements.namedItem('requestId');
    if(input instanceof HTMLInputElement)input.value=saved;
   }
   setReady(true);
  }catch{setError("Penyimpanan penanda transaksi tidak tersedia. Aktifkan penyimpanan sesi sebelum melanjutkan agar transaksi dapat diperiksa setelah muat ulang.");}
 },[recoveryKey]);
 function complete(result:CommandActionResult){
  if(result.confirmed!==true)return false;
  setConfirmed(true);
  if(recoveryKey&&request.current){
   try{if(sessionStorage.getItem(recoveryKey)===request.current)sessionStorage.removeItem(recoveryKey);}catch{/* Keep confirmation visible if storage becomes unavailable. */}
  }
  if(result.redirectTo?.startsWith('/')&&!result.redirectTo.startsWith('//')){router.push(result.redirectTo);router.refresh();}
  else setError("Transaksi dikonfirmasi database. Muat ulang halaman untuk melihat hasilnya.");
  return true;
 }
 async function submit(data:FormData){
  if(submitting.current||confirmed||!ready||restored||(recoveryKey&&scope.current!==recoveryKey))return;
  if(recoveryKey){
   const id=request.current??data.get('requestId');
   if(typeof id!=='string'||!commandUuid.test(id)){setError("ID permintaan tidak valid. Jangan membuat transaksi baru sebelum penanda diperiksa.");return;}
   try{
    const saved=sessionStorage.getItem(recoveryKey);
    if(saved&&saved!==id){request.current=saved;setRestored(true);return;}
    sessionStorage.setItem(recoveryKey,id);request.current=id;data.set('requestId',id);
   }catch{setError("Penanda transaksi tidak dapat disimpan. Transaksi belum dikirim.");return;}
  }
  submitting.current=true;
  setError("");
  try{
   const result=await action(data);
   if(!complete(result))setError(result.error);
  }catch(failure){
   unstable_rethrow(failure);
   setError("Permintaan belum selesai. Periksa koneksi lalu coba lagi. Isian tetap tersedia di formulir ini.");
  }finally{submitting.current=false;}
 }
 async function lookup(){
  if(!request.current||!recoverAction||lookupBusy)return;
  setLookupBusy(true);setError("");
  try{const result=await recoverAction(request.current);if(!complete(result))setError(result.error);}
  catch(failure){unstable_rethrow(failure);setError("Hasil belum dapat diperiksa. Penanda tetap disimpan; jangan membuat transaksi baru.");}
  finally{setLookupBusy(false);}
 }
 return <form ref={form} action={submit} className={className}
  // A returned validation error resolves the action; prevent React from clearing its uncontrolled fields.
  onReset={event=>event.preventDefault()}>
  {error&&<p className="admin-error" role="alert">{error}</p>}
  {recoveryKey&&restored&&<section role="status" aria-label="Pemulihan transaksi tertunda">
   <p>Ada transaksi sebelumnya yang hasilnya belum dipastikan. Formulir baru dikunci. Data isian tidak disimpan setelah muat ulang.</p>
   <p>ID permintaan: <code>{request.current}</code></p>
   {recoverAction&&<button type="button" disabled={lookupBusy||confirmed} onClick={lookup}>{lookupBusy?'Memeriksa hasil…':'Periksa hasil transaksi'}</button>}
   <p>Hasil belum ditemukan juga dapat berarti transaksi masih berjalan. Jika perlu mencoba lagi, susun ulang semua isian persis seperti sebelumnya. ID tetap sama; jangan menerima pembayaran lagi.</p>
   <button type="button" disabled={lookupBusy||confirmed} onClick={()=>setRestored(false)}>Susun ulang dengan ID yang sama</button>
  </section>}
  {recoveryKey?<fieldset disabled={!ready||restored||confirmed} style={{display:'contents',border:0,padding:0,margin:0,minWidth:0}}>{children}</fieldset>:children}
 </form>;
}
