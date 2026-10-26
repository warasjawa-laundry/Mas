import {extractLaundryToken} from "./scan";

type Rect={x:number;y:number;width:number;height:number};
/** Bounded overlapping windows keep a small QR in a full phone screenshot legible. */
export function qrImageRegions(width:number,height:number):Rect[]{
 const regions:Rect[]=[{x:0,y:0,width,height}];
 for(const fraction of [0.78,0.48]){
  const side=Math.min(width,height)*fraction;
  const columns=Math.min(6,Math.max(1,Math.ceil((width-side)/(side*0.55))));
  const xs=Array.from({length:columns+1},(_,i)=>(width-side)*i/columns);
  const steps=Math.min(9,Math.max(1,Math.ceil((height-side)/(side*0.55))));
  for(let row=0;row<=steps;row++)for(const x of xs){
   regions.push({x,y:(height-side)*row/steps,width:side,height:side});
  }
 }
 return regions;
}

/** Local-only decode; no image or QR is uploaded, and unapproved URLs are ignored. */
export async function decodeLaundryQrImage(file:File,signal?:AbortSignal):Promise<string>{
 const [{BrowserQRCodeReader},{default:DecodeHintType}]=await Promise.all([import("@zxing/browser/esm/readers/BrowserQRCodeReader"),import("@zxing/library/esm/core/DecodeHintType")]);
 const url=URL.createObjectURL(file);const image=new Image();
 const check=()=>{if(signal?.aborted)throw new DOMException("Cancelled","AbortError")};
 try{
  await new Promise<void>((resolve,reject)=>{
   image.onload=()=>resolve();image.onerror=()=>reject(new Error("Gambar tidak dapat dibuka"));image.src=url;
  });check();
  if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>40_000_000)throw new Error("Ukuran gambar terlalu besar");
  const reader=new BrowserQRCodeReader(new Map([[DecodeHintType.TRY_HARDER,true]]));
  const canvas=document.createElement("canvas");const ctx=canvas.getContext("2d",{willReadFrequently:true});
  if(!ctx)throw new Error("Pembacaan gambar tidak tersedia");
  const started=performance.now();let foreign=false;
  for(const rect of qrImageRegions(image.naturalWidth,image.naturalHeight)){
   check();if(performance.now()-started>9000)break;
   const scale=Math.min(4,1280/Math.max(rect.width,rect.height));const border=32;
   canvas.width=Math.round(rect.width*scale)+border*2;canvas.height=Math.round(rect.height*scale)+border*2;
   ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;
   ctx.drawImage(image,rect.x,rect.y,rect.width,rect.height,border,border,canvas.width-border*2,canvas.height-border*2);
   try{
    const result=reader.decodeFromCanvas(canvas).getText();
    if(extractLaundryToken(result))return result;foreign=true;
   }catch{/* Try the next overlapping area, with a fresh local threshold. */}
   await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
  throw new Error(foreign?"QR bukan kartu Mas Jawa Laundry":"QR belum terbaca dari gambar");
 }finally{image.onload=null;image.onerror=null;image.src="";URL.revokeObjectURL(url)}
}
