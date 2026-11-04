"use client";
import {useState} from 'react';
import PendingSubmit from './pending-submit';
export default function ConfirmSubmit({label,description,className}:{label:string;description:string;className:string}){
 const [open,setOpen]=useState(false);
 return open?<div className="pos-confirm-action"><p>{description}</p><div><button type="button" onClick={()=>setOpen(false)}>Batal</button><PendingSubmit label={label} className={className}/></div></div>:
  <button type="button" className={className} onClick={()=>setOpen(true)}>{label}</button>;
}
