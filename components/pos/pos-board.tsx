
import Link from "next/link";
export type PosRow={id:string;invoice_no:string;customer_name:string;total_idr:string|number;work_status:string;payment_status:string;created_at:string};
type Props={role:"owner"|"cashier";tab?:string;orders?:PosRow[];memberCount?:string|null;transactionCount?:string|null;dbReady?:boolean;writeEnabled?:boolean};
const money=(v:string|number)=>"Rp "+(Number(v)||0).toLocaleString("id-ID");
export default function PosBoard({role,tab="queue",orders=[],memberCount,transactionCount,dbReady=false,writeEnabled=false}:Props){
 const owner=role==="owner";
 const base=owner?"/admin":"/kasir";
 const active=["queue","ready","unpaid"].includes(tab)?tab:"queue";
 const visible=orders.filter(o=>active==="ready"?o.work_status==="READY":active==="unpaid"?["UNPAID","PARTIAL"].includes(o.payment_status):o.work_status==="QUEUED");
 const tabs=[{key:"queue",label:"Antrian"},{key:"ready",label:"Siap Ambil"},{key:"unpaid",label:"Belum Bayar"}];
 return <main className="mj-pos-board">
  <div className="mj-pos-hero" aria-hidden="true"><span className="mj-pos-hero-deco">✦　○　✧　◌　✦</span></div>
  <header className="mj-pos-head"><span className="mj-pos-logo" aria-hidden="true">MJ</span>
   <div className="mj-pos-head-copy"><strong>Mas Jawa Laundry</strong><small>{owner?"Owner · POS":"Kasir · POS"}</small></div>
   <Link className="mj-pos-header-action" href={owner?"/admin/pos/kasir":"/kasir/pesanan/baru"}>{owner?"Kelola Kasir":"+ Pesanan"}</Link>
  </header>
  <section className="mj-pos-intro">
   <h1>Pesanan Laundry</h1>
   <p>Kelola antrian, pesanan siap ambil, dan status pembayaran dalam satu aplikasi.</p>
   {!dbReady&&<div className="mj-pos-notice" role="status">Modul POS produksi belum diaktifkan (G8 NO-GO). Data membership lama tetap aman; tidak ada transaksi atau poin yang diposting.</div>}
   {dbReady&&!writeEnabled&&<div className="mj-pos-notice" role="status">Pesanan hanya dapat dilihat. Pembuatan nota dan pembayaran masih dikunci oleh database.</div>}
  </section>
  <nav className="mj-pos-status-tabs" aria-label="Status pesanan">
   {tabs.map(t=><Link key={t.key} href={base+"?tab="+t.key} aria-current={active===t.key?"page":undefined}>
    {t.label} <span>{orders.filter(o=>t.key==="ready"?o.work_status==="READY":t.key==="unpaid"?["UNPAID","PARTIAL"].includes(o.payment_status):o.work_status==="QUEUED").length}</span>
   </Link>)}
  </nav>
  <section className="mj-pos-order-list" aria-label="Daftar nota">
   {visible.length===0?<div className="mj-pos-empty"><div className="mj-pos-empty-art" aria-hidden="true">▣ <span>✧</span> ♧</div>
     <h2>Belum Ada Data</h2><p>Tidak ada pesanan dalam kategori ini.</p></div>:
    <div className="mj-pos-cards">{visible.map(order=><Link key={order.id} href={"/kasir/pesanan/"+order.id} className="mj-pos-order-card">
      <div><small>{order.invoice_no}</small><strong>{order.customer_name}</strong><small>{new Date(order.created_at).toLocaleDateString("id-ID",{timeZone:"Asia/Jakarta"})}</small></div>
      <div className="mj-pos-order-right"><strong>{money(order.total_idr)}</strong><span>{order.payment_status==="PAID"?"Lunas":order.payment_status==="PARTIAL"?"DP":"Belum Bayar"}</span></div>
    </Link>)}</div>}
  </section>
  <section className="mj-pos-menu-section" aria-labelledby="mj-menu-heading"><h2 id="mj-menu-heading">Menu {owner?"Owner":"Kasir"}</h2>
   <div className="mj-pos-menu-grid">
    {(owner?[
     {label:"Data Member",href:"/admin/members",icon:"♙",sub:"Member dan kartu"},
     {label:"Scan Barcode / QR",href:"/admin/scan",icon:"▦",sub:"Pilih pelanggan"},
     {label:"Impor Binatu",href:"/admin/pos/import",icon:"↧",sub:"Rekonsiliasi"},
     {label:"Kelola Kasir",href:"/admin/pos/kasir",icon:"♧",sub:"ID dan izin"},
     {label:"Pengaturan",href:"/admin/settings",icon:"⚙",sub:"Layanan dan poin"}
    ]:[
     {label:"Tambah Pesanan",href:"/kasir/pesanan/baru",icon:"+",sub:"Pelanggan dan layanan"},
     {label:"Daftar Pesanan",href:"/kasir/pesanan",icon:"▤",sub:"Antrian dan nota"},
     {label:"Mutasi Kas",href:"/kasir/kas",icon:"⇄",sub:"Saldo dan shift"},
     {label:"Laporan",href:"/kasir/laporan",icon:"▥",sub:"Rekap periode"}
    ]).map(item=><Link className="mj-pos-menu-card" href={item.href} key={item.href}><span aria-hidden="true" className="mj-pos-menu-icon">{item.icon}</span><strong>{item.label}</strong><small>{item.sub}</small></Link>)}
   </div>
   {owner&&<div className="mj-pos-metrics"><div><small>Member aktif</small><strong>{memberCount??"—"}</strong></div><div><small>Kunjungan tercatat</small><strong>{transactionCount??"—"}</strong></div></div>}
  </section>
 </main>;
}
