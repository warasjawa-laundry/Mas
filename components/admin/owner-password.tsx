"use client";
import { useState } from "react";

export function OwnerPassword() {
  const [visible, setVisible] = useState(false);
  return <div className="admin-password-field">
    <input id="owner-password" name="password" type={visible ? "text" : "password"}
      autoComplete="current-password" required maxLength={1024} placeholder="Masukkan password" />
    <button className="admin-show-password" type="button" onClick={() => setVisible(v => !v)}
      aria-label={visible ? "Sembunyikan password" : "Lihat password"} aria-pressed={visible}>
      {visible ? "Sembunyikan" : "Lihat"}
    </button>
  </div>;
}
