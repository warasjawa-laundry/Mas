import Link from "next/link";
export type MemberTask="transaction"|"history"|"promo";
export default function MemberTaskNav({memberId,view}:{memberId:string;view:MemberTask}){
 return <nav className="member-task-nav" aria-label="Pekerjaan member">
  {([['transaction','Catat transaksi'],['history','Riwayat'],['promo','Promo']] as const).map(([key,label])=>
   <Link key={key} prefetch={false} href={`/admin/members/${memberId}?view=${key}`} aria-current={view===key?"page":undefined}>{label}</Link>)}
 </nav>;
}
