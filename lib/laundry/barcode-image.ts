/** Local multi-format decode: no image leaves the device. */
export async function decodeLaundryBarcodeImage(file:File):Promise<string>{
 const {BrowserMultiFormatReader}=await import("@zxing/browser/esm/readers/BrowserMultiFormatReader");
 const url=URL.createObjectURL(file);const img=new Image();
 try{
  await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error("Gambar tidak terbaca"));img.src=url});
  if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>40_000_000)throw new Error("Gambar terlalu besar");
  const reader=new BrowserMultiFormatReader(),canvas=document.createElement("canvas");
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas tidak tersedia");
  const scale=Math.min(1,1500/img.naturalWidth);
  canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  return reader.decodeFromCanvas(canvas).getText();
 }finally{img.onload=null;img.onerror=null;img.src="";URL.revokeObjectURL(url)}
}
