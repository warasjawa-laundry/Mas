import Link from "next/link";
import {memberNumber} from "@/lib/laundry/card";
type Member={id:string;member_number:number|string;display_name:string;is_active:boolean};
export default function MemberDirectoryList({members}:{members:Member[]}){
 return <ul className="member-directory-list">{members.map(m=><li key={m.id}>
  <div className="member-directory-identity"><Link prefetch={false} href={`/admin/members/${m.id}`} className="member-directory-name">{m.display_name}</Link>
   <p>{memberNumber(m.member_number)} <span>· {m.is_active?"Aktif":"Nonaktif"}</span></p></div>
  <div className="member-directory-actions"><Link className="member-directory-record" prefetch={false} href={`/admin/members/${m.id}`}>Catat</Link>
   <details className="member-directory-more" name="member-row-actions"><summary>Lainnya</summary>
    <nav aria-label={`Aksi untuk ${m.display_name}`}>
     <Link prefetch={false} href={`/admin/members/${m.id}/card`}>Kartu QR</Link>
     <Link prefetch={false} href={`/admin/members/${m.id}?view=promo`}>Promo</Link>
     <Link prefetch={false} href={`/admin/members/${m.id}/edit`}>Ubah Data</Link>
    </nav>
   </details>
  </div>
 </li>)}</ul>;
}
