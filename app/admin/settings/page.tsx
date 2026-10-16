import Link from "next/link";
import { requireOwner } from "@/lib/supabase/owner";
import { changeOwnerPassword } from "@/app/admin/actions";

type Props = { searchParams: Promise<{ error?: string }> };
export default async function OwnerSettings({ searchParams }: Props) {
  await requireOwner();
  const { error } = await searchParams;
  return <main className="admin-workspace"><header className="admin-topbar"><Link href="/admin/scan" className="admin-brand">← Mas Jawa Laundry</Link><span>Pengaturan</span></header>
    <div className="admin-content admin-settings">
      <p className="admin-kicker">KEAMANAN AKUN</p>
      <h1>Ubah Password</h1>
      <p className="admin-hint">Untuk keamanan, masukkan password saat ini sebelum menggantinya. Setelah berhasil, Anda diminta login kembali.</p>
      {error && <p className="admin-error" role="alert">{error === "failed" ? "Password belum berhasil diganti. Silakan coba lagi." : "Periksa password lama dan pastikan password baru memenuhi syarat."}</p>}
      <form className="admin-form" action={changeOwnerPassword}>
        <label htmlFor="current">Password saat ini</label><input id="current" type="password" name="currentPassword" autoComplete="current-password" required />
        <label htmlFor="new">Password baru</label><input id="new" type="password" name="newPassword" autoComplete="new-password" required minLength={12} maxLength={128} />
        <p className="admin-helper">Minimal 12 karakter, gunakan huruf besar, huruf kecil, angka, dan simbol.</p>
        <label htmlFor="confirm">Ulangi password baru</label><input id="confirm" type="password" name="confirmPassword" autoComplete="new-password" required minLength={12} maxLength={128} />
        <button type="submit" className="admin-primary">Simpan Password Baru</button>
      </form>
      <div className="admin-shortcuts"><Link href="/admin/scan">← Kembali ke Scan</Link></div>
    </div>
  </main>;
}
