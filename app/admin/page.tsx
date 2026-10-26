import Link from "next/link";
import MemberSearch from "@/components/admin/member-search";
import { requireOwner } from "@/lib/supabase/owner";
import { timeAdmin } from "@/lib/admin/timing";

export default async function AdminHome() {
  const { supabase } = await requireOwner();
  // Only three small count queries. Do not preload each customer's
  // transactions, WhatsApp or QR card material on the home screen.
  const [membersR, addedR, voidR] = await timeAdmin("admin.home.counts", () => Promise.all([
    supabase.from("laundry_members").select("id",{count:"exact",head:true}).eq("is_active",true),
    supabase.from("laundry_checklist_events").select("id",{count:"exact",head:true}).eq("event_type","ADD"),
    supabase.from("laundry_checklist_events").select("id",{count:"exact",head:true}).eq("event_type","VOID"),
  ]));
  const memberCount = membersR.error ? null : String(membersR.count ?? 0);
  const visitCount = addedR.error || voidR.error ? null : String(Math.max(0,(addedR.count ?? 0)-(voidR.count ?? 0)));

  return <main className="admin-workspace">
    <section className="admin-content admin-home" aria-labelledby="dashboard-title">
      <p className="admin-kicker">ADMIN</p>
      <h1 id="dashboard-title">Ringkasan</h1>
      <p className="admin-hint">Kelola transaksi dan kartu member Mas Jawa Laundry.</p>
      <section className="admin-transaction-entry" aria-labelledby="transaction-entry-title">
        <h2 id="transaction-entry-title">Catat transaksi</h2>
        <p>Cari nama pelanggan untuk membuka formulir transaksi.</p>
        <MemberSearch id="dashboard-member-search" />
        <div className="admin-scan-alternative"><span>Atau gunakan kartu member</span><Link href="/admin/scan" prefetch={false}>Scan QR <span aria-hidden="true">→</span></Link></div>
      </section>
      <div className="admin-home-stats" aria-label="Ringkasan seluruh data">
        <div><span>Member aktif</span>{memberCount===null?<p className="member-note">Belum dimuat</p>:<strong>{memberCount}</strong>}</div>
        <div><span>Total transaksi</span>{visitCount===null?<p className="member-note">Belum dimuat</p>:<strong>{visitCount}</strong>}<small>Seluruh periode, setelah pembatalan</small></div>
      </div>
      {(membersR.error||addedR.error||voidR.error) &&
        <p role="status" className="admin-error">Sebagian ringkasan belum berhasil dimuat. Scan dan pencarian member tetap dapat digunakan.</p>}
    </section>
  </main>;
}
