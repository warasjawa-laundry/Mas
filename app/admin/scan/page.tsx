import Link from "next/link";
import { requireOwner } from "@/lib/supabase/owner";

import ScanCard from "@/components/admin/scan-card";
export default async function OwnerScan() {
  await requireOwner();
  return <main className="admin-workspace">
    <div className="admin-content">
      <p className="admin-kicker">TRANSAKSI</p>
      <h1>Scan kartu member</h1>
      <p className="admin-hint">Scan QR untuk memilih member. Setelah itu, isi nominal dan keterangan transaksi.</p>
      <ScanCard/>
      <div className="admin-shortcuts"><Link href="/admin">← Kembali ke Ringkasan</Link></div>
    </div>
  </main>;
}
