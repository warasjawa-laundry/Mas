import {NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {readPublishedServices} from "@/lib/services/server";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const result=await readPublishedServices();
 const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
 if(result.failed)return NextResponse.json({error:"unavailable"},{status:503,headers});
 const etag='"'+createHash("sha256").update(JSON.stringify(result.services)).digest("hex")+'"';
 if(request.headers.get("if-none-match")===etag)return new Response(null,{status:304,headers:{...headers,ETag:etag}});
 return NextResponse.json({services:result.services},{headers:{...headers,ETag:etag}});
}

