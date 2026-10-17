import Form from "next/form";

export default function MemberSearch({query = "", id = "member-search"}: {query?: string; id?: string}) {
  return <Form action="/admin/members" prefetch={false} className="member-search" role="search">
    <label htmlFor={id} className="sr-only">Cari nama member</label>
    <input id={id} name="q" type="search" placeholder="Cari nama member" defaultValue={query} maxLength={80} autoComplete="off" />
    <button type="submit">Cari</button>
  </Form>;
}
