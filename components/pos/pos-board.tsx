"use client";
import Link from "next/link";
import { useState } from "react";
import PosIcon, { type PosIconName } from "@/components/pos/pos-icon";
import { boardDate, boardMoney, filterBoardOrders, paymentLabel, type BoardTab, type PosRow } from "@/lib/pos/board";
import { site } from "@/lib/site";
export type { PosRow } from "@/lib/pos/board";
type Props = { role: "owner" | "cashier"; tab?: string; view?: string; orders?: PosRow[]; memberCount?: string | null; transactionCount?: string | null; dbReady?: boolean; writeEnabled?: boolean };
const tabs: { key: BoardTab; label: string }[] = [{ key: "queue", label: "Antrian" }, { key: "ready", label: "Siap Ambil" }, { key: "unpaid", label: "Belum Bayar" }];

export default function PosBoard({ role, tab = "queue", view, orders = [], memberCount, transactionCount, dbReady = false, writeEnabled = false }: Props) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const owner = role === "owner", base = owner ? "/admin" : "/kasir";
  const active: BoardTab = tab === "ready" || tab === "unpaid" ? tab : "queue";
  const visible = dbReady ? filterBoardOrders(orders, active, search) : [];
  const selected = visible.find(order => order.id === selectedId) ?? visible[0] ?? null;
  const menu = view === "menu", addHref = owner ? "/admin/login?role=kasir" : "/kasir/pesanan/baru";
  const links: { label: string; sub: string; href: string; icon: PosIconName }[] = owner ? [
    { label: "Tambah Pesanan", sub: "Masuk sebagai kasir untuk membuat nota", href: addHref, icon: "plus" },
    { label: "Data Pelanggan", sub: "Cari, daftarkan, dan ubah data pelanggan", href: "/admin/members", icon: "people" },
    { label: "Scan Barcode / QR", sub: "Scan kartu member lewat kamera atau galeri", href: "/admin/scan", icon: "scan" },
    { label: "Kelola Kasir", sub: "ID dan hak akses petugas", href: "/admin/pos/kasir", icon: "staff" },
    { label: "Pengaturan Akun", sub: "Password akun manajer", href: "/admin/settings", icon: "settings" },
  ] : [
    { label: "Tambah Pesanan", sub: "Pilih pelanggan dan layanan laundry", href: addHref, icon: "plus" },
    { label: "Cari Pesanan", sub: "Daftar dan rincian nota", href: "/kasir/pesanan", icon: "search" },
    { label: "Mutasi Kas", sub: "Penerimaan dan pengeluaran kas", href: "/kasir/kas", icon: "cash" },
    { label: "Laporan", sub: "Rekap transaksi per periode", href: "/kasir/laporan", icon: "report" },
  ];
  return <main className={"binatu-board" + (menu ? " binatu-board-menu" : "")}>
    <div className="binatu-pattern binatu-page-cap" aria-hidden="true" />
    <header className="binatu-outlet-head"><img src="/pos/storefront.svg" width="50" height="50" alt="" /><div><strong>MAS JAWA LAUNDRY</strong><p>{site.shortAddress}</p></div><span className="binatu-role-chip">{owner ? "Manajer" : "Kasir"}<span aria-hidden="true" /></span></header>
    {menu ? <section className="binatu-menu-page" aria-labelledby="menu-title">
      <header className="binatu-page-heading"><div><p>MAS JAWA LAUNDRY</p><h1 id="menu-title">Menu {owner ? "Manajer" : "Kasir"}</h1></div></header>
      {owner && <div className="binatu-member-metrics"><div><small>Pelanggan aktif</small><strong>{memberCount ?? "Belum dimuat"}</strong></div><div><small>Kunjungan tercatat</small><strong>{transactionCount ?? "Belum dimuat"}</strong><span>Seluruh periode</span></div></div>}
      <div className="binatu-menu-list">{links.map(link => <Link href={link.href} key={link.href} prefetch={false}><span className="binatu-menu-symbol"><PosIcon name={link.icon} size={24} /></span><span><strong>{link.label}</strong><small>{link.sub}</small></span><span aria-hidden="true">›</span></Link>)}</div>
    </section> : <>
      <div className="binatu-board-heading"><h1>Pesanan</h1><Link className="binatu-button" href={addHref} prefetch={false}><PosIcon name="plus" size={18} />Tambah Pesanan</Link></div>
      {dbReady && <p className="binatu-board-scope">Daftar menampilkan maksimal 80 nota terbaru. Pencarian berlaku pada daftar ini.</p>}
      {dbReady && !writeEnabled && <p className="binatu-inline-notice" role="status">Pesanan dapat dilihat. Pencatatan transaksi belum diaktifkan.</p>}
      <div className="binatu-orders-split"><section className="binatu-orders-pane" aria-label="Daftar nota">
        <label className="binatu-search"><PosIcon name="search" size={19} /><span className="sr-only">Cari pesanan</span><input type="search" placeholder="Cari nama pelanggan atau nomor nota" value={search} maxLength={80} onChange={event => { setSearch(event.target.value); setSelectedId(null); }} disabled={!dbReady} /></label>
        <nav className="binatu-status-tabs" aria-label="Status pesanan">{tabs.map(item => <Link href={base + "?tab=" + item.key} key={item.key} prefetch={false} aria-current={active === item.key ? "page" : undefined}>{item.label}<span>{dbReady ? filterBoardOrders(orders, item.key).length : "–"}</span></Link>)}</nav>
        {!dbReady ? <div className="binatu-empty"><img src="/pos/empty-laundry.svg" width="280" height="195" alt="" /><h2>Pesanan belum dapat dimuat</h2><p>{owner ? "Daftar nota tersedia melalui akun kasir. Data pelanggan tetap bisa dikelola dari Menu." : "Layanan pesanan belum tersedia. Muat ulang halaman untuk mencoba lagi."}</p><Link className="binatu-button binatu-button-soft" href={owner ? "/admin/menu" : "/kasir"} prefetch={false}>{owner ? "Buka Menu" : "Muat ulang"}</Link></div> :
          visible.length === 0 ? <div className="binatu-empty"><img src="/pos/empty-laundry.svg" width="280" height="195" alt="" /><h2>{search ? "Belum ditemukan pada daftar ini" : "Belum Ada Data"}</h2><p>{search ? "Pencarian hanya mencakup 80 nota terbaru. Coba nama atau nomor nota lain." : "Belum ada pesanan dalam kategori ini pada daftar terbaru."}</p>{search ? <button className="binatu-button binatu-button-soft" onClick={() => setSearch("")}>Hapus pencarian</button> : <Link className="binatu-button binatu-button-soft" href={addHref}>Tambah Pesanan</Link>}</div> :
            <ul className="binatu-order-cards">{visible.map(order => <li key={order.id} className={selected?.id === order.id ? "is-selected" : undefined}><Link className="binatu-order-mobile-link" href={"/kasir/pesanan/" + order.id} prefetch={false}><OrderCard order={order} /></Link><button type="button" className="binatu-order-desktop-pick" aria-pressed={selected?.id === order.id} onClick={() => setSelectedId(order.id)}><OrderCard order={order} /></button></li>)}</ul>}
      </section><section className="binatu-detail-pane" aria-label="Ringkasan nota terpilih">
        {selected ? <><header className="binatu-detail-title"><div><p>RINCIAN PESANAN</p><h2>{selected.invoice_no}</h2></div><span className={"binatu-payment-badge " + (selected.payment_status === "PAID" ? "is-paid" : "")}>{paymentLabel(selected.payment_status)}</span></header>
          <div className="binatu-customer-summary"><span><PosIcon name="people" size={27} /></span><div><small>Pelanggan</small><h3>{selected.customer_name}</h3><p>{boardDate(selected.created_at)}</p></div></div>
          <dl className="binatu-note-facts"><div><dt>Status cucian</dt><dd>{selected.work_status === "READY" ? "Siap Ambil" : selected.work_status === "COLLECTED" ? "Sudah Diambil" : "Antrian"}</dd></div><div><dt>Pembayaran</dt><dd>{paymentLabel(selected.payment_status)}</dd></div></dl>
          <div className="binatu-total-summary"><span>Total tagihan</span><strong>{boardMoney(selected.total_idr)}</strong></div><p className="binatu-detail-help">Lihat rincian layanan, riwayat pembayaran, dan tindakan pesanan pada nota.</p><Link href={"/kasir/pesanan/" + selected.id} className="binatu-button binatu-detail-action" prefetch={false}><PosIcon name="receipt" size={20} />Buka Rincian Nota</Link></> :
          <div className="binatu-detail-placeholder"><img src="/pos/empty-laundry.svg" width="300" height="208" alt="" /><h2>Rincian pesanan</h2><p>Pilih nota pada daftar untuk melihat ringkasannya.</p></div>}
      </section></div>
    </>}
  </main>;
}
function OrderCard({ order }: { order: PosRow }) {
  return <><div className="binatu-order-card-top"><span>{order.invoice_no}</span><strong>{boardMoney(order.total_idr)}</strong></div><div className="binatu-order-card-name">{order.customer_name}</div><div className="binatu-order-card-bottom"><span>{boardDate(order.created_at)}</span><span className={order.payment_status === "PAID" ? "is-paid" : ""}>{paymentLabel(order.payment_status)}</span></div></>;
}
