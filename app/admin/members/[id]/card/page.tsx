import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireOwner } from "@/lib/supabase/owner";
import { decryptCardToken, memberNumber, publicCardOrigin } from "@/lib/laundry/card";
import PrintCardButton from "@/components/admin/print-card-button";
type Props={params:Promise<{id:string}>};
export default async function MemberCard({params}:Props) {
  const {supabase}=await requireOwner();
  const {id}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const {data,error}=await supabase.rpc("laundry_owner_card_material",{p_member_id:id});
  const card=Array.isArray(data)?data[0]:null;
  if(error || !card) notFound();
  const token=decryptCardToken(card.token_ciphertext_hex);
  const path="/k/"+token;
  const link=publicCardOrigin()+path;
  const svg=await QRCode.toString(link,{type:"svg",errorCorrectionLevel:"M",margin:4,width:256,color:{dark:"#111827",light:"#ffffff"}});
  return <main className="admin-workspace">
    <div className="admin-topbar no-print"><Link href="/admin/members" className="admin-brand">← Daftar Member</Link><Link href="/admin/settings">Pengaturan</Link></div>
    <section className="admin-content print-card-page">
      <div className="no-print">
        <p className="admin-kicker">KARTU MEMBER</p><h1>Kartu Siap Cetak</h1>
        <p className="admin-hint">Periksa data lalu cetak melalui HP atau printer. Kartu tahap ini hanya untuk pengujian preview.</p>
        <p className="admin-error">KARTU UJI COBA — Jangan diberikan ke pelanggan sebelum halaman member dirilis di domain resmi.</p>
      </div>
      <div className="mj-card" aria-label="Kartu member Mas Jawa Laundry">
        <div className="mj-card-info">
          <div className="mj-card-heading">MJ <strong>MAS JAWA LAUNDRY</strong></div>
          <div className="mj-card-bottom"><small>KARTU MEMBER</small><strong>{card.display_name}</strong><span>{memberNumber(card.member_number)}</span></div>
        </div>
        <div className="mj-card-qr" dangerouslySetInnerHTML={{__html:svg}}/>
      </div>
      <p className="mj-card-watermark">CONTOH KARTU — PREVIEW</p>
      <div className="admin-shortcuts no-print"><PrintCardButton/><Link href="/admin/members">Kembali ke Daftar</Link></div>
      <p className="member-note no-print">Cetak menggunakan ukuran asli 100%. Foto kartu yang berisi QR dapat digunakan orang lain untuk melihat progress terbatas. Jika hilang, hubungi pemilik untuk pembatalan.</p>
    </section>
  </main>;
}
