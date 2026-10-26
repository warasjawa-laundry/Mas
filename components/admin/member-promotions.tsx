import { grantManualPromo, finishManualPromo } from "@/app/admin/promotions/actions";
import PendingSubmit from "@/components/admin/pending-submit";
import PromoWhatsapp from "@/components/admin/promo-whatsapp";
import RecoverableForm from "@/components/admin/recoverable-form";

type Promotion = {
  id:string;title:string;terms:string|null;status:string;
  expires_at:string|null;created_at:string;
  redeemed_at:string|null;cancelled_at:string|null;cancel_reason:string|null;
};
type Props={
  memberId:string;
  memberName:string;
  requestId:string;
  promos:Promotion[];
  error?:string;
  result?:string;
  loadFailed:boolean;
  whatsappPhone:string|null;
  whatsappConsent:boolean;
  memberActive:boolean;
};
function wibDate(date:string) {
  return new Intl.DateTimeFormat("id-ID",{
    day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Jakarta"
  }).format(new Date(date));
}
const descriptions:Record<string,string>={
  invalid:"Periksa judul, ketentuan dan tanggal berlaku promo.",
  reason:"Alasan pembatalan minimal 3 karakter.",
  save:"Promo belum berhasil disimpan. Periksa koneksi dan coba lagi.",
  finish:"Status promo belum berhasil diubah. Periksa statusnya lalu coba lagi."
};
const results:Record<string,string>={
  created:"Promo berhasil diberikan kepada member.",
  used:"Promo telah ditandai sebagai digunakan.",
  cancelled:"Promo telah dibatalkan."
};

export default function MemberPromotions({
 memberId,memberName,requestId,promos,error,result,loadFailed,whatsappPhone,whatsappConsent,memberActive
}:Props){
 return <section id="promo-member" className="owner-promo-section" aria-labelledby="promo-owner-heading">
   <div className="owner-promo-header">
     <div>
       <h2 id="promo-owner-heading">Promo Member</h2>
       <p className="member-note">Buat promo khusus untuk member ini. Poin tidak otomatis ditukar menjadi promo.</p>
     </div>
   </div>
   {!memberActive&&<p className="admin-error">Member nonaktif. Promo tidak dapat diberikan atau digunakan.</p>}
   {result && results[result] && <p className="admin-success" role="status">{results[result]}</p>}
   {error && <p className="admin-error" role="alert">{descriptions[error]??descriptions.save}</p>}
   <details className="owner-promo-create" open={!!error||promos.length===0}>
     <summary>+ Berikan Promo</summary>
     <RecoverableForm action={grantManualPromo} className="owner-promo-form">
       <input type="hidden" name="memberId" value={memberId}/>
       <input type="hidden" name="requestId" value={requestId}/>
       <p>Promo untuk <strong>{memberName}</strong>.</p>
       <fieldset className="promo-fields" disabled={!memberActive}>
       <label htmlFor="promo-title">Nama promo *</label>
       <input id="promo-title" name="title" minLength={3} maxLength={120} required
         placeholder="Contoh: Diskon cuci 10%"/>
       <label htmlFor="promo-terms">Ketentuan (opsional)</label>
       <textarea id="promo-terms" name="terms" rows={3} maxLength={2000}
         placeholder="Contoh: berlaku sekali untuk layanan reguler"/>
       <label htmlFor="promo-date">Berlaku sampai (opsional)</label>
       <input id="promo-date" name="expires" type="date"/>
       <p className="member-note">Tanggal berakhir pada pukul 23.59 WIB. Tidak ada pemberitahuan WhatsApp otomatis.</p>
       <PendingSubmit label="Simpan Promo untuk Member"/>
       </fieldset>
     </RecoverableForm>
   </details>
   {loadFailed ? <p className="admin-error" role="alert">Daftar promo belum dapat dimuat. Coba lagi.</p>
    : !promos.length ? <p className="member-note owner-promo-empty">Belum ada promo untuk member ini.</p>
    : <ul className="owner-promo-list">{promos.map(p=>{
      const expired=p.status==="AVAILABLE"&&!!p.expires_at&&new Date(p.expires_at).getTime()<=Date.now();
      const label=p.status==="USED"?"Digunakan":p.status==="CANCELLED"?"Dibatalkan":expired?"Kedaluwarsa":"Tersedia";
      return <li key={p.id} className="owner-promo-item">
        <div className="owner-promo-title"><strong>{p.title}</strong></div>
        <div className="owner-promo-status-row"><span className="owner-promo-status">{label}</span></div>
        {p.terms&&<p>{p.terms}</p>}
        <small>Diberikan {wibDate(p.created_at)}{p.expires_at?" · Berakhir "+wibDate(p.expires_at):""}</small>
        {p.status==="USED"&&p.redeemed_at&&<small>Dipakai {wibDate(p.redeemed_at)}</small>}
        {p.status==="CANCELLED"&&<small>Dibatalkan{p.cancel_reason?": "+p.cancel_reason:""}</small>}
        {p.status==="AVAILABLE" && !expired && memberActive && <details className="owner-promo-whatsapp">
          <summary>Siapkan pesan WhatsApp</summary>
          <PromoWhatsapp memberId={memberId} promoId={p.id} memberName={memberName} title={p.title} terms={p.terms}
            expiresAt={p.expires_at} whatsappPhone={whatsappPhone}
            whatsappConsent={whatsappConsent} memberActive={memberActive}/>
        </details>}
        {p.status==="AVAILABLE" && memberActive && <div className="owner-promo-actions">
          {!expired&&<details className="owner-promo-use"><summary>Tandai Digunakan</summary><p>Pastikan member sudah menggunakan promo ini. Status akan berubah menjadi Digunakan.</p><RecoverableForm action={finishManualPromo}>
            <input type="hidden" name="memberId" value={memberId}/>
            <input type="hidden" name="promoId" value={p.id}/>
            <input type="hidden" name="action" value="USE"/>
            <PendingSubmit className="admin-logout" label="Konfirmasi penggunaan"/>
          </RecoverableForm></details>}
          <details className="owner-promo-cancel">
            <summary>Batalkan Promo</summary>
            <RecoverableForm action={finishManualPromo}>
              <input type="hidden" name="memberId" value={memberId}/>
              <input type="hidden" name="promoId" value={p.id}/>
              <input type="hidden" name="action" value="CANCEL"/>
              <label htmlFor={"promo-reason-"+p.id}>Alasan pembatalan</label>
              <input id={"promo-reason-"+p.id} name="reason" minLength={3} maxLength={500}
                placeholder="Contoh: promo salah diberikan" required/>
              <PendingSubmit className="admin-logout" label="Konfirmasi Pembatalan"/>
            </RecoverableForm>
          </details>
        </div>}
      </li>;
    })}</ul>}
 </section>;
}
