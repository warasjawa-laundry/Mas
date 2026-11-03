"use client";
import {useEffect,useState} from "react";
import {findCashierMembers,type NamedCashierMember} from "./member-search-actions";
import styles from "./wizard.module.css";
import {findOwnerPosMembers} from "@/app/admin/pesanan/member-actions";
export function MemberNamePicker({onPick,disabled,role="cashier"}:{onPick:(member:NamedCashierMember)=>void;disabled:boolean;role?:"owner"|"cashier"}){
 const [query,setQuery]=useState("");
 const [results,setResults]=useState<NamedCashierMember[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState(false);
 const [searched,setSearched]=useState(false);
 useEffect(()=>{
  const term=query.trim();
  if(disabled||term.length<3){return;}
  let alive=true;
  const t=setTimeout(async()=>{
   if(!alive)return;
   setBusy(true);setError(false);
   try{const found=await (role==="owner"?findOwnerPosMembers:findCashierMembers)(term);
    if(alive){setResults(found);setSearched(true)}
   }catch{if(alive){setError(true);setResults([]);setSearched(true)}}
   finally{if(alive)setBusy(false)}
  },400);
  return ()=>{alive=false;clearTimeout(t)};
 },[query,disabled,role]);
 function change(value:string){setQuery(value.slice(0,60));setResults([]);setError(false);setSearched(false);setBusy(false)}
 return <section className={styles.memberSearch} aria-label="Cari member berdasarkan nama">
  <label className={styles.field}>Cari nama member (minimal 3 huruf)
   <input disabled={disabled} type="search" autoComplete="off" maxLength={60} value={query}
    placeholder="Ketik nama pelanggan" onChange={e=>change(e.target.value)}/>
  </label>
  <p className={styles.help}>Pilih nomor member yang sesuai. Nama sama bisa dimiliki beberapa pelanggan; tidak ada pemilihan otomatis.</p>
  {busy&&<p role="status" className={styles.help}>Mencari member…</p>}
  {error&&<p role="alert" className={styles.warn}>Pencarian gagal. Coba nama lain atau ketik nomor member.</p>}
  {searched&&!busy&&query.trim().length>=3&&results.length===0&&!error&&<p role="status" className={styles.help}>Member tidak ditemukan. Coba nama lain atau ketik nomor member.</p>}
  {results.length>0&&<ul className={styles.memberResults}>
    {results.map(row=><li key={row.memberNumber}><button type="button" disabled={disabled}
      onClick={()=>{onPick(row);setQuery("");setResults([])}}>
      <strong>{row.displayName}</strong><span>MJL-0{row.memberNumber.padStart(5,"0")}</span>
     </button></li>)}
   </ul>}
 </section>;
}
