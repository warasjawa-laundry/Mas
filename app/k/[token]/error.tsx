"use client";
import Link from "next/link";
import "./progress.css";

export default function CardError({retry}:{retry:()=>void}){
 return <main className="member-public"><section className="member-public-shell">
  <p className="admin-kicker">MAS JAWA LAUNDRY</p>
  <h1>Catatan belum dapat dimuat</h1>
  <p role="alert">Periksa koneksi lalu coba lagi. Jika masih gagal, hubungi petugas laundry.</p>
  <div className="member-recovery-actions"><button className="member-refresh" type="button" onClick={retry}>Coba lagi</button><Link href="/membership#scan-kartu">Pindai kartu lain</Link></div>
 </section></main>;
}
