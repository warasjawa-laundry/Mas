import Link from "next/link";
import {randomUUID} from "node:crypto";
import {notFound} from "next/navigation";
import {requireOwner} from "@/lib/supabase/owner";
import {memberNumber} from "@/lib/laundry/card";
import {recordOwnerVisit,correctOwnerVisit} from "@/app/admin/visits/actions";
import VisitSubmitButton from "@/components/admin/visit-submit-button";
import MemberPromotions from "@/components/admin/member-promotions";

type Props={params:Promise<{id:string}>,searchParams:Promise<{error?:string;recorded?:string;corrected?:string;requestId?:string;promoError?:string;promo?:string;promoRequestId?:string}>};
const validId=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export default async function OwnerMember({params,searchParams}:Props){
 const {supabase}=await requireOwner();
 const {id}=await params,notice=await searchParams;
 if(!validId.test(id))notFound();
 const [memberR,addsR,voidsR,historyR,promosR]=await Promise.all([
  supabase.from("laundry_members").select("id,member_number,display_name,is_active,whatsapp_e164,whatsapp_promo_consent").eq("id",id).maybeSingle(),
  supabase.from("laundry_checklist_events").select("id",{count:"exact",head:true}).eq("member_id",id).eq("event_type","ADD"),
  supabase.from("laundry_checklist_events").select("id",{count:"exact",head:true}).eq("member_id",id).eq("event_type","VOID"),
  supabase.from("laundry_checklist_events")
    .select("id,event_type,reverses_event_id,reason,occurred_at")
    .eq("member_id",id).order("occurred_at",{ascending:false}).limit(30),
  supabase.from("laundry_member_promotions")
    .select("id,title,terms,status,expires_at,created_at,redeemed_at,cancelled_at,cancel_reason")
    .eq("member_id",id).order("created_at",{ascending:false}).limit(100)
 ]);
 if(memberR.error || !memberR.data)notFound();
 const member=memberR.data;
 const failed=!!(addsR.error||voidsR.error||historyR.error);
 const total=(addsR.count??0)-(voidsR.count??0);
 const history=historyR.data||[];
 const corrected=new Set(history.filter(e=>e.event_type==="VOID").map(e=>e.reverses_event_id));
 const requestId=notice.requestId&&validId.test(notice.requestId)?notice.requestId:randomUUID();
 const promoRequestId=notice.promoRequestId&&validId.test(notice.promoRequestId)?notice.promoRequestId:randomUUID();
 return <main className="admin-workspace">
  <div className="admin-topbar"><Link href="/admin/members" className="admin-brand">← Daftar Member</Link><Link href="/admin/settings">Pengaturan</Link></div>
  <section className="admin-content owner-member-page">
   <p className="admin-kicker">CATAT TRANSAKSI</p><h1>{member.display_name}</h1>
   <p className="admin-hint">{memberNumber(member.member_number)} · {member.is_active?"Member aktif":"Member nonaktif"}</p>
   <div className="owner-detail-jump-links"><Link href={`/admin/members/${id}/edit`} className="admin-logout">Ubah Data & WhatsApp</Link><Link href="#promo-member" className="admin-logout">Promo Member</Link><Link href={`/admin/members/${id}/card`} className="admin-logout">Kartu QR</Link></div>
   {notice.recorded==="1" && <p className="admin-success" role="status">1 transaksi berhasil dicatat.</p>}
   {notice.corrected==="1" && <p className="admin-success" role="status">Transaksi berhasil dibatalkan dengan riwayat tetap tersimpan.</p>}
   {notice.error && <p className="admin-error" role="alert">
      {notice.error==="reason"?"Alasan pembatalan minimal 3 karakter.":"Perubahan gagal disimpan. Periksa koneksi dan coba lagi."}
    </p>}
   <div className="owner-count-box"><span>Total transaksi tercatat</span><strong>{failed?"—":total}</strong>
    <small>Hanya berubah saat pemilik menekan tombol dan penyimpanan berhasil.</small></div>
   <form action={recordOwnerVisit} className="owner-record-form">
    <input type="hidden" name="memberId" value={id}/>
    <input type="hidden" name="requestId" value={requestId}/>
    <VisitSubmitButton/>
   </form>
   <p className="member-note">Scan QR saja tidak menambah transaksi. Jika salah catat, gunakan Batalkan pada riwayat.</p>
   <h2>Riwayat transaksi</h2>
   {failed?<p className="admin-error">Riwayat belum dapat dimuat. Coba lagi.</p>:history.length===0?
    <div className="member-empty">Belum ada transaksi untuk member ini.</div>:
    <ul className="owner-visit-history">{history.map((event)=>{
      const isVoid=event.event_type==="VOID";
      const wasCorrected=corrected.has(event.id);
      return <li key={event.id}>
       <div><strong>{isVoid?"Pembatalan":wasCorrected?"Transaksi dibatalkan":"+1 Transaksi"}</strong>
        <span>{new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Jakarta"}).format(new Date(event.occurred_at))} WIB</span>
        {isVoid&&<small>Alasan: {event.reason}</small>}
       </div>
       {!isVoid&&!wasCorrected&&<details className="owner-void-box"><summary>Batalkan</summary>
         <form action={correctOwnerVisit}>
           <input type="hidden" name="memberId" value={id}/>
           <input type="hidden" name="eventId" value={event.id}/>
           <input type="hidden" name="requestId" value={randomUUID()}/>
           <label htmlFor={`why-${event.id}`}>Alasan pembatalan</label>
           <input id={`why-${event.id}`} name="reason" minLength={3} maxLength={500} required placeholder="Contoh: salah pencatatan" />
           <button type="submit" className="admin-logout">Konfirmasi Pembatalan</button>
         </form>
       </details>}
      </li>;
    })}</ul>}
   <MemberPromotions memberId={id} memberName={member.display_name}
     requestId={promoRequestId} promos={promosR.data||[]}
     whatsappPhone={member.whatsapp_e164} whatsappConsent={member.whatsapp_promo_consent===true} memberActive={member.is_active}
     loadFailed={!!promosR.error} error={notice.promoError} result={notice.promo}/>
   <div className="admin-shortcuts"><Link href={`/admin/members/${id}/card`}>Lihat Kartu QR →</Link><Link href="/admin/scan">Scan Kartu Lain →</Link></div>
  </section>
 </main>;
}
