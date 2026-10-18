"use client";
import {useEffect,useRef,useState} from "react";
import ServicePricesView from "@/components/service-prices-view";
import type {PublishedService} from "@/lib/services/catalog";
type Props={initial:PublishedService[];initialFailed:boolean;realtime:{url:string;key:string}|null};
export default function ServicePrices({initial,initialFailed,realtime}:Props){
 const [services,setServices]=useState(initial),[failed,setFailed]=useState(initialFailed);
 const etag=useRef("");
 useEffect(()=>{
  let active=true,busy=false,again=false;
  const controller=new AbortController();
  let socket:{disconnect:()=>void}|undefined;
  async function refresh(){
   if(!active||document.hidden||!navigator.onLine)return;
   if(busy){again=true;return}busy=true;
   try{
    const response=await fetch("/api/services",{cache:"no-store",signal:controller.signal,headers:etag.current?{"If-None-Match":etag.current}:{}});
    if(response.status===304){if(active)setFailed(false);return}
    if(!response.ok)throw Error("unavailable");
    const body=await response.json();
    if(!Array.isArray(body.services))throw Error("invalid");
    if(active){etag.current=response.headers.get("etag")??"";setServices(body.services);setFailed(false)}
   }catch{if(active&&!controller.signal.aborted)setFailed(true)}
   finally{busy=false;if(again&&active){again=false;void refresh()}}
  }
  if(realtime){
   void import("@supabase/realtime-js").then(({RealtimeClient})=>{
    if(!active)return;
    const client=new RealtimeClient(realtime.url+"/realtime/v1",{params:{apikey:realtime.key}});
    socket=client;
    client.channel("public-service-prices").on("postgres_changes",{event:"UPDATE",schema:"public",table:"laundry_catalog_version"},()=>void refresh())
     .subscribe(status=>{if(status==="SUBSCRIBED")void refresh()});
   }).catch(()=>{/* Periodic refresh also works when the socket is unavailable. */});
  }
  void refresh();
  const timer=setInterval(()=>void refresh(),30000);
  const resume=()=>void refresh();
  document.addEventListener("visibilitychange",resume);window.addEventListener("focus",resume);window.addEventListener("online",resume);
  return ()=>{active=false;controller.abort();clearInterval(timer);socket?.disconnect();document.removeEventListener("visibilitychange",resume);window.removeEventListener("focus",resume);window.removeEventListener("online",resume)};
 },[realtime?.url,realtime?.key]);
 return <div aria-live="polite" aria-atomic="false">
  {failed&&<p className="catalog-feedback" role="status">Daftar harga belum dapat diperbarui. Hubungi petugas untuk memastikan harga.</p>}
  {services.length?<ServicePricesView services={services}/>:!failed&&<p className="catalog-feedback">Belum ada layanan yang ditampilkan. Hubungi petugas untuk informasi harga.</p>}
 </div>;
}

