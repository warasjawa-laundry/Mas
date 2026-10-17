import Link from "next/link";
import {randomUUID} from "node:crypto";
import {notFound} from "next/navigation";
import {requireOwner} from "@/lib/supabase/owner";
import {memberNumber} from "@/lib/laundry/card";
import {correctOwnerVisit} from "@/app/admin/visits/actions";
import AmountVisitForm from "@/components/admin/amount-visit-form";
import MemberPromotions from "@/components/admin/member-promotions";
import {timeAdmin} from "@/lib/admin/timing";
import {historyPageNumber,historyPageHref,loadMemberHistory} from "@/lib/laundry/member-history";

type Props={params:Promise<{id:string}>,searchParams:Promise<{historyPage?:string;error?:string;recorded?:string;corrected?:string;requestId?:string;amountRequestId?:string;amountRecorded?:string;pointsEarned?:string;promoError?:string;promo?:string;promoRequestId?:string}>};
const validId=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export default async function OwnerMember({params,searchParams}:Props){
 const {supabase}=await requireOwner();
 const {id}=await params,notice=await searchParams;
 if(!validId.test(id))notFound();
 const historyPage=historyPageNumber(notice.historyPage);
 const pointYear=Number(new Intl.DateTimeFormat("en-US",{year:"numeric",timeZone:"Asia/Jakarta"}).format(new Date()));
 const [memberR,addsR,voidsR,historyR,promosR,balancesR,rulesR]=await timeAdmin("member.detail.queries", () => Promise.all([
  supabase.from("laundry_members").select("id,member_number,display_name,is_active,whatsapp_e164,whatsapp_promo_consent").eq("id",id).maybeSingle(),
  supabase.from("laundry_checklist_events").select("id",{count:"exact",head:true}).eq("member_id",id).eq("event_type","ADD"),
  supabase.from("laundry_checklist_events").select("id",{count:"exact",head:true}).eq("member_id",id).eq("event_type","VOID"),
  loadMemberHistory(supabase,id,historyPage),
  supabase.from("laundry_member_promotions")
    .select("id,title,terms,status,expires_at,created_at,redeemed_at,cancelled_at,cancel_reason")
    .eq("member_id",id).order("created_at",{ascending:false}).limit(100),
  supabase.rpc("laundry_owner_point_balances",{p_member_id:id}),
  supabase.from("laundry_point_rules").select("tiers,program_year,revision")
    .eq("program_year",pointYear).maybeSingle()
 ]));
 if(memberR.error || !memberR.data)notFound();
 const member=memberR.data;
 const failed=!!(addsR.error||voidsR.error);
 const total=(addsR.count??0)-(voidsR.count??0);
 const history=historyR.events;
 const corrected=historyR.corrected;
 const requestId=notice.requestId&&validId.test(notice.requestId)?notice.requestId:randomUUID();
 const promoRequestId=notice.promoRequestId&&validId.test(notice.promoRequestId)?notice.promoRequestId:randomUUID();
 const amountRequestId=notice.amountRequestId&&validId.test(notice.amountRequestId)?notice.amountRequestId:randomUUID();
 const amountMap=historyR.amounts;
 const currentPoints=(balancesR.data||[]).find((r:{program_year:number;points_total:number|string})=>r.program_year===pointYear);
 const nextPointYear=pointYear===2026?2027:pointYear+1;
 const futurePoints=(balancesR.data||[]).find((r:{program_year:number;points_total:number|string})=>r.program_year===nextPointYear);
 const pointRules=Array.isArray(rulesR.data?.tiers)?rulesR.data.tiers as {minimum:number;points:number}[]:[];
 const idr=(n:number)=>"Rp"+new Intl.NumberFormat("id-ID").format(n);

 return <main className="admin-workspace">
  <div className="admin-topbar"><Link href="/admin/members" className="admin-brand">← Daftar Member</Link><Link href="/admin/settings">Pengaturan</Link></div>
  <section className="admin-content owner-member-page">
   <p className="admin-kicker">CATAT TRANSAKSI</p><h1>{member.display_name}</h1>
   <p className="admin-hint">{memberNumber(member.member_number)} · {member.is_active?"Member aktif":"Member nonaktif"}</p>
   {notice.recorded==="1" && <p className="admin-success" role="status">1 transaksi berhasil dicatat.</p>}
   {notice.amountRecorded==="1" && <p className="admin-success" role="status">Transaksi berhasil dicatat. Poin bertambah {Number(notice.pointsEarned)||0}.</p>}
   {notice.corrected==="1" && <p className="admin-success" role="status">Transaksi berhasil dibatalkan dengan riwayat tetap tersimpan.</p>}
   {notice.error && <p className="admin-error" role="alert">
      {notice.error==="reason"?"Alasan pembatalan minimal 3 karakter.":notice.error==="amount"?"Isi nominal transaksi dan keterangan dengan benar.":notice.error==="rules"?"Aturan poin tahun ini belum tersedia. Hubungi pengelola database untuk memeriksa aturan poin.":"Perubahan gagal disimpan. Periksa koneksi dan coba lagi."}
    </p>}
   <div className="owner-count-box"><span>Total transaksi tercatat</span><strong>{failed?"—":total}</strong>
    <small>Hanya berubah saat pemilik menekan tombol dan penyimpanan berhasil.</small></div>
   <div className="owner-point-summary">
     <div><span>Saldo poin {pointYear}{pointYear===2026?" · Uji coba":""}</span><strong>{balancesR.error?"—":currentPoints?.points_total??0}</strong></div>
     {nextPointYear<=2100 && futurePoints && <div><span>Saldo program {nextPointYear}</span><strong>{balancesR.error?"—":futurePoints.points_total??0}</strong></div>}
   </div>
   {rulesR.error||!rulesR.data?
     <p className="admin-error">Aturan poin belum dimuat. Transaksi bernominal tidak dapat disimpan untuk sementara.</p>:
     <AmountVisitForm memberId={id} requestId={amountRequestId} memberActive={member.is_active}
       tiers={pointRules} year={pointYear}/>}
   <div className="owner-detail-jump-links"><Link href={`/admin/members/${id}/edit`} className="admin-logout">Ubah Data & WhatsApp</Link><Link href="#promo-member" className="admin-logout">Promo Member</Link><Link href={`/admin/members/${id}/card`} className="admin-logout">Kartu QR</Link></div>
   <h2 id="transaction-history">Riwayat transaksi</h2>
   <details className="owner-history-details" open={notice.historyPage!==undefined}>
    <summary>Lihat riwayat dan pembatalan</summary>
   {historyR.amountsFailed&&<p className="admin-error" role="alert">Nominal dan poin transaksi belum dapat dimuat. Coba lagi.</p>}
   {historyR.reversalsFailed&&<p className="admin-error" role="alert">Status pembatalan belum dapat dimuat. Muat ulang riwayat sebelum membatalkan transaksi.</p>}
   {historyR.failed?<p className="admin-error">Riwayat belum dapat dimuat. Coba lagi.</p>:history.length===0?
    <div className="member-empty">{historyPage===1?"Belum ada transaksi untuk member ini.":"Tidak ada transaksi di halaman ini."}</div>:
    <ul className="owner-visit-history">{history.map((event)=>{
      const isVoid=event.event_type==="VOID";
      const wasCorrected=corrected.has(event.id);
      return <li key={event.id}>
       <div><strong>{isVoid?"Pembatalan":historyR.reversalsFailed?"Transaksi · status belum dimuat":wasCorrected?"Transaksi dibatalkan":"+1 Transaksi"}</strong>
        <span>{new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Jakarta"}).format(new Date(event.occurred_at))} WIB</span>
        {!isVoid&&amountMap.has(event.id)&&<><small>{idr(Number(amountMap.get(event.id)!.amount_idr))} · {amountMap.get(event.id)!.description}</small>
        <small>+{amountMap.get(event.id)!.awarded_points} poin ({amountMap.get(event.id)!.program_year}) {wasCorrected?"· dibatalkan":""}</small></>}
        {!isVoid&&historyR.amountsFailed&&<small>Nominal dan poin belum dapat dimuat.</small>}
        {!isVoid&&!historyR.amountsFailed&&!amountMap.has(event.id)&&<small>Catatan lama tanpa nominal · 0 poin</small>}
        {isVoid&&<small>Alasan: {event.reason}</small>}
       </div>
       {!isVoid&&!historyR.reversalsFailed&&!wasCorrected&&<details className="owner-void-box"><summary>Batalkan</summary>
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
   {!historyR.failed&&(historyPage>1||historyR.hasOlder)&&<nav aria-label="Halaman riwayat transaksi" className="admin-member-pagination">
    {historyPage>1&&<Link prefetch={false} href={historyPageHref(id,historyPage-1)}>← Lebih baru</Link>}
    <span>Halaman {historyPage}{historyR.count!==null?` · ${historyR.count} catatan`:""}</span>
    {historyR.hasOlder&&<Link prefetch={false} href={historyPageHref(id,historyPage+1)}>Lebih lama →</Link>}
    {historyPage>1&&<Link prefetch={false} href={historyPageHref(id,1)}>Riwayat terbaru</Link>}
   </nav>}
   </details>
   <MemberPromotions memberId={id} memberName={member.display_name}
     requestId={promoRequestId} promos={promosR.data||[]}
     whatsappPhone={member.whatsapp_e164} whatsappConsent={member.whatsapp_promo_consent===true} memberActive={member.is_active}
     loadFailed={!!promosR.error} error={notice.promoError} result={notice.promo}/>
   <div className="admin-shortcuts"><Link href={`/admin/members/${id}/card`}>Lihat Kartu QR →</Link><Link href="/admin/scan">Scan Kartu Lain →</Link></div>
  </section>
 </main>;
}
