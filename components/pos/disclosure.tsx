import type {ReactNode} from 'react';
export default function Disclosure({title,children,className=''}:{title:string;children:ReactNode;className?:string}){
 return <details className={`pos-disclosure ${className}`}>
  <summary><span>{title}</span><span className="pos-disclosure-state" aria-hidden="true"><span className="pos-disclosure-closed">Buka</span><span className="pos-disclosure-open">Tutup</span></span></summary>
  <div className="pos-disclosure-content">{children}</div>
 </details>;
}
