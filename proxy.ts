import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { assertQaPreviewIsolation } from "@/lib/supabase/qa-preview-isolation";
import { ADMIN_ACCESS_COOKIE, ADMIN_ENTRY_COOKIE, adminSessionCookieOptions, validAdminEntry } from "@/lib/admin/entry-pass";

function isDocumentEntry(request:NextRequest):boolean {
 if(request.method!=="GET")return false;
 const h=request.headers;
 const routerFetch=h.has("rsc")||h.has("next-router-state-tree")||
   h.has("next-router-prefetch")||h.has("next-action")||
   h.get("purpose")==="prefetch";
 if(routerFetch)return false;
 // Missing Fetch-Metadata headers are treated as document requests (fail closed).
 return !h.has("sec-fetch-dest")||h.get("sec-fetch-dest")==="document"||
   h.get("sec-fetch-mode")==="navigate";
}
function isPublicToAdminRouterEntry(request:NextRequest):boolean {
 if(request.method!=="GET"||!request.headers.has("rsc"))return false;
 const previous=request.headers.get("next-url");
 return !!previous && previous!=="null" &&
   !previous.startsWith("/admin") && previous.startsWith("/");
}
function clearAdminCookies(request:NextRequest,response:NextResponse){
 for(const name of [ADMIN_ACCESS_COOKIE,ADMIN_ENTRY_COOKIE]){
   request.cookies.delete(name);
   response.cookies.set(name,"",{...adminSessionCookieOptions,maxAge:0});
 }
}
function clearSupabaseCookies(request:NextRequest,response:NextResponse){
 for(const cookie of request.cookies.getAll()){
   if(/^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/.test(cookie.name)){
     request.cookies.delete(cookie.name);
     response.cookies.set(cookie.name,"",{path:"/",httpOnly:false,
       sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:0});
   }
 }
}

export async function proxy(request:NextRequest){
 assertQaPreviewIsolation();
 const path=request.nextUrl.pathname;
 const leave=path==="/admin/leave";
 const login=path==="/admin/login";
 const document=isDocumentEntry(request);
 const reenter=isPublicToAdminRouterEntry(request);
 const incomingEntry=request.cookies.get(ADMIN_ENTRY_COOKIE)?.value;
 const entryAllowed=!leave&&!login&&document&&validAdminEntry(incomingEntry);
 // The login screen itself always clears an existing grant, including an RSC
 // navigation from within admin. A login URL never serves as a backdoor.
 const reset=leave||document||reenter||(login&&request.method==="GET");
 let response=leave
   ?NextResponse.redirect(new URL("/",request.url),303)
   :!login&&reset&&!entryAllowed
     ?NextResponse.redirect(new URL("/admin/login?notice=reauth",request.url),303)
     :NextResponse.next({request});
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(reset){
   // The one-use allowance only covers a native form's first redirect after a
   // successful password check. It is consumed before any subsequent refresh.
   if(entryAllowed){
     request.cookies.delete(ADMIN_ENTRY_COOKIE);
     response.cookies.set(ADMIN_ENTRY_COOKIE,"",{...adminSessionCookieOptions,maxAge:0});
     return response;
   }
   clearAdminCookies(request,response);
   if(url&&key){
     const supabase=createServerClient(url,key,{cookies:{
       getAll:()=>request.cookies.getAll(),
       setAll:(items)=>{
         items.forEach(({name,value})=>request.cookies.set(name,value));
         items.forEach(({name,value,options})=>response.cookies.set(name,value,{
           ...options,secure:process.env.NODE_ENV==="production"
         }));
       }
     }});
     // Scope local: don't log out other machines; invalidate this browser
     // session even if another owner page was previously left open.
     try{await supabase.auth.signOut({scope:"local"});}catch{}
   }
   // Fail closed if the Auth service is unavailable.
   clearSupabaseCookies(request,response);
   return response;
 }
 if(!url||!key)return response;
 const supabase=createServerClient(url,key,{cookies:{
   getAll:()=>request.cookies.getAll(),
   setAll:(items)=>{
     items.forEach(({name,value})=>request.cookies.set(name,value));
     response=NextResponse.next({request});
     items.forEach(({name,value,options})=>response.cookies.set(name,value,{
       ...options,secure:process.env.NODE_ENV==="production"
     }));
   }
 }});
 await supabase.auth.getClaims();
 return response;
}
export const config={matcher:["/admin/:path*"]};
