import {createDecipheriv} from "node:crypto";

export function decryptCardWithKeys(hex:string,primary:Buffer,legacy?:Buffer):string {
 if(!/^[a-f0-9]+$/.test(hex)||hex.length%2!==0||hex.length<56||hex.length>4096)
  throw new Error("Invalid ciphertext");
 const bytes=Buffer.from(hex,"hex");
 for(const key of legacy?[primary,legacy]:[primary]){
  try{
   const decipher=createDecipheriv("aes-256-gcm",key,bytes.subarray(0,12));
   decipher.setAuthTag(bytes.subarray(bytes.length-16));
   const token=Buffer.concat([decipher.update(bytes.subarray(12,bytes.length-16)),decipher.final()]).toString("utf8");
   if(/^[A-Za-z0-9_-]{43}$/.test(token)&&Buffer.from(token,"base64url").toString("base64url")===token)return token;
  }catch{}
 }
 throw new Error("Invalid card ciphertext or key");
}
