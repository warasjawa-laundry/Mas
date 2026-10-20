import Link from "next/link";
import { requireOwner } from "@/lib/supabase/owner";
import { changeOwnerPassword } from "@/app/admin/actions";

type Props = { searchParams: Promise<{ error?: string }> };
export default async function OwnerSettings({ searchParams }: Props) {
  await requireOwner();
  const { error } = await searchParams;
  return <main className="admin-workspace">
    <div className="admin-content admin-settings">
      <p className="admin-kicker">ADMIN</p>
      <h1>Pengaturan</h1>
      <section className="settings-service-entry"><h2>Layanan dan harga</h2><p>Tambah layanan, ubah tarif dan satuan, atau sembunyikan layanan dari homepage.</p><Link href="/admin/settings/services" prefetch={false} className="admin-primary">Kelola layanan dan harga →</Link></section>
      <h2>Ubah Password</h2>
      <p className="admin-hint">Untuk keamanan, masukkan password saat ini sebelum menggantinya. Setelah berhasil, Anda diminta login kembali.</p>
      {error && <p className="admin-error" role="alert">{error === "failed" ? "Password belum berhasil diganti. Silakan coba lagi." : "Periksa password lama dan pastikan password baru memenuhi syarat."}</p>}
      <form className="admin-form" action={changeOwnerPassword}>
        <label htmlFor="current">Password saat ini</label><input id="current" type="password" name="currentPassword" autoComplete="current-password" required />
        <label htmlFor="new">Password baru</label><input id="new" type="password" name="newPassword" autoComplete="new-password" required minLength={12} maxLength={128} />
        <p className="admin-helper">Minimal 12 karakter, gunakan huruf besar, huruf kecil, angka, dan simbol.</p>
        <label htmlFor="confirm">Ulangi password baru</label><input id="confirm" type="password" name="confirmPassword" autoComplete="new-password" required minLength={12} maxLength={128} />
        <button type="submit" className="admin-primary">Simpan Password Baru</button>
      </form>
      <div className="admin-shortcuts"><Link href="/admin">← Kembali ke Ringkasan</Link></div>
    </div>
  </main>;
}
