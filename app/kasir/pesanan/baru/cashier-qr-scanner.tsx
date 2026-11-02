"use client";
import {useEffect,useRef,useState,type ChangeEvent} from "react";
import {decodeLaundryQrImage} from "@/lib/laundry/qr-image";
import {decodeLaundryBarcodeImage} from "@/lib/laundry/barcode-image";
import {resolveCashierMemberCode} from "./qr-actions";
import {resolveOwnerPosMemberCode} from "@/app/admin/pesanan/member-actions";
import styles from "./wizard.module.css";
type Controls={stop:()=>void};
const formats=new Set(["image/png","image/jpeg","image/webp","image/gif","image/avif"]);
export function CashierQrScanner({onMember,disabled,role="cashier"}:{onMember:(number:string,name:string)=>void;disabled:boolean;role?:"owner"|"cashier"}){
 const video=useRef<HTMLVideoElement>(null);
 const controls=useRef<Controls|null>(null);
 const generation=useRef(0);
 const alive=useRef(true);
 const busyRef=useRef(false);
 const [running,setRunning]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{alive.current=true;return ()=>{alive.current=false;generation.current++;controls.current?.stop()}},[]);
 function stop(){generation.current++;controls.current?.stop();controls.current=null;setRunning(false)}
 async function resolve(raw:string){
  if(!alive.current||busyRef.current)return;
  busyRef.current=true;setBusy(true);setError("");stop();
  try{
   const result=await (role==="owner"?resolveOwnerPosMemberCode:resolveCashierMemberCode)(raw);
   if(!alive.current)return;
   if(result)onMember(result.memberNumber,result.displayName);
   else setError("Kartu tidak valid, dicabut, atau member tidak aktif. Gunakan nomor member manual.");
  }catch{if(alive.current)setError("Gagal memeriksa kartu. Periksa jaringan, lalu coba lagi.");}
  finally{busyRef.current=false;if(alive.current)setBusy(false)}
 }
 async function start(){
  if(busy||busyRef.current||disabled||running)return;
  if(!navigator.mediaDevices?.getUserMedia){setError("Kamera tidak tersedia. Gunakan galeri.");return}
  const id=++generation.current;setBusy(true);setError("");
  try{
   const {BrowserMultiFormatReader}=await import("@zxing/browser/esm/readers/BrowserMultiFormatReader");
   if(!alive.current||generation.current!==id||!video.current)return;
   const reader=new BrowserMultiFormatReader();
   const scan=await reader.decodeFromVideoDevice(undefined,video.current,(result,_error,control)=>{
    if(result&&!busyRef.current){control.stop();void resolve(result.getText())}
   });
   if(!alive.current||generation.current!==id){scan.stop();return}
   controls.current=scan;setRunning(true);
  }catch{if(alive.current&&generation.current===id)setError("Kamera tidak bisa dibuka. Izinkan kamera atau pilih foto QR.");}
  finally{if(alive.current&&generation.current===id)setBusy(false)}
 }
 async function gallery(e:ChangeEvent<HTMLInputElement>){
  const file=e.currentTarget.files?.[0];e.currentTarget.value="";
  if(!file||disabled||busyRef.current||busy)return;
  if(file.size===0||file.size>12*1024*1024||
    (file.type?!formats.has(file.type.toLowerCase()):!/\.(png|jpe?g|webp|gif|avif)$/i.test(file.name))){
   setError("Foto QR harus JPG, PNG, WebP, GIF atau AVIF maksimal 12 MB.");return;
  }
  stop();setBusy(true);busyRef.current=true;setError("");
  try{
   let decoded:string;
   try{decoded=await decodeLaundryQrImage(file)}catch{decoded=await decodeLaundryBarcodeImage(file)}
   busyRef.current=false;
   if(alive.current)await resolve(decoded);
  }catch{if(alive.current)setError("Barcode/QR tidak terbaca. Gunakan foto lebih jelas atau ketik nomor member.");}
  finally{busyRef.current=false;if(alive.current)setBusy(false)}
 }
 return <div className={styles.qrPanel} aria-label="Scan barcode atau QR kartu member">
  <div className={styles.qrActions}>
   <button type="button" disabled={busy||disabled} onClick={()=>running?stop():void start()}>
    {running?"Tutup Kamera":"Scan Barcode / QR Kamera"}
   </button>
   <label className={styles.galleryPick}>Pilih Foto Barcode / QR
    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" disabled={busy||disabled}
      onChange={e=>{void gallery(e)}}/>
   </label>
  </div>
  {error&&<p className={styles.warn} role="alert">{error}</p>}
  {busy&&<p role="status" className={styles.help}>Memeriksa QR…</p>}
  <video ref={video} className={running?styles.qrVideo:styles.qrHidden} autoPlay muted playsInline aria-label="Kamera untuk QR member"/>
  <p className={styles.help}>Scan QR atau barcode MJL hanya memilih member, tidak mencatat poin. Gambar dibaca di HP dan tidak diunggah.</p>
 </div>;
}