"use client";
import {useRef,type ReactNode} from "react";

export default function MobileNavigation({children}:{children:ReactNode}){
 const menu=useRef<HTMLDetailsElement>(null);
 return <details className="mobile-nav" ref={menu}
  onClick={event=>{if((event.target as Element).closest("a"))menu.current?.removeAttribute("open")}}
  onKeyDown={event=>{
   if(event.key!=="Escape"||!menu.current?.open)return;
   event.preventDefault();menu.current.open=false;menu.current.querySelector("summary")?.focus();
  }}>
  <summary aria-label="Buka menu navigasi">Menu <span aria-hidden="true">☰</span></summary>
  {children}
 </details>;
}
