import Link from "next/link";
import { requireOwner } from "@/lib/supabase/owner";
import { logoutOwner } from "@/app/admin/actions";
export default async function OwnerScan() {
  await requireOwner();
  return <main className="admin-workspace">
    <header className="admin-topbar"><span className="admin-brand">MJ <strong>Mas Jawa Laundry</strong></span><form action={logoutOwner}><button type="submit" className="admin-logout">Keluar</button></form></header>
    <div className="admin-content">
      <p className="admin-kicker">AREA PEMILIK</p>
      <h1>Kelola Member Laundry</h1>
      <p className="admin-hint">Daftarkan pelanggan, cari member, dan cetak kartu QR dari HP. Semua dilakukan oleh pemilik.</p>
      <div className="no-print"><Link href="/admin/members" className="member-add">Buka Daftar Member →</Link></div><div className="admin-placeholder" style={{marginTop:"24px",minHeight:"190px"}}><span aria-hidden="true" className="admin-placeholder-icon">⌗</span><strong>Scanner kamera tahap berikutnya</strong><span>Memindai kartu belum mencatat transaksi secara otomatis. Fitur +1 transaksi menyusul.</span></div>
      <div className="admin-shortcuts"><Link href="/admin/members">Kelola Member →</Link><Link href="/admin/settings">Ubah Password →</Link><Link href="/">Kembali ke Beranda →</Link></div>
    </div>
  </main>;
}
