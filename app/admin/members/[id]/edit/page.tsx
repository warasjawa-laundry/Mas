import Link from "next/link";
import {randomUUID} from "node:crypto";
import {notFound} from "next/navigation";
import {requireOwner} from "@/lib/supabase/owner";
import {memberNumber} from "@/lib/laundry/card";
import {updateMemberContact} from "@/app/admin/members/contact/actions";
import RecoverableForm from "@/components/admin/recoverable-form";
import PendingSubmit from "@/components/admin/pending-submit";

type Props={
  params:Promise<{id:string}>;
  searchParams:Promise<{error?:string;result?:string}>;
};
const validUUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const errors:Record<string,string>={
  invalid:"Periksa nama dan nomor WhatsApp.",
  consent:"Perubahan belum dapat disimpan. Periksa kembali data pelanggan.",
  conflict:"Data pelanggan sudah berubah dari perangkat lain. Periksa data terbaru lalu simpan kembali.",
  save:"Perubahan belum berhasil disimpan. Periksa koneksi lalu coba lagi."
};
export default async function EditMember({params,searchParams}:Props) {
  const {supabase}=await requireOwner();
  const {id}=await params;
  if(!validUUID.test(id))notFound();
  const notice=await searchParams;
  const [memberR,changesR,importR]=await Promise.all([
    supabase.from("laundry_members")
      .select("id,member_number,display_name,whatsapp_e164,whatsapp_promo_consent,whatsapp_consent_at,member_edit_revision,is_active,address")
      .eq("id",id).maybeSingle(),
    supabase.from("laundry_member_contact_events")
      .select("id,action,name_changed,phone_changed,consent_before,consent_after,created_at")
      .eq("member_id",id).order("created_at",{ascending:false}).limit(8),
    supabase.from("laundry_member_import_rows").select("source_phone,phone_needs_review")
      .eq("member_id",id).eq("phone_needs_review",true).limit(1)
  ]);
  if(memberR.error || !memberR.data)notFound();
  const member=memberR.data;
  return <main className="admin-workspace">
    <nav className="admin-breadcrumb" aria-label="Kembali"><Link href={"/admin/members/"+id}>← Profil Pelanggan</Link></nav>
    <section className="admin-content owner-member-edit">
      <h1>Ubah Data Pelanggan</h1>
      <p className="admin-hint"><strong>{member.display_name}</strong> · {memberNumber(member.member_number)}</p>
      <p className="member-note">Perbarui nama atau nomor WhatsApp pelanggan. Nomor pelanggan tetap sama.</p>

      {notice.result==="saved" && <p className="admin-success" role="status">Data pelanggan berhasil diperbarui.</p>}
      {notice.result==="unchanged" && <p className="admin-success" role="status">Tidak ada perubahan data.</p>}
      {notice.error && <p className="admin-error" role="alert">{errors[notice.error]||errors.save}</p>}
      {!member.is_active && <p className="admin-error" role="alert">Pelanggan ini tidak aktif. Data tidak dapat diedit.</p>}
      {member.address&&<p className="member-note">Alamat: {member.address}</p>}
      {importR.data?.[0]&&!member.whatsapp_e164&&<p className="admin-error" role="alert">Nomor dari Excel perlu diperiksa: {importR.data[0].source_phone}. Masukkan nomor yang benar pada kolom WhatsApp di bawah.</p>}

      <RecoverableForm action={updateMemberContact} className="owner-edit-card">
        <input type="hidden" name="memberId" value={id}/>
        <input type="hidden" name="requestId" value={randomUUID()}/>
        <input type="hidden" name="expectedRevision" value={member.member_edit_revision}/>
        <input type="hidden" name="consentAction" value="KEEP"/>
        <label htmlFor="edit-member-name">Nama pelanggan</label>
        <input id="edit-member-name" name="name" type="text" minLength={2} maxLength={100}
          defaultValue={member.display_name} autoComplete="name" required disabled={!member.is_active}/>

        <label htmlFor="edit-member-phone">Nomor WhatsApp (opsional)</label>
        <input id="edit-member-phone" name="whatsapp" type="tel" inputMode="tel"
          autoComplete="tel" placeholder="08xxxxxxxxxx"
          defaultValue={member.whatsapp_e164??""} disabled={!member.is_active}/>
        <p className="admin-helper">Kosongkan jika pelanggan tidak memakai WhatsApp.</p>
        <div className="owner-edit-actions">
          <PendingSubmit label="Simpan Perubahan" disabled={!member.is_active}/>
          <Link href={"/admin/members/"+id} className="admin-logout">Batal</Link>
        </div>
      </RecoverableForm>

      <section className="owner-contact-history" aria-labelledby="member-contact-history-heading">
        <h2 id="member-contact-history-heading">Riwayat perubahan data</h2>
        <p className="member-note">Nomor WhatsApp lama tidak ditampilkan dalam riwayat.</p>
        {changesR.error ? <p className="admin-error">Riwayat belum bisa dimuat.</p> :
          !changesR.data?.length ? <p className="member-note">Belum ada perubahan data setelah fitur ini diaktifkan.</p> :
          <ul>{changesR.data.map(e=><li key={e.id}>
            <strong>{e.action==="UNCHANGED"?"Tidak ada perubahan":e.phone_changed?"Nomor WhatsApp diperbarui":"Data pelanggan diperbarui"}</strong>
            <small>{new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Jakarta"}).format(new Date(e.created_at))} WIB</small>
            {(e.name_changed||e.phone_changed)&&<small>{[
              e.name_changed?"Nama":"Nomor WhatsApp"].filter(Boolean).join(" dan ")} diperbarui</small>}
          </li>)}</ul>}
      </section>
    </section>
  </main>;
}
