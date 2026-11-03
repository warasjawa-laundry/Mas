import Link from "next/link";
import PendingSubmit from "@/components/admin/pending-submit";
import { site } from "@/lib/site";
import { requireOwner } from "@/lib/supabase/owner";
import { CASHIER_PERMISSIONS, hasCashierGrant, type CashierGrants } from "@/lib/pos/cashier-permissions";
import { saveCashier, removeCashier, revokeCashierDevices } from "./actions";
import styles from "./cashiers.module.css";

type CashierRow = {
  staff_id: string;
  username: string;
  display_name: string;
  active: boolean;
  permissions: CashierGrants;
  active_devices: number;
};
type Props = { searchParams: Promise<{ error?: string; saved?: string; removed?: string; revoked?: string }> };

function PermissionFields({ grants = {}, prefix }: { grants?: CashierGrants; prefix: string }) {
  return <fieldset className={styles.permissions}>
    <legend>Hak akses kasir</legend>
    {CASHIER_PERMISSIONS.map(([key,label]) => <label key={key} htmlFor={`${prefix}-${key}`}>
      <input id={`${prefix}-${key}`} type="checkbox" name={`permit_${key}`}
        defaultChecked={hasCashierGrant(grants, key)} />
      <span>{key === "member_lookup" ? "Cari pelanggan" : label}</span>
    </label>)}
  </fieldset>;
}

export const dynamic = "force-dynamic";
export default async function CashierOwnerPage({ searchParams }: Props) {
  const { supabase } = await requireOwner();
  const [result, params] = await Promise.all([
    supabase.rpc("laundry_pos_owner_list_cashiers"), searchParams,
  ]);
  const unavailable = Boolean(result.error);
  const cashiers = (Array.isArray(result.data) ? result.data : []) as CashierRow[];
  const savedCashier = cashiers.find(c => c.staff_id === params.saved);
  const message = savedCashier ? `Kasir ${savedCashier.display_name} berhasil disimpan. ID kasir: ${savedCashier.username}.` : params.removed ?
    "Kasir telah dihapus dari daftar aktif dan semua perangkatnya dicabut." :
    params.revoked ? "Seluruh akses perangkat kasir sudah dicabut." : null;

  return <main className="admin-workspace">
    <div className="binatu-page-cap binatu-pattern" aria-hidden="true"/>
    <header className={styles.heading}><div className={styles.headingInner}>
      <Link href="/admin/settings" className={styles.back}>← Pengaturan Akun</Link>
      <h1>Kelola Kasir</h1>
      <p>Tambahkan kasir dan pilih pekerjaan yang boleh diakses.</p>
    </div></header>
    <div className={`admin-content ${styles.wrap}`}>
    <section className={styles.location}>
      <div><span>Outlet</span><strong>Mas Jawa Laundry</strong><p>{site.address}, {site.shortAddress}</p></div>
      <p className={styles.loginHint}>Kasir masuk menggunakan ID MAS-2XXX tanpa password atau aktivasi perangkat. ID dibuat saat Anda menyimpan kasir baru.</p>
    </section>
    {unavailable ? <p className="admin-error" role="alert">Data kasir belum dapat dimuat. Muat ulang halaman atau hubungi pengelola.</p> : <>
      {message && <p className="admin-success" role="status">{message}</p>}
      {params.error && <p className="admin-error" role="alert">{params.error === "invalid" ? "Nama atau ID kasir tidak valid." : "Perubahan belum berhasil disimpan. Periksa koneksi lalu coba lagi."}</p>}
      <div className={styles.workspace}>
      <section className={styles.panel} aria-labelledby="new-cashier">
        <h2 id="new-cashier">Tambah kasir</h2>
        <form action={saveCashier} className={styles.form}>
          <label htmlFor="new-cashier-name">Nama kasir</label>
          <input id="new-cashier-name" type="text" name="name" required maxLength={100} minLength={2} autoComplete="off" />
          <PermissionFields prefix="new" grants={{order_view:true,order_create:true,member_lookup:true,receipt_print:true}} />
          <PendingSubmit label="Simpan Kasir" className="admin-primary"/>
        </form>
      </section>
      <section aria-labelledby="cashier-list" className={styles.list}>
        <h2 id="cashier-list">Daftar kasir ({cashiers.filter(c => c.active).length} aktif)</h2>
        {cashiers.length === 0 && <p className={styles.empty}>Belum ada kasir. Isi nama dan hak akses pada formulir Tambah kasir.</p>}
        {cashiers.map(c => <article key={c.staff_id} className={styles.panel}>
          <div className={styles.cashierHeading}><h3>{c.display_name}</h3><span className={styles.status}>{c.active ? "Aktif" : "Dihapus / nonaktif"}</span></div>
          <div className={styles.identity}><div><span>ID kasir</span><strong>{c.username}</strong></div><p>Sesi aktif: <strong>{c.active_devices}</strong></p></div>
          <p className={styles.help}>ID tetap sama saat nama diubah atau kasir dihapus. Menghapus kasir akan memutus semua sesi dan menyimpan riwayatnya.</p>
          {c.active ? <>
            <form action={saveCashier} className={styles.form}>
              <input type="hidden" name="staffId" value={c.staff_id} />
              <label htmlFor={`cashier-name-${c.staff_id}`}>Nama</label>
              <input id={`cashier-name-${c.staff_id}`} type="text" name="name" required minLength={2} maxLength={100} defaultValue={c.display_name} />
              <PermissionFields grants={c.permissions} prefix={c.staff_id} />
              <PendingSubmit label="Simpan hak akses" className="admin-primary"/>
            </form>
            <div className={styles.actions}>
              <form action={revokeCashierDevices}>
                <input type="hidden" name="staffId" value={c.staff_id} />
                <button type="submit" className={styles.plainButton}>Cabut semua sesi</button>
              </form>
              <form action={removeCashier}>
                <input type="hidden" name="staffId" value={c.staff_id} />
                <input type="hidden" name="name" value={c.display_name} />
                <button type="submit" className={styles.dangerButton}>Hapus kasir</button>
              </form>
            </div>
          </> : <p className={styles.help}>Kasir nonaktif tidak dapat masuk. Riwayat aktivitas tetap tersimpan.</p>}
        </article>)}
      </section>
      </div>
      <aside className={styles.accessNote} aria-labelledby="cashier-access-note"><h2 id="cashier-access-note">Akses dan sesi kasir</h2>
        <p>Kasir membuka <Link href="/admin/login?role=kasir">halaman masuk kasir</Link> dengan ID miliknya. Anda dapat mengubah izin atau mencabut seluruh sesi kapan saja. Sesi berlaku maksimal 12 jam.</p>
        <p>ID empat angka mudah ditebak. Bagikan hanya kepada pegawai. Sistem membatasi percobaan masuk dan mencatat sesi. Kasir tidak dapat mengelola akun manajer, data pelanggan, atau poin melalui hak admin.</p>
        <p>Status pembayaran mengikuti pengaturan outlet. Nota uji selalu berlabel simulasi.</p>
      </aside>
    </>}
    <div className="admin-shortcuts"><Link href="/admin/settings">← Kembali ke Pengaturan</Link></div>
  </div></main>;
}
