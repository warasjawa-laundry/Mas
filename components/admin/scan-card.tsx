"use client";

import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {resolveOwnerScannedCard} from "@/app/admin/visits/actions";

type Controls={stop:()=>void};
export default function ScanCard() {
  const videoRef=useRef<HTMLVideoElement>(null);
  const controlsRef=useRef<Controls|null>(null);
  const scanLock=useRef(false);
  const aliveRef=useRef(true);
  const router=useRouter();
  const [running,setRunning]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [manual,setManual]=useState("");
  useEffect(()=>{
    aliveRef.current=true;
    return ()=>{
      aliveRef.current=false;
      controlsRef.current?.stop();
      controlsRef.current=null;
    };
  },[]);
  const stop=()=>{
    controlsRef.current?.stop();
    controlsRef.current=null;
    scanLock.current=false;
    setRunning(false);
  };
  const onDecoded=async(text:string)=>{
    if(scanLock.current || !aliveRef.current)return;
    scanLock.current=true;
    controlsRef.current?.stop();
    controlsRef.current=null;
    setRunning(false);
    setLoading(true);
    setError("");
    try{
      const member=await resolveOwnerScannedCard(text);
      if(!aliveRef.current)return;
      if(!member) {
        setError("Kartu tidak ditemukan atau tidak aktif. Cari member lewat daftar.");
        scanLock.current=false;
      }else{
        router.push("/admin/members/"+member.id);
      }
    }catch{
      if(aliveRef.current){
        setError("Gagal memeriksa kartu. Periksa koneksi lalu coba lagi.");
        scanLock.current=false;
      }
    }finally{if(aliveRef.current)setLoading(false);}
  };
  const start=async()=>{
    setError("");
    scanLock.current=false;
    if(!navigator.mediaDevices?.getUserMedia){
      setError("Kamera tidak tersedia di browser ini. Gunakan Cari Member.");
      return;
    }
    try{
      const {BrowserQRCodeReader}=await import("@zxing/browser");
      if(!videoRef.current || !aliveRef.current)return;
      const reader=new BrowserQRCodeReader();
      const controls=await reader.decodeFromVideoDevice(undefined,videoRef.current,
        (result,_err,ctrl)=>{
          if(result && !scanLock.current) {
            ctrl.stop();
            void onDecoded(result.getText());
          }
        });
      if(!aliveRef.current){controls.stop();return;}
      controlsRef.current=controls;
      setRunning(true);
    }catch{
      if(aliveRef.current)setError("Kamera tidak dapat dibuka. Izinkan kamera atau pilih member dari daftar.");
      setRunning(false);
    }
  };
  return <section className="owner-scanner" aria-labelledby="scan-title">
    <div className="owner-scanner-heading">
      <h2 id="scan-title">Scan Kartu</h2>
      <p>Arahkan kamera ke QR pelanggan. Scan hanya mencari member, tidak mencatat transaksi.</p>
    </div>
    <div className="owner-camera"><video ref={videoRef} autoPlay muted playsInline aria-label="Pratinjau kamera untuk scan kartu" /></div>
    {error&&<p className="admin-error" role="alert">{error}</p>}
    <div className="owner-scan-actions">
      {running?<button type="button" onClick={stop} className="admin-logout">Tutup Kamera</button>:
       <button type="button" onClick={()=>void start()} disabled={loading} className="member-add">Buka Kamera</button>}
      <Link href="/admin/members" className="admin-logout">Cari Member Manual</Link>
    </div>
    <form onSubmit={(event)=>{event.preventDefault();void onDecoded(manual);}} className="owner-qr-paste">
      <label htmlFor="manual-qr">Atau tempel link QR</label>
      <div><input id="manual-qr" type="text" value={manual} onChange={e=>setManual(e.target.value)}
        maxLength={500} placeholder="Tempel link kartu di sini" autoComplete="off" />
        <button type="submit" disabled={loading||!manual.trim()} className="admin-logout">{loading?"Memeriksa…":"Cari"}</button>
      </div>
    </form>
  </section>;
}
