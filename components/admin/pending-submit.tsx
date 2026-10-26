"use client";
import {useFormStatus} from "react-dom";
export default function PendingSubmit({label,className="admin-primary"}:{label:string;className?:string}){
 const {pending}=useFormStatus();
 return <button type="submit" className={className} disabled={pending} aria-busy={pending}>{pending?"Menyimpan…":label}</button>;
}
