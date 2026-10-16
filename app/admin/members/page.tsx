import Link from "next/link";
import { requireOwner } from "@/lib/supabase/owner";
import { memberNumber } from "@/lib/laundry/card";
import { timeAdmin } from "@/lib/admin/timing";
type Params = { searchParams: Promise<{ q?: string; page?: string }> };
export default async function MemberList({searchParams}: Params) {
  const { supabase } = await requireOwner();
  const input = await searchParams;
  const query = input.q?.trim().replace(/[%_,]/g, "").slice(0,80) || "";
  const rawPage = Number(input.page ?? "1");
  const page = Number.isSafeInteger(rawPage) && rawPage >= 1 && rawPage <= 10000 ? rawPage : 1;
  const perPage = 25;
  const offset = (page - 1) * perPage;
  const pageLink = (number: number) => "/admin/members?" + new URLSearchParams({...(query ? {q:query} : {}),page:String(number)}).toString();
  let request = supabase.from("laundry_members")
    .select("id,member_number,display_name,is_active,created_at",{count:"exact"})
    .order("created_at",{ascending:false}).order("id",{ascending:false})
    .range(offset,offset+perPage-1);
  if (query) request=request.ilike("display_name","%"+query+"%");
  const { data, error, count } = await timeAdmin("members.list.query", () => request);
  return <main className="admin-workspace">
    <div className="admin-topbar"><Link href="/admin/scan" className="admin-brand">← Mas Jawa Laundry</Link><Link href="/admin/settings">Pengaturan</Link></div>
    <section className="admin-content">
      <p className="admin-kicker">KELOLA MEMBER</p>
      <h1>Daftar Member</h1>
      <p className="admin-hint">Simpan pelanggan satu kali. Kartu QR dapat dicetak ulang kapan saja oleh pemilik.</p>
      <div className="member-toolbar"><form method="get" className="member-search" role="search">
        <label htmlFor="member-search" className="sr-only">Cari nama member</label>
        <input id="member-search" name="q" placeholder="Cari nama member" defaultValue={query} maxLength={80} />
        <button type="submit">Cari</button>
      </form><Link className="member-add" href="/admin/members/new">+ Tambah Member</Link></div>
      {error ? <p className="admin-error">Data member belum dapat dimuat. Coba lagi.</p> : !data?.length ?
        <div className="member-empty"><strong>{query ? "Nama tidak ditemukan" : "Belum ada member"}</strong>
          <span>{query ? "Coba nama lain." : "Daftarkan pelanggan pertama lewat tombol Tambah Member."}</span></div> :
        <ul className="member-list">{data.map(m=><li key={m.id}>
          <div><strong>{m.display_name}</strong><span>{memberNumber(m.member_number)} · {m.is_active ? "Aktif" : "Nonaktif"}</span></div>
          <nav className="owner-member-links" aria-label={`Aksi untuk ${m.display_name}`}><Link prefetch={false} href={`/admin/members/${m.id}`}>Catat Transaksi</Link><Link prefetch={false} href={`/admin/members/${m.id}#promo-member`}>Promo</Link><Link prefetch={false} href={`/admin/members/${m.id}/card`}>Kartu QR</Link><Link prefetch={false} href={`/admin/members/${m.id}/edit`}>Ubah Data</Link></nav>
        </li>)}</ul>}
      {!error && count !== null && count > perPage && <nav aria-label="Halaman daftar member" className="admin-member-pagination">
        {page > 1 && <Link prefetch={false} href={pageLink(page - 1)}>← Sebelumnya</Link>}
        <span>Halaman {page} · {count} member</span>
        {offset + (data?.length ?? 0) < count && <Link prefetch={false} href={pageLink(page + 1)}>Berikutnya →</Link>}
      </nav>}
      <p className="member-note">Data nomor WhatsApp tidak ditampilkan dalam daftar publik. Daftar ditampilkan 25 member per halaman. Cari nama untuk menemukan member lain.</p>
    </section>
  </main>;
}
