import { redirect } from "next/navigation";
import { getVerifiedOwner } from "@/lib/supabase/owner";
import { loginOwner } from "@/app/admin/actions";
import { OwnerPassword } from "@/components/admin/owner-password";
import OwnerLoginSubmit from "@/components/admin/owner-login-submit";

type Props = { searchParams: Promise<{ error?: string; notice?: string }> };
export default async function OwnerLogin({ searchParams }: Props) {
  if (await getVerifiedOwner()) redirect("/admin/scan");
  const { error, notice } = await searchParams;
  const message = error === "invalid" ? "ID atau password tidak cocok." :
    error === "unavailable" ? "Akses pemilik belum diaktifkan. Silakan hubungi pengelola." : null;
  const success = notice === "password-changed" ? "Password berhasil diubah. Silakan masuk kembali." :
    notice === "logout" ? "Anda telah keluar dari akun pemilik." : null;

  return <main className="admin-auth">
    <section className="admin-login-card" aria-labelledby="admin-title">
      <div className="admin-icon" aria-hidden="true">MJ</div>
      <p className="admin-kicker">MAS JAWA LAUNDRY</p>
      <h1 id="admin-title">Masuk Pemilik</h1>
      <p className="admin-hint">Gunakan ID dan password untuk mengelola kartu member dan transaksi.</p>
      {message && <p className="admin-error" role="alert">{message}</p>}
      {success && <p className="admin-success" role="status">{success}</p>}
      <form action={loginOwner} className="admin-form">
        <label htmlFor="owner-id">ID Pengguna</label>
        <input id="owner-id" name="loginId" type="text" autoComplete="username" defaultValue="masjawalaundry" required spellCheck={false} maxLength={64} />
        <label htmlFor="owner-password">Password</label>
        <OwnerPassword />
        <OwnerLoginSubmit />
      </form>
      <p className="admin-footnote">Khusus pemilik laundry. Pelanggan tidak perlu login.</p>
    </section>
  </main>;
}
