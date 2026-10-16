import type { Metadata } from "next";
import { createHash } from "node:crypto";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { validCardToken, memberNumber } from "@/lib/laundry/card";
type Props={params:Promise<{token:string}>};
export const metadata:Metadata={
  title:"Progress Member",robots:{index:false,follow:false,nocache:true},
  referrer:"no-referrer"
};
export const dynamic="force-dynamic";
export default async function MemberProgress({params}:Props) {
  const {token}=await params;
  if(!validCardToken(token)) notFound();
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!url || !key) throw new Error("Card portal not configured");
  const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const digest=createHash("sha256").update(token).digest("hex");
  const {data,error}=await supabase.rpc("laundry_public_card_progress",{p_digest_hex:digest});
  const item=Array.isArray(data)?data[0]:null;
  if(error) throw new Error("Unable to load member card");
  if(!item) notFound();
  const total=Number(item.visit_count)||0;
  const promos=Array.isArray(item.promos)?item.promos:[];
  return <main className="member-public">
    <div className="member-public-shell">
      <p className="admin-kicker">MAS JAWA LAUNDRY</p>
      <h1>Progress Member</h1>
      <p className="member-public-id">{memberNumber(item.member_number)}</p>
      <div className="member-count"><span>Transaksi tercatat</span><strong>{total}</strong><small>Checklist dicatat oleh pemilik laundry, bukan saat kartu di-scan.</small></div>
      <h2>Promo untuk Anda</h2>
      {promos.length ? <ul className="member-public-promos">{promos.slice(0,20).map((p:{title:string},i:number)=><li key={i}>{p.title}</li>)}</ul> : <p className="member-note">Belum ada promo khusus untuk kartu ini.</p>}
      <p className="member-note">Halaman ini hanya menampilkan informasi. Tunjukkan kartu ke pemilik laundry untuk mencatat transaksi.</p>
      <small className="member-public-foot">Mas Jawa Laundry · Tanpa login pelanggan</small>
    </div>
  </main>;
}
