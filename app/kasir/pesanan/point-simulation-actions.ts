"use server";
import {getVerifiedOwner} from "@/lib/supabase/owner";
import {cashierRpcAccess} from "@/lib/pos/g4-server";
import {readPointSimulation,type PointSimulation} from "@/lib/pos/point-simulation";
export async function previewPointSimulation(role:'owner'|'cashier',items:string,deliveryCode:string,deliveryRevision:number):Promise<{data:PointSimulation|null;error:string}>{
 if(!['owner','cashier'].includes(role)||items.length>16000||!['NONE','FREE','NEAR','FAR'].includes(deliveryCode)||!Number.isSafeInteger(deliveryRevision)||deliveryRevision<1)return {data:null,error:'Pilihan layanan atau ongkir belum valid.'};
 let parsed:unknown;try{parsed=JSON.parse(items)}catch{return {data:null,error:'Pilihan layanan belum valid.'};}
 const owner=role==='owner'?await getVerifiedOwner():null;
 const cashier=role==='cashier'?await cashierRpcAccess('order_create'):null;
 const client=owner?.supabase??cashier?.client;
 if(!client)return {data:null,error:'Sesi atau izin membuat nota tidak tersedia.'};
 const {data,error}=await client.rpc('laundry_pos_point_simulation',{...(cashier?.tokens??{}),p_items:parsed,p_delivery_code:deliveryCode,p_delivery_revision:deliveryRevision});
 return error?{data:null,error:'Simulasi belum dapat dihitung. Katalog mungkin berubah; muat ulang layanan dan coba kembali.'}:{data:readPointSimulation(data),error:''};
}
