"use client";
import {useEffect,useState} from "react";
import {findCashierMembers,type NamedCashierMember} from "./member-search-actions";
import styles from "./wizard.module.css";
export function MemberNamePicker({onPick,disabled}:{onPick:(member:NamedCashierMember)=>void;disabled:boolean}){
 const [query,setQuery]=useState("");
 const [results,setResults]=useState<NamedCashierMember[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState(false);
 useEffect(()=>{
  const term=query.trim();
  if(disabled||term.length<3){return;}
  let alive=true;
  const t=setTimeout(async()=>{
   if(!alive)return;
   setBusy(true);setError(false);
   try{const found=await findCashierMembers(term);
    if(alive)setResults(found);
   }catch{if(alive){setError(true);setResults([])}}
   finally{if(alive)setBusy(false)}
  },400);
  return ()=>{alive=false;clearTimeout(t)};
 },[query,disabled]);
 function change(value:string){setQuery(value.slice(0,60));setResults([]);setError(false)}
 return <section className={styles.memberSearch} aria-label="Cari member berdasarkan nama">
  <label className={styles.field}>Cari nama member (minimal 3 huruf)
   <input disabled={disabled} type="search" autoComplete="off" maxLength={60} value={query}
    placeholder="Contoh: Siti" onChange={e=>change(e.target.value)}/>
  </label>
  <p className={styles.help}>Pilih nomor member yang sesuai. Nama sama bisa dimiliki beberapa pelanggan; tidak ada pemilihan otomatis.</p>
  {busy&&<p role="status" className={styles.help}>Mencari member…</p>}
  {error&&<p role="alert" className={styles.warn}>Pencarian gagal. Ketik nomor member atau scan QR.</p>}
  {!busy&&query.trim().length>=3&&results.length===0&&!error&&<p role="status" className={styles.help}>Tidak ada hasil pada daftar terbaru. Coba nama lain atau gunakan QR.</p>}
  {results.length>0&&<ul className={styles.memberResults}>
    {results.map(row=><li key={row.memberNumber}><button type="button" disabled={disabled}
      onClick={()=>{onPick(row);setQuery("");setResults([])}}>
      <strong>{row.displayName}</strong><span>MJL-{row.memberNumber.padStart(6,"0")}</span>
     </button></li>)}
   </ul>}
 </section>;
}