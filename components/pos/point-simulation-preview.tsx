"use client";
import {useEffect,useState} from "react";
import PointSimulation from "./point-simulation";
import {previewPointSimulation} from "@/app/kasir/pesanan/point-simulation-actions";
import type {PointSimulation as Data} from "@/lib/pos/point-simulation";
import styles from "@/app/kasir/pesanan/orders.module.css";
export default function PointSimulationPreview({role,items,deliveryCode,deliveryRevision,total}:{role:'owner'|'cashier';items:string;deliveryCode:string;deliveryRevision:number;total:string}){
 const [result,setResult]=useState<{data:Data|null;error:string}>({data:null,error:'Membaca aturan poin Supabase…'});
 const [refresh,setRefresh]=useState(0);
 const key=[role,items,deliveryCode,deliveryRevision,total].join('|');
 const [resolvedKey,setResolvedKey]=useState('');
 useEffect(()=>{
  let cancelled=false;setResolvedKey('');
  const timer=setTimeout(()=>{
   previewPointSimulation(role,items,deliveryCode,deliveryRevision).then(r=>{
    if(cancelled)return;
    setResult(r.data&&r.data.total_idr!==total?{data:null,error:'Harga atau ongkir berubah. Muat ulang katalog sebelum melanjutkan.'}:r);setResolvedKey(key);
   }).catch(()=>{if(!cancelled){setResult({data:null,error:'Koneksi terputus. Simulasi poin belum dapat dibaca.'});setResolvedKey(key);}});
  },150);
  const poll=setInterval(()=>setRefresh(n=>n+1),60000);
  return ()=>{cancelled=true;clearTimeout(timer);clearInterval(poll)};
 },[role,items,deliveryCode,deliveryRevision,total,refresh,key]);
 return <div><PointSimulation data={resolvedKey===key?result.data:null} error={resolvedKey===key?result.error:'Membaca aturan poin Supabase…'}/>
  <button className={styles.mainButton} type="button" onClick={()=>setRefresh(n=>n+1)}>Perbarui simulasi poin</button></div>;
}
