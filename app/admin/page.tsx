import Link from "next/link";
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
  const memberCount = membersR.error ? "—" : String(membersR.count ?? 0);
  const visitCount = addedR.error || voidR.error ? "—" : String(Math.max(0,(addedR.count ?? 0)-(voidR.count ?? 0)));

  return <main className="admin-workspace">
    <section className="admin-content admin-home" aria-labelledby="dashboard-title">
      <p className="admin-kicker">AREA PEMILIK</p>
      <h1 id="dashboard-title">Ringkasan operasional</h1>
      <p className="admin-hint">Pilih pekerjaan yang ingin diselesaikan. Scan kartu tidak otomatis mencatat transaksi.</p>
      <div className="admin-home-stats" aria-label="Ringkasan usaha">
        <div><span>Member aktif</span><strong>{memberCount}</strong></div>
        <div><span>Transaksi tercatat</span><strong>{visitCount}</strong></div>
      </div>
      <Link href="/admin/scan" className="admin-home-primary" prefetch={false}>
        <span><strong>Scan kartu member</strong><small>Buka kamera atau gunakan galeri HP</small></span>
        <span aria-hidden="true">→</span>
      </Link>
      <h2 className="admin-home-heading">Akses cepat</h2>
      <div className="admin-home-actions">
        <Link href="/admin/members" prefetch={false}><strong>Cari member</strong><small>Cari nama dan catat transaksi</small></Link>
        <Link href="/admin/members/new" prefetch={false}><strong>Tambah member</strong><small>Daftarkan pelanggan baru</small></Link>
        <Link href="/admin/settings" prefetch={false}><strong>Keamanan akun</strong><small>Ubah password pemilik</small></Link>
      </div>
      {(membersR.error||addedR.error||voidR.error) &&
        <p role="status" className="admin-error">Sebagian ringkasan belum berhasil dimuat. Scan dan pencarian member tetap dapat digunakan.</p>}
    </section>
  </main>;
}
