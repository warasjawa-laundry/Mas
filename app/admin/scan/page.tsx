import Link from "next/link";
import { requireOwner } from "@/lib/supabase/owner";

import ScanCard from "@/components/admin/scan-card";
export default async function OwnerScan() {
  await requireOwner();
  return <main className="admin-workspace">
    <div className="admin-content">
      <p className="admin-kicker">TRANSAKSI</p>
      <h1>Scan barcode / QR member</h1>
      <p className="admin-hint">Scan barcode nomor member MJL atau QR kartu lama untuk membuka data pelanggan. Scan tidak mencatat transaksi atau poin.</p>
      <ScanCard/>
      <div className="admin-shortcuts"><Link href="/admin">← Kembali ke Ringkasan</Link></div>
    </div>
  </main>;
}
