import Image from "next/image";
import Link from "next/link";
import { assets, site, whatsappLink } from "@/lib/site";
import { siteHref } from "@/lib/navigation";

const nav = [
  { href: "/#layanan", text: "Layanan & Harga" },
  { href: "/#keunggulan", text: "Tentang Kami" },
  { href: "/membership", text: "Kartu Member" },
  { href: "/#kontak", text: "Lokasi" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href={siteHref("/")} aria-label="Mas Jawa Laundry, kembali ke beranda">
          <Image className="brand-image" src={assets.logo} alt="" width={44} height={44} sizes="44px" />
          <span className="brand-copy"><strong>Mas Jawa</strong><small>LAUNDRY</small></span>
        </Link>
        <nav className="desktop-nav" aria-label="Navigasi utama">
          {nav.map((item) => item.href === "/membership"
            ? <a key={item.href} href={siteHref(item.href)}>{item.text}</a>
            : <Link key={item.href} href={siteHref(item.href)}>{item.text}</Link>)}
        </nav>
        <a className="header-contact" href={whatsappLink("Halo Mas Jawa Laundry, saya mau tanya layanan laundry.")} target="_blank" rel="noopener noreferrer">Hubungi WhatsApp <span aria-hidden="true">↗</span></a>
        <details className="mobile-nav">
          <summary aria-label="Buka menu navigasi">Menu <span aria-hidden="true">☰</span></summary>
          <nav aria-label="Navigasi mobile" className="mobile-nav-list">
            {nav.map((item) => <Link key={item.href} href={siteHref(item.href)}>{item.text}</Link>)}
            <a href={whatsappLink("Halo Mas Jawa Laundry, saya mau tanya layanan laundry.")} target="_blank" rel="noopener noreferrer">Hubungi WhatsApp ↗</a>
          </nav>
        </details>
      </div>
    </header>
  );
}
