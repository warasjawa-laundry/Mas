import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireOwner } from "@/lib/supabase/owner";
import { decryptCardToken, memberNumber, publicCardOrigin } from "@/lib/laundry/card";
import PrintCardButton from "@/components/admin/print-card-button";
import { reissueOwnerCard } from "@/app/admin/members/card/actions";
import { cardIssuanceReady } from "@/lib/laundry/card";
type Props={params:Promise<{id:string}>;searchParams:Promise<{reissueError?:string;reissued?:string;reissueRequestId?:string}>};
const validId=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export default async function MemberCard({params,searchParams}:Props) {
  const {supabase}=await requireOwner();
  const {id}=await params;
  if(!validId.test(id)) notFound();
  const notice=await searchParams;
  const allowReissue=process.env.OWNER_CARD_REISSUE_ENABLED==="1" && cardIssuanceReady();
  const requestId=notice.reissueRequestId&&validId.test(notice.reissueRequestId)?notice.reissueRequestId:randomUUID();
  const {data,error}=await supabase.rpc("laundry_owner_card_material",{p_member_id:id});
  const card=Array.isArray(data)?data[0]:null;
  if(error || !card) notFound();
  const token=decryptCardToken(card.token_ciphertext_hex);
  const path="/k/"+token;
  const link=publicCardOrigin()+path;
  const svg=await QRCode.toString(link,{type:"svg",errorCorrectionLevel:"M",margin:4,width:256,color:{dark:"#111827",light:"#ffffff"}});
  return <main className="admin-workspace">
    <nav className="admin-breadcrumb no-print" aria-label="Kembali"><Link href={"/admin/members/"+id}>← Kembali ke Member</Link></nav>
    <section className="admin-content print-card-page">
      <div className="no-print">
        <p className="admin-kicker">KARTU MEMBER</p><h1>Kartu Siap Cetak</h1>
        <p className="admin-hint">Periksa data lalu cetak melalui HP atau printer. Kartu tahap ini hanya untuk pengujian preview.</p>
        <p className="admin-error">KARTU UJI COBA — Jangan diberikan ke pelanggan sebelum halaman member dirilis di domain resmi.</p>
      </div>
      {notice.reissued==="1" && <p className="admin-success no-print" role="status">Kartu berhasil diganti. Kartu QR sebelumnya tidak dapat digunakan lagi.</p>}
      {notice.reissueError && <p className="admin-error no-print" role="alert">Penggantian kartu belum berhasil. Periksa alasan, izin fitur dan koneksi, lalu coba lagi.</p>}
      <div className="mj-card" aria-label="Kartu member Mas Jawa Laundry">
        <div className="mj-card-info">
          <div className="mj-card-heading">MJ <strong>MAS JAWA LAUNDRY</strong></div>
          <div className="mj-card-bottom"><small>KARTU UJI COBA — PREVIEW</small><strong>{card.display_name}</strong><span>{memberNumber(card.member_number)}</span></div>
        </div>
        <div className="mj-card-qr" dangerouslySetInnerHTML={{__html:svg}}/>
      </div>
      <p className="mj-card-watermark">CONTOH KARTU — PREVIEW</p>
      <div className="admin-shortcuts no-print"><PrintCardButton/><Link href={"/admin/members/"+id}>Catat transaksi</Link><Link href="/admin/members">Kembali ke Daftar</Link></div>
      <p className="member-note no-print">Cetak menggunakan ukuran asli 100%. Foto kartu yang berisi QR dapat digunakan orang lain untuk melihat progress terbatas. Jika hilang, hubungi pemilik untuk pembatalan.</p>
      {allowReissue && <details className="owner-card-reissue no-print">
        <summary>Ganti kartu yang hilang atau bocor</summary>
        <p className="admin-error">Tindakan ini langsung menonaktifkan QR lama. Riwayat transaksi, poin dan promo member tidak berubah. Pastikan pemilik kartu telah meminta penggantian.</p>
        <form action={reissueOwnerCard}>
          <input type="hidden" name="memberId" value={id}/>
          <input type="hidden" name="requestId" value={requestId}/>
          <label htmlFor="reissue-reason">Alasan penggantian kartu</label>
          <input id="reissue-reason" type="text" name="reason" minLength={3} maxLength={200} required placeholder="Contoh: kartu hilang"/>
          <label className="owner-reissue-confirm"><input type="checkbox" name="confirmInvalidation" value="yes" required/>
           <span>Saya memahami bahwa QR lama langsung tidak berlaku setelah kartu baru diterbitkan.</span></label>
          <button className="admin-primary" type="submit">Nonaktifkan QR Lama & Terbitkan Kartu Baru</button>
        </form>
      </details>}
    </section>
  </main>;
}
