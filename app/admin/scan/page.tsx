import Link from "next/link";
import { requireOwner } from "@/lib/supabase/owner";
import { logoutOwner } from "@/app/admin/actions";
export default async function OwnerScan() {
  await requireOwner();
  return <main className="admin-workspace">
    <header className="admin-topbar"><span className="admin-brand">MJ <strong>Mas Jawa Laundry</strong></span><form action={logoutOwner}><button type="submit" className="admin-logout">Keluar</button></form></header>
    <div className="admin-content">
      <p className="admin-kicker">AREA PEMILIK</p>
      <h1>Scan Kartu Member</h1>
      <p className="admin-hint">Login sudah tersedia. Scanner kamera dan pencatatan transaksi akan diaktifkan pada tahap selanjutnya.</p>
      <div className="admin-placeholder"><span aria-hidden="true" className="admin-placeholder-icon">⌗</span><strong>Scanner belum diaktifkan</strong><span>Fitur ini sedang disiapkan. Tidak ada transaksi yang akan tercatat di halaman ini.</span></div>
      <div className="admin-shortcuts"><Link href="/admin/settings">Ubah Password →</Link><Link href="/">Kembali ke Beranda →</Link></div>
    </div>
  </main>;
}
