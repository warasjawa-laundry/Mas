import Link from "next/link";
import { requireOwner } from "@/lib/supabase/owner";
import { changeOwnerPassword } from "@/app/admin/actions";

type Props = { searchParams: Promise<{ error?: string }> };
export default async function OwnerSettings({ searchParams }: Props) {
  await requireOwner();
  const { error } = await searchParams;
  return <main className="admin-workspace">
    <div className="admin-content account-settings">
      <h1>Pengaturan Akun</h1>
      <p className="admin-hint">Kelola akses kasir dan password manajer.</p>
      <div className="account-settings-grid">
      <section className="settings-staff-entry"><h2>Layanan & Harga</h2><p>Kelola daftar layanan, tarif, dan durasi yang tersedia untuk kasir.</p><Link href="/admin/settings/services" className="admin-logout">Atur Layanan & Harga</Link></section>
      <section className="settings-staff-entry"><h2>Kasir Mas Jawa Laundry</h2><p>Tambahkan kasir, atur hak akses, dan kelola perangkat pegawai outlet.</p><Link href="/admin/pos/kasir" prefetch={false} className="admin-logout">Kelola Kasir</Link></section>
      <section className="settings-password-entry" aria-labelledby="password-heading"><h2 id="password-heading">Ubah Password</h2>
      <p className="admin-hint">Untuk keamanan, masukkan password saat ini sebelum menggantinya. Setelah berhasil, Anda diminta login kembali.</p>
      {error && <p className="admin-error" role="alert">{error === "failed" ? "Password belum berhasil diganti. Silakan coba lagi." : "Periksa password lama dan pastikan password baru memenuhi syarat."}</p>}
      <form className="admin-form" action={changeOwnerPassword}>
        <label htmlFor="current">Password saat ini</label><input id="current" type="password" name="currentPassword" autoComplete="current-password" required />
        <label htmlFor="new">Password baru</label><input id="new" type="password" name="newPassword" autoComplete="new-password" required minLength={12} maxLength={128} />
        <p className="admin-helper">Minimal 12 karakter, gunakan huruf besar, huruf kecil, angka, dan simbol.</p>
        <label htmlFor="confirm">Ulangi password baru</label><input id="confirm" type="password" name="confirmPassword" autoComplete="new-password" required minLength={12} maxLength={128} />
        <button type="submit" className="admin-primary">Simpan Password Baru</button>
      </form></section>
      </div>
    </div>
  </main>;
}
