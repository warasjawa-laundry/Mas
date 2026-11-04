import Link from "next/link";
import {assets,site} from "@/lib/site";
type Props={title:string;category:string;description?:string;backHref?:string;children:React.ReactNode};
export default function PosWorkspace({title,category,description,backHref="/admin/menu",children}:Props){
 return <main className="binatu-board binatu-workspace">
  <div className="binatu-pattern binatu-page-cap" aria-hidden="true"/>
  <header className="binatu-outlet-head">
   <img src={assets.logo} width="50" height="50" alt=""/>
   <div><strong>MAS JAWA LAUNDRY</strong><p>{site.shortAddress}</p></div>
   <span className="binatu-role-chip">Manajer<span aria-hidden="true"/></span>
  </header>
  <div className="binatu-menu-page binatu-workspace-content">
    <Link className="binatu-workspace-back" href={backHref} prefetch={false}>← Kembali ke Menu</Link>
    <header className="binatu-page-heading"><p>{category}</p><h1>{title}</h1>
      {description&&<p className="binatu-workspace-intro">{description}</p>}</header>
    {children}
  </div>
 </main>;
}
