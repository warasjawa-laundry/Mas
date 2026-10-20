import "server-only";
import {createClient} from "@supabase/supabase-js";
import {assertQaPreviewIsolation} from "@/lib/supabase/qa-preview-isolation";
import {defaultServices} from "./defaults";
import type {PublishedService} from "./catalog";
export type RealtimeConfig={url:string;key:string};
export function catalogRealtimeConfig():RealtimeConfig|null{
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return null;
 let safe=key.startsWith("sb_publishable_");
 if(!safe){try{safe=JSON.parse(Buffer.from(key.split(".")[1],"base64url").toString()).role==="anon"}catch{}}
 return safe?{url,key}:null;
}
export async function readPublishedServices(){
 assertQaPreviewIsolation();
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 // The standalone public build retains its existing prices without a backend.
 if(!url||!key)return {services:defaultServices,failed:false};
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:"no-store"})}});
 try{
  const {data,error}=await client.from("laundry_services").select("id,category,package_name,name,price_idr,unit,duration,position").eq("is_visible",true).order("position").order("id").limit(200);
  return {services:(error?[]:data??[]) as PublishedService[],failed:!!error};
 }catch{return {services:[] as PublishedService[],failed:true}}
}

