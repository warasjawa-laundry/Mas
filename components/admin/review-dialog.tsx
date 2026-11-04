"use client";
import {useEffect,useRef,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
export default function ReviewDialog({children,closeHref}:{children:ReactNode;closeHref:string}){
 const dialog=useRef<HTMLDialogElement>(null),router=useRouter();
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null,node=dialog.current;
  node?.showModal();
  return ()=>{node?.close();if(previous?.isConnected)previous.focus();};
 },[]);
 function close(){router.replace(closeHref,{scroll:false});}
 return <dialog ref={dialog} className="pos-review-dialog" aria-label="Konfirmasi transaksi lunas Binatu" onCancel={event=>{event.preventDefault();close();}}>
  <header><strong>Konfirmasi data</strong><button type="button" onClick={close}>Tutup sementara</button></header>
  {children}
 </dialog>;
}
