import Link from "next/link";
import "./progress.css";

export default function CardNotFound(){
 return <main className="member-public"><section className="member-public-shell">
  <p className="admin-kicker">MAS JAWA LAUNDRY</p>
  <h1>Kartu belum dapat dibuka</h1>
  <p>QR mungkin tidak lengkap atau kartu sudah tidak aktif. Pindai ulang kartu Anda. Jika masih gagal, minta bantuan petugas laundry.</p>
  <div className="member-recovery-actions"><Link href="/membership#scan-kartu">Pindai kartu lagi</Link><Link href="/">Kembali ke beranda</Link></div>
 </section></main>;
}
