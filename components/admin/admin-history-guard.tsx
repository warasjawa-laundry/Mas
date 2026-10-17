"use client";
import {useEffect} from "react";
import {usePathname} from "next/navigation";

// Cached pages must not display a previously verified admin screen on browser
// history restore. All actual access checks remain on the server.
export default function AdminHistoryGuard(){
 const pathname=usePathname();
 useEffect(()=>{
  if(!pathname||pathname==="/admin/login")return;
  const handle=(event:PageTransitionEvent)=>{
    if(event.persisted)window.location.replace("/admin/login");
  };
  window.addEventListener("pageshow",handle);
  return ()=>window.removeEventListener("pageshow",handle);
 },[pathname]);
 return null;
}
