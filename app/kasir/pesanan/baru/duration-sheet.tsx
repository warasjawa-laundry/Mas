"use client";
import {useEffect,useRef,useState} from "react";
import type {DurationOption} from "@/lib/pos/g7-catalog";
import styles from "./wizard.module.css";
export function DurationSheet({options,value,onSelect}:{options:DurationOption[];value:string;onSelect:(value:string)=>void}){
 const [open,setOpen]=useState(false);
 const trigger=useRef<HTMLButtonElement>(null);
 const dialog=useRef<HTMLDivElement>(null);
 function close(){setOpen(false);queueMicrotask(()=>trigger.current?.focus())}
 useEffect(()=>{
  if(!open)return;
  const overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const target=dialog.current;
  target?.querySelector<HTMLButtonElement>("[data-duration-choice]")?.focus();
  function handle(e:KeyboardEvent){
   if(e.key==="Escape"){e.preventDefault();close();return;}
   if(e.key!=="Tab"||!target)return;
   const focusable=[...target.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];
   if(!focusable.length)return;
   const first=focusable[0],last=focusable[focusable.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
  document.addEventListener("keydown",handle);
  return ()=>{document.removeEventListener("keydown",handle);document.body.style.overflow=overflow};
 },[open]);
 const chosen=options.find(o=>o.value===value);
 return <div className={styles.durationPicker}>
  <button ref={trigger} type="button" className={styles.durationTrigger} onClick={()=>setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
   <span>Durasi dari katalog</span><strong>{chosen?.label??"Pilih durasi"}</strong><small>Ubah pilihan</small>
  </button>
  <p className={styles.help}>Pilihan dan tarif mengikuti katalog layanan yang tersedia.</p>
  {open&&<div className={styles.sheetBackdrop} onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
   <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="duration-title" className={styles.sheet}>
    <div className={styles.sheetHandle} aria-hidden="true"/>
    <div className={styles.sheetHeader}><h3 id="duration-title">Pilih durasi layanan</h3><button type="button" onClick={close} aria-label="Tutup pilihan durasi">✕</button></div>
    <p className={styles.help}>Pilih salah satu durasi yang tersedia di katalog, atau tampilkan semua.</p>
    <div className={styles.sheetOptions}>{options.map(opt=><button key={opt.value} type="button" data-duration-choice
      aria-pressed={value===opt.value} className={styles.sheetOption}
      onClick={()=>{onSelect(opt.value);close()}}>
       <span><strong>{opt.label}</strong><small>{opt.count} layanan</small></span><span aria-hidden="true">{value===opt.value?"●":"○"}</span>
      </button>)}</div>
    <button type="button" className={styles.sheetCancel} onClick={close}>Kembali</button>
   </div>
  </div>}
 </div>;
}
