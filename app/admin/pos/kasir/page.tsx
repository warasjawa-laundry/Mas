import Link from "next/link";
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
    <legend>Hak akses yang diberikan owner</legend>
    {CASHIER_PERMISSIONS.map(([key,label]) => <label key={key} htmlFor={`${prefix}-${key}`}>
      <input id={`${prefix}-${key}`} type="checkbox" name={`permit_${key}`}
        defaultChecked={hasCashierGrant(grants, key)} />
      {label}
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
  const message = params.saved ? "Kasir berhasil disimpan. Username kasir baru ditampilkan pada daftar." : params.removed ?
    "Kasir telah dihapus dari daftar aktif dan semua perangkatnya dicabut." :
    params.revoked ? "Seluruh akses perangkat kasir sudah dicabut." : null;

  return <main className="admin-workspace"><div className={`admin-content ${styles.wrap}`}>
    <p className="admin-kicker">PENGATURAN OWNER</p>
    <h1>Kelola Kasir</h1>
    <p className="admin-hint">Owner saja yang login. Tambahkan nama kasir dan pilih hak aksesnya. Sistem membuat ID unik empat angka seperti MAS-0001, MAS-0002, dan seterusnya. Kasir cukup memasukkan ID kasir tanpa password dan tanpa aktivasi perangkat. Menu kasir mengikuti hak akses yang kamu pilih. Tidak ada pengelolaan cabang.</p>
    <section className={styles.location}>
      <h2>Outlet tetap</h2>
      <strong>Mas Jawa Laundry</strong>
      <p>{site.address}, {site.shortAddress}</p>
      <small>Satu outlet saja. Tidak ada tombol tambah atau hapus outlet.</small>
    </section>
    {unavailable ? <p className="admin-error" role="alert">Modul kasir belum tersedia pada database yang aktif. Tidak ada data kasir yang diubah. Pengaturan ini dapat dipakai setelah migrasi POS disetujui dan diterapkan.</p> : <>
      {message && <p className="admin-success" role="status">{message}</p>}
      {params.error && <p className="admin-error" role="alert">{params.error === "invalid" ? "Nama/ID kasir tidak valid." : "Penyimpanan belum berhasil. Coba lagi setelah memeriksa akses database."}</p>}
      <section className={styles.panel} aria-labelledby="new-cashier">
        <h2 id="new-cashier">Tambah kasir</h2>
        <form action={saveCashier} className={styles.form}>
          <label htmlFor="new-cashier-name">Nama kasir</label>
          <input id="new-cashier-name" type="text" name="name" required maxLength={100} minLength={2} autoComplete="off" />
          <PermissionFields prefix="new" grants={{order_view:true,order_create:true,member_lookup:true,receipt_print:true}} />
          <button type="submit" className="admin-primary">Simpan Kasir</button>
        </form>
      </section>
      <section aria-labelledby="cashier-list" className={styles.list}>
        <h2 id="cashier-list">Daftar kasir ({cashiers.filter(c => c.active).length} aktif)</h2>
        {cashiers.length === 0 && <p className={styles.empty}>Belum ada kasir. Tambahkan dari formulir di atas.</p>}
        {cashiers.map(c => <article key={c.staff_id} className={styles.panel}>
          <h3>{c.display_name} <small>{c.active ? "Aktif" : "Dihapus / nonaktif"}</small></h3>
          <p className={styles.help}>Username: <strong style={{fontSize:16,color:"#4c1d95"}}>{c.username}</strong> · Nomor tidak berubah ketika nama diubah atau kasir dihapus.</p>
          <p className={styles.help}>Sesi aktif: {c.active_devices}. Menonaktifkan kasir akan memutus semua sesi, tetapi riwayat tetap tersimpan.</p>
          {c.active ? <>
            <form action={saveCashier} className={styles.form}>
              <input type="hidden" name="staffId" value={c.staff_id} />
              <label htmlFor={`cashier-name-${c.staff_id}`}>Nama</label>
              <input id={`cashier-name-${c.staff_id}`} type="text" name="name" required minLength={2} maxLength={100} defaultValue={c.display_name} />
              <PermissionFields grants={c.permissions} prefix={c.staff_id} />
              <button type="submit" className="admin-primary">Simpan hak akses</button>
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
          </> : <p className={styles.help}>Kasir nonaktif tidak dapat masuk. Riwayat dan audit tetap disimpan.</p>}
        </article>)}
      </section>
      <p className={styles.help}><strong>Login kasir:</strong> owner membuat ID empat angka. Karyawan langsung membuka <a href="/kasir">/kasir</a> dan memasukkan ID tersebut—tanpa password atau aktivasi perangkat. Owner dapat mengubah izin atau mencabut semua sesi kapan saja. Sesi maksimal 12 jam.</p>
      <p className={styles.help}><strong>Keamanan:</strong> ID empat angka mudah ditebak; sistem membatasi percobaan login dan mencatat sesi. Jangan membagikan ID kepada orang luar. Kasir tidak dapat mengelola owner/member/poin melalui hak admin. Pembayaran produksi tetap belum aktif sampai review keamanan dan G8 disetujui.</p>
    </>}
    <div className="admin-shortcuts"><Link href="/admin/settings">← Kembali ke Pengaturan</Link></div>
  </div></main>;
}