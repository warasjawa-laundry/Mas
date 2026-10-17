"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * A Next.js client-side transition can restore a previously cached admin
 * route without a new document request. Enforce a full authenticated entry
 * whenever navigation crosses the public/admin boundary in either direction.
 */
export default function SiteAdminBoundary(){
 const path=usePathname();
 const previous=useRef<string|null>(null);
 useEffect(()=>{
  if(!path)return;
  const before=previous.current;
  previous.current=path;
  if(!before)return;
  if(before.startsWith("/admin")&&!path.startsWith("/admin")){
    window.location.replace("/admin/leave");
    return;
  }
  if(!before.startsWith("/admin")&&path.startsWith("/admin")&&path!=="/admin/login"){
    window.location.replace("/admin/login");
  }
 },[path]);
 return null;
}
