"use client";

import {useState,type ReactNode} from "react";
import {unstable_rethrow} from "next/navigation";

type Props={action:(data:FormData)=>Promise<{error:string}>;children:ReactNode;className?:string};

export default function RecoverableForm({action,children,className}:Props){
 const [error,setError]=useState("");
 async function submit(data:FormData){
  setError("");
  try{
   const result=await action(data);
   setError(result.error);
  }catch(failure){
   unstable_rethrow(failure);
   setError("Permintaan belum selesai. Periksa koneksi lalu coba lagi. Isian tetap tersedia di formulir ini.");
  }
 }
 return <form action={submit} className={className}
  // A returned validation error resolves the action; prevent React from clearing its uncontrolled fields.
  onReset={event=>event.preventDefault()}>
  {error&&<p className="admin-error" role="alert">{error}</p>}
  {children}
 </form>;
}
