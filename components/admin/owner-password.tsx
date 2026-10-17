"use client";
import { useEffect, useRef, useState } from "react";

export function OwnerPassword() {
  const [visible, setVisible] = useState(false);
  const input=useRef<HTMLInputElement>(null);
  // Browsers may restore a password field when revisiting a cached form.
  useEffect(()=>{
    const clear=()=>{
      if(input.current)input.current.value="";
      setVisible(false);
    };
    clear();
    // BFCache restores the previous DOM without remounting this component.
    window.addEventListener("pageshow",clear);
    return ()=>window.removeEventListener("pageshow",clear);
  },[]);
  return <div className="admin-password-field">
    <input ref={input} id="owner-password" name="password" type={visible ? "text" : "password"}
      autoComplete="off" required maxLength={1024} placeholder="Masukkan password" />
    <button className="admin-show-password" type="button" onClick={() => setVisible(v => !v)}
      aria-label={visible ? "Sembunyikan password" : "Lihat password"} aria-pressed={visible}>
      {visible ? "Sembunyikan" : "Lihat"}
    </button>
  </div>;
}
