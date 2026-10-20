"use client";
import {useTransition} from "react";
import {useRouter} from "next/navigation";
export default function MemberProgressRefresh(){
 const router=useRouter();const [pending,startTransition]=useTransition();
 return <button className="member-refresh" type="button" disabled={pending} aria-busy={pending}
  onClick={()=>startTransition(()=>router.refresh())}>{pending?"Memperbarui…":"Perbarui catatan"}</button>;
}
