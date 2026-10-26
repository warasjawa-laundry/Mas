"use client";
import {useFormStatus} from "react-dom";
export default function PendingSubmit({label,className="admin-primary",disabled=false}:{label:string;className?:string;disabled?:boolean}){
 const {pending}=useFormStatus();
 return <button type="submit" className={className} disabled={disabled||pending} aria-busy={pending}>{pending?"Menyimpan…":label}</button>;
}
