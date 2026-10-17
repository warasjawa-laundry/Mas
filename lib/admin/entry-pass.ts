import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_ACCESS_COOKIE = "mj-admin-access";
export const ADMIN_ENTRY_COOKIE = "mj-admin-entry";
const ACCESS_MAX_AGE_MS = 8*60*60*1000;
const ENTRY_MAX_AGE_MS = 60*1000;

function secret(): string | null {
  // Reuse existing server-only high-entropy key, with domain separation so the
  // derived MAC cannot be confused with any QR encryption operation.
  const value=process.env.LAUNDRY_CARD_ENCRYPTION_KEY;
  return value && value.length>=32 ? value : null;
}
function mac(body:string,purpose:string):string|null{
 const key=secret();
 if(!key)return null;
 const derived=createHmac("sha256",key).update("mas-jawa:"+purpose+":v1").digest();
 return createHmac("sha256",derived).update(body).digest("base64url");
}
function issue(purpose:string,subject:string):string{
 const body=Buffer.from(JSON.stringify({
  sub:subject,iat:Date.now(),nonce:randomBytes(16).toString("hex")
 })).toString("base64url");
 const sig=mac(body,purpose);
 if(!sig)throw new Error("Admin entry secret is not configured");
 return body+"."+sig;
}
function verify(value:string|undefined,purpose:string,maxAge:number):string|null{
 if(!value||value.length>512)return null;
 const parts=value.split(".");
 if(parts.length!==2)return null;
 const [body,signature]=parts, expected=mac(body,purpose);
 if(!expected||signature.length!==expected.length)return null;
 if(!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return null;
 try{
  const obj=JSON.parse(Buffer.from(body,"base64url").toString("utf8"));
  if(typeof obj.sub!=="string"||!obj.sub||
     !Number.isSafeInteger(obj.iat)||Date.now()<obj.iat||
     Date.now()-obj.iat>maxAge||
     typeof obj.nonce!=="string"||!/^[0-9a-f]{32}$/.test(obj.nonce))return null;
  return obj.sub;
 }catch{return null}
}
export function issueAdminAccess(userId:string){return issue("access",userId)}
export function validAdminAccess(token:string|undefined,userId:string){
 return verify(token,"access",ACCESS_MAX_AGE_MS)===userId;
}
export function issueAdminEntry(userId:string){return issue("entry",userId)}
export function validAdminEntry(token:string|undefined){
 return verify(token,"entry",ENTRY_MAX_AGE_MS)!==null;
}
export const adminSessionCookieOptions = {
 httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const,path:"/admin"
};
