"use client";

import {useEffect, useRef, useState, type ChangeEvent} from "react";
import {useRouter} from "next/navigation";
import {extractLaundryToken} from "@/lib/laundry/scan";

type CameraControls = {stop:()=>void};
const MAX_IMAGE_SIZE=12*1024*1024;
const IMAGE_TYPES=new Set(["image/png","image/jpeg","image/webp","image/gif","image/avif"]);
const IMAGE_EXTENSION=/\.(png|jpe?g|webp|gif|avif)$/i;

function imageSupported(file:File){
  if(file.size===0 || file.size>MAX_IMAGE_SIZE)return false;
  return file.type ? IMAGE_TYPES.has(file.type.toLowerCase()):IMAGE_EXTENSION.test(file.name);
}

export default function CustomerCardScanner(){
  const router=useRouter();
  const cameraVideo=useRef<HTMLVideoElement>(null);
  const imagePicker=useRef<HTMLInputElement>(null);
  const cameraControls=useRef<CameraControls|null>(null);
  const cameraAttempt=useRef(0);
  const mounted=useRef(true);
  const decoding=useRef(false);
  const navigated=useRef(false);
  const [starting,setStarting]=useState(false);
  const [cameraOpen,setCameraOpen]=useState(false);
  const [reading,setReading]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    mounted.current=true;
    return ()=>{
      mounted.current=false;
      cameraAttempt.current++;
      cameraControls.current?.stop();
      cameraControls.current=null;
    };
  },[]);

  function stopCamera(){
    cameraAttempt.current++;
    cameraControls.current?.stop();
    cameraControls.current=null;
    if(mounted.current){
      setCameraOpen(false);
      setStarting(false);
    }
  }

  function openCard(raw:string){
    if(navigated.current || !mounted.current)return;
    // QR contents never leave this browser as a request to an arbitrary site.
    // Only approved card URL hosts or a 43-char card token are accepted.
    const token=extractLaundryToken(raw);
    if(!token){
      setError("QR tersebut bukan kartu Mas Jawa Laundry. Coba foto kartu yang benar.");
      return;
    }
    navigated.current=true;
    stopCamera();
    setReading(true);
    router.push("/k/"+token);
  }

  async function startCamera(){
    if(starting || reading || cameraOpen || decoding.current || navigated.current)return;
    setError("");
    if(!navigator.mediaDevices?.getUserMedia){
      setError("Kamera tidak tersedia di browser ini. Pilih foto QR dari galeri HP.");
      return;
    }
    const attempt=++cameraAttempt.current;
    setStarting(true);
    try {
      const {BrowserQRCodeReader}=await import("@zxing/browser");
      if(!mounted.current || cameraAttempt.current!==attempt || !cameraVideo.current)return;
      const scanner=new BrowserQRCodeReader();
      const controls=await scanner.decodeFromVideoDevice(undefined,cameraVideo.current,(result,_error,control)=>{
        if(!result || navigated.current)return;
        control.stop();
        openCard(result.getText());
      });
      if(!mounted.current || cameraAttempt.current!==attempt){
        controls.stop();
        return;
      }
      cameraControls.current=controls;
      setCameraOpen(true);
    }catch{
      if(mounted.current && cameraAttempt.current===attempt){
        setError("Kamera tidak dapat dibuka. Izinkan akses kamera, atau pilih foto QR.");
        setCameraOpen(false);
      }
    }finally{
      if(mounted.current && cameraAttempt.current===attempt)setStarting(false);
    }
  }

  async function scanImage(event:ChangeEvent<HTMLInputElement>){
    const file=event.currentTarget.files?.[0];
    event.currentTarget.value=""; // A failed screenshot can be selected again.
    if(!file || !mounted.current || reading || decoding.current || navigated.current)return;
    if(!imageSupported(file)){
      setError("Pilih gambar PNG, JPG, WebP, GIF, atau AVIF berukuran maksimal 12 MB.");
      return;
    }
    stopCamera();
    setError("");
    decoding.current=true;
    setReading(true);
    let objectUrl:string|null=null;
    try{
      const {BrowserQRCodeReader}=await import("@zxing/browser");
      if(!mounted.current)return;
      objectUrl=URL.createObjectURL(file);
      // Image contents are decoded locally; the photo is never uploaded.
      const qr=await new BrowserQRCodeReader().decodeFromImageUrl(objectUrl);
      if(mounted.current)openCard(qr.getText());
    }catch{
      if(mounted.current && !navigated.current){
        setError("QR tidak terbaca. Coba screenshot lebih jelas atau gunakan kamera.");
      }
    }finally{
      if(objectUrl)URL.revokeObjectURL(objectUrl);
      decoding.current=false;
      if(mounted.current && !navigated.current)setReading(false);
    }
  }

  return <section className="customer-card-scanner" aria-labelledby="customer-scan-heading">
    <div className="customer-scan-heading">
      <h2 id="customer-scan-heading">Sudah punya kartu member?</h2>
      <p>Scan QR pada kartu atau pilih screenshot QR dari galeri untuk melihat jumlah transaksi dan promo milik kartu Anda.</p>
    </div>
    <div className={"customer-camera"+(cameraOpen||starting?" customer-camera-active":"")}>
      <video ref={cameraVideo} muted playsInline autoPlay aria-label="Pratinjau kamera untuk memindai kartu member"/>
      {!cameraOpen && <span>{starting?"Membuka kamera…":"QR kartu member Mas Jawa Laundry"}</span>}
    </div>
    {error && <p className="customer-scan-error" role="alert">{error}</p>}
    <div className="customer-scan-actions">
      {cameraOpen ?
        <button type="button" className="button button-secondary" onClick={stopCamera}>Tutup Kamera</button>:
        <button type="button" className="button button-primary" disabled={starting||reading}
          onClick={()=>void startCamera()}>{starting?"Membuka Kamera…":"Buka Kamera"}</button>}
      <input ref={imagePicker} className="customer-image-input" type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        aria-label="Pilih foto kartu QR dari galeri" onChange={event=>void scanImage(event)}
        tabIndex={-1}/>
      <button type="button" className="button button-secondary"
        disabled={starting||reading} onClick={()=>imagePicker.current?.click()}>
        {reading?"Membaca QR…":"Pilih Foto QR"}
      </button>
    </div>
    <p className="customer-scan-note">Foto diproses di HP dan tidak diunggah. Scan hanya membuka informasi kartu; transaksi hanya dicatat oleh petugas.</p>
  </section>;
}
