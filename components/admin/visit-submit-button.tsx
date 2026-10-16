"use client";
import {useFormStatus} from "react-dom";
export default function VisitSubmitButton(){
 const {pending}=useFormStatus();
 return <button type="submit" className="admin-primary owner-record-button" disabled={pending}
  aria-disabled={pending}>{pending?"Mencatat…":"Catat 1 Transaksi"}</button>;
}
