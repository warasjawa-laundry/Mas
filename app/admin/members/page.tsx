import Link from "next/link";
import MemberSearch from "@/components/admin/member-search";
import { requireOwner } from "@/lib/supabase/owner";
import MemberDirectoryList from "@/components/admin/member-directory-list";
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
  const numberMatch=query.match(/^(?:MJL-?)?(\d{1,12})$/i);
  if (numberMatch) request=request.eq("member_number",String(BigInt(numberMatch[1])));
  else if (query) request=request.ilike("display_name","%"+query+"%");
  const { data, error, count } = await timeAdmin("members.list.query", () => request);
  return <main className="admin-workspace">
    <section className="admin-content member-directory">
      <p className="admin-kicker">KELOLA MEMBER</p>
      <div className="member-directory-heading"><h1>Daftar Member</h1><Link className="member-directory-add" href="/admin/members/new" prefetch={false}>+ Tambah</Link></div>
      <p className="admin-hint">Cari pelanggan untuk mencatat transaksi atau mengelola kartu member.</p>
      <div className="member-toolbar"><MemberSearch query={query} /></div>
      {!error&&<p className="member-directory-count">{count??0} member{query?" ditemukan":" terdaftar"}</p>}
      {error ? <p className="admin-error">Data member belum dapat dimuat. Coba lagi.</p> : !data?.length ?
        <div className="member-empty"><strong>{query ? "Member tidak ditemukan" : "Belum ada member"}</strong>
          <span>{query ? "Coba nama atau nomor member lain." : "Daftarkan pelanggan pertama lewat tombol + Tambah."}</span></div> :
        <MemberDirectoryList members={data}/>}
      {!error && count !== null && count > perPage && <nav aria-label="Halaman daftar member" className="admin-member-pagination">
        {page > 1 && <Link prefetch={false} href={pageLink(page - 1)}>← Sebelumnya</Link>}
        <span>Halaman {page} · {count} member</span>
        {offset + (data?.length ?? 0) < count && <Link prefetch={false} href={pageLink(page + 1)}>Berikutnya →</Link>}
      </nav>}
      <p className="member-note">Menampilkan hingga 25 member per halaman. Cari menggunakan nama atau nomor member.</p>
    </section>
  </main>;
}
