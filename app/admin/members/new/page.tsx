import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireOwner } from "@/lib/supabase/owner";
import { cardIssuanceReady } from "@/lib/laundry/card";
import { registerLaundryMember } from "@/app/admin/members/actions";
import RecoverableForm from "@/components/admin/recoverable-form";
import PendingSubmit from "@/components/admin/pending-submit";
type Props={searchParams:Promise<{error?:string;requestId?:string}>};
export default async function CreateMember({searchParams}:Props) {
  await requireOwner();
  const ready=cardIssuanceReady();
  const q=await searchParams;
  const err=q.error;
  const requestId=q.requestId && /^[0-9a-f-]{36}$/i.test(q.requestId) ? q.requestId : randomUUID();
  const messages:Record<string,string>={
    unavailable:"Pendaftaran belum dapat diproses. Hubungi pengelola.",
    invalid:"Periksa nama dan nomor WhatsApp yang dimasukkan.",
    consent:"Periksa nomor WhatsApp yang dimasukkan.",
    save:"Pelanggan belum tersimpan. Periksa koneksi lalu coba lagi."
  };
  return <main className="admin-workspace">
    <nav className="admin-breadcrumb" aria-label="Kembali"><Link href="/admin/members" className="admin-brand">← Data Pelanggan</Link></nav>
    <section className="admin-content admin-settings">
      <h1>Tambah Pelanggan</h1>
      <p className="admin-hint">Cukup isi nama. Nomor WhatsApp tidak wajib.</p>
      {!ready && <p className="admin-error" role="alert">Kartu belum dapat diterbitkan. Hubungi pengelola sebelum menyimpan data.</p>}
      {err && <p className="admin-error" role="alert">{messages[err] || messages.save}</p>}
      <RecoverableForm className="admin-form member-form" action={registerLaundryMember}>
        <input type="hidden" name="requestId" value={requestId}/>
        <label htmlFor="member-name">Nama pelanggan *</label>
        <input id="member-name" name="name" minLength={2} maxLength={100} autoComplete="name" placeholder="Nama pelanggan" required disabled={!ready}/>
        <label htmlFor="member-phone">WhatsApp (opsional)</label>
        <input id="member-phone" name="whatsapp" type="tel" autoComplete="tel" placeholder="08xxxxxxxxxx" inputMode="tel" disabled={!ready}/>
        <PendingSubmit disabled={!ready} label="Simpan Pelanggan"/>
      </RecoverableForm>
    </section>
  </main>;
}
