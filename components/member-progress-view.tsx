import Link from "next/link";
import MemberProgressRefresh from "@/components/member-progress-refresh";
import type {PublicTransaction} from "@/lib/laundry/public-history";
type Props={name?:string|null;number:string;total:number;year:number;points:number|null;balancesFailed:boolean;
 years:{year:number;href:string}[];transactions:PublicTransaction[];historyFailed:boolean;
 page:number;previousHref?:string;nextHref?:string;promos:{title:string;terms?:string|null;expires_at?:string|null}[]};
const money=(n:number)=>"Rp"+new Intl.NumberFormat("id-ID").format(n);
const date=(s:string)=>new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Jakarta"}).format(new Date(s));
export default function MemberProgressView(p:Props){
 return <main className="member-public"><div className="member-public-shell">
  <header className="member-progress-header"><p className="admin-kicker">MAS JAWA LAUNDRY</p>
   <h1>Poin dan transaksi</h1>{p.name&&<p className="member-public-name">{p.name}</p>}<p className="member-public-id">{p.number}</p>
  </header>
  <nav className="member-year-nav" aria-label="Tahun catatan">
   {p.years.map(y=><Link key={y.year} href={y.href} prefetch={false} aria-current={y.year===p.year?"page":undefined}>{y.year}</Link>)}
  </nav>
  <section className="member-summary" aria-label="Ringkasan kartu">
   <div className="member-point-primary"><span>Saldo poin {p.year}</span>
    {p.balancesFailed?<p role="status">Poin belum dapat dimuat.</p>:p.points===null?<p>Saldo tahun ini belum tersedia.</p>:<strong>{p.points}<small> poin</small></strong>}
    <small>Transaksi aktif pada tahun {p.year}.</small>
   </div>
   <div className="member-count"><span>Total transaksi</span><strong>{p.total}</strong><small>Semua tahun, setelah pembatalan.</small></div>
  </section>
  <div className="member-refresh-row"><p className="member-note">Catatan diperbarui setelah transaksi disimpan petugas.</p><MemberProgressRefresh /></div>
  <section className="member-history" aria-labelledby="transaction-history">
   <div className="member-section-heading"><h2 id="transaction-history">Riwayat transaksi</h2><span>{p.year}</span></div>
   {p.historyFailed?<p className="member-feedback" role="alert">Riwayat belum dapat dimuat. Tekan Perbarui catatan untuk mencoba lagi.</p>:
    p.transactions.length===0?<p className="member-feedback">{p.page===1?"Belum ada transaksi pada tahun ini.":"Tidak ada transaksi di halaman ini."}</p>:
    <ol className="member-history-list">{p.transactions.map(t=><li key={t.event_id} className={t.cancelled?"member-transaction-cancelled":""}>
     <div className="member-transaction-top"><time dateTime={t.occurred_at}>{date(t.occurred_at)} WIB</time><span className="member-transaction-status">{t.cancelled?"Dibatalkan":"Tercatat"}</span></div>
     <div className="member-transaction-values"><strong>{t.amount_idr===null?"Tanpa nominal":money(Number(t.amount_idr))}</strong>
      <span className="member-transaction-points">{t.cancelled?t.awarded_points+" poin dibatalkan":"+"+t.awarded_points+" poin"}</span></div>
     <p>{t.cancelled?"Tidak dihitung dalam saldo poin dan total transaksi.":t.amount_idr===null?"Catatan lama tanpa nominal. Tidak mendapat poin.":"Masuk ke saldo poin "+t.program_year+"."}</p>
    </li>)}</ol>}
   {!p.historyFailed&&(p.previousHref||p.nextHref)&&<nav className="member-history-pagination" aria-label="Halaman riwayat transaksi">
    {p.previousHref&&<Link prefetch={false} href={p.previousHref}>← Lebih baru</Link>}<span>Halaman {p.page}</span>
    {p.nextHref&&<Link prefetch={false} href={p.nextHref}>Lebih lama →</Link>}
   </nav>}
   <p className="member-note member-history-note">Poin dihitung dari nominal saat transaksi dicatat dan disesuaikan jika transaksi dibatalkan. Saldo setiap tahun ditampilkan terpisah.</p>
  </section>
  <section className="member-promos" aria-labelledby="member-promos-title"><h2 id="member-promos-title">Promo member</h2>
   {p.promos.length?<ul className="member-public-promos">{p.promos.slice(0,20).map((v,i)=><li key={i}>
    <strong>{v.title}</strong>
    {v.terms&&<p className="member-promo-terms">{v.terms}</p>}
    <small>{v.expires_at?"Berlaku sampai "+date(v.expires_at)+" WIB":"Tanpa tanggal berakhir"}</small>
   </li>)}</ul>:<p className="member-note">Belum ada promo pada kartu ini.</p>}
  </section>
  <footer className="member-public-foot">Simpan QR untuk penggunaan pribadi. Jika ada transaksi yang tidak sesuai, hubungi petugas laundry.</footer>
 </div></main>;
}
