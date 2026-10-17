import type { Metadata } from "next";
import "./progress.css";
import { createHash } from "node:crypto";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { validCardToken, memberNumber } from "@/lib/laundry/card";
import {currentProgramYear} from "@/lib/laundry/program-years";
import { assertQaPreviewIsolation } from "@/lib/supabase/qa-preview-isolation";
type Props={params:Promise<{token:string}>};
export const metadata:Metadata={
  title:"Catatan Kartu Member",robots:{index:false,follow:false,nocache:true},
  referrer:"no-referrer"
};
export const dynamic="force-dynamic";
export default async function MemberProgress({params}:Props) {
  assertQaPreviewIsolation();
  const {token}=await params;
  if(!validCardToken(token)) notFound();
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!url || !key) throw new Error("Card portal not configured");
  const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const digest=createHash("sha256").update(token).digest("hex");
  const [progressR,balancesR]=await Promise.all([
    supabase.rpc("laundry_public_card_progress",{p_digest_hex:digest}),
    supabase.rpc("laundry_public_point_balances",{p_digest_hex:digest})
  ]);
  const {data,error}=progressR;
  const item=Array.isArray(data)?data[0]:null;
  if(error) throw new Error("Unable to load member card");
  if(!item) notFound();
  const total=Number(item.visit_count)||0;
  const promos=Array.isArray(item.promos)?item.promos:[];
  const pointYears=Array.isArray(balancesR.data)?balancesR.data:[];
  const year=Math.max(2027,currentProgramYear());
  const official=pointYears.find((row:{program_year:number})=>row.program_year===year);
  const previous=year>2027?pointYears.find((row:{program_year:number})=>row.program_year===year-1):null;
  const trial=pointYears.find((row:{program_year:number})=>row.program_year===2026);
  return <main className="member-public">
    <div className="member-public-shell">
      <p className="admin-kicker">MAS JAWA LAUNDRY</p>
      <h1>Catatan Kartu Member</h1>
      <p className="member-public-id">{memberNumber(item.member_number)}</p>
      <div className="member-count"><span>Transaksi tercatat</span><strong>{total}</strong><small>Jumlah diperbarui setelah petugas mencatat transaksi.</small></div>
      <section className="member-point-progress" aria-labelledby="member-point-heading">
        <h2 id="member-point-heading">Poin transaksi</h2>
        {balancesR.error?<p className="member-note">Poin belum dapat dimuat. Coba lagi nanti.</p>:
        <>{official?<div className="member-point-primary">
          <span>{year===2027?"Saldo program 2027":"Saldo program "+year}</span>
          <strong>{Number(official.points_total)||0} poin</strong>
          <small>Poin dihitung dari nominal transaksi yang dicatat petugas pada tahun {year}.</small>
        </div>:<p className="member-note">Aturan poin tahun {year} belum tersedia. Saldo tahun ini belum dapat ditampilkan.</p>}
        {previous && <p className="member-point-trial">Catatan poin {year-1} (tahun sebelumnya): <strong>{Number(previous.points_total)||0} poin</strong></p>}
        {trial && <p className="member-point-trial">Catatan poin 2026 (uji coba, terpisah): <strong>{Number(trial.points_total)||0} poin</strong></p>}</>}
        <p className="member-note">Pindai QR hanya untuk melihat catatan. Poin diperbarui setelah petugas menyimpan nominal transaksi dan disesuaikan jika transaksi dibatalkan.</p>
      </section>
      <h2>Promo pada kartu ini</h2>
      {promos.length ? <ul className="member-public-promos">{promos.slice(0,20).map((p:{title:string},i:number)=><li key={i}>{p.title}</li>)}</ul> : <p className="member-note">Belum ada promo khusus untuk kartu ini.</p>}
      <p className="member-note">Untuk mencatat transaksi baru, tunjukkan kartu kepada petugas saat laundry.</p>
      <small className="member-public-foot">Mas Jawa Laundry · Tanpa login pelanggan</small>
    </div>
  </main>;
}
