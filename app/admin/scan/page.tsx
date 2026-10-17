import Link from "next/link";
import { requireOwner } from "@/lib/supabase/owner";
import { logoutOwner } from "@/app/admin/actions";
import ScanCard from "@/components/admin/scan-card";
export default async function OwnerScan() {
  await requireOwner();
  return <main className="admin-workspace">
    <header className="admin-topbar"><span className="admin-brand">MJ <strong>Mas Jawa Laundry</strong></span><form action={logoutOwner}><button type="submit" className="admin-logout">Keluar</button></form></header>
    <div className="admin-content">
      <p className="admin-kicker">AREA PEMILIK</p>
      <h1>Scan Kartu & Transaksi</h1>
      <p className="admin-hint">Scan kartu pelanggan atau cari namanya. Pilih member lalu tekan Catat 1 Transaksi untuk menambah checklist.</p>
      <ScanCard/>
      <div className="admin-shortcuts"><a href="/admin/leave">Kembali ke Beranda →</a></div>
    </div>
  </main>;
}
