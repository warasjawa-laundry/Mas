import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  assets, site, whatsappLink,
} from "@/lib/site";
import ServicePrices from "@/components/service-prices";
import {readPublishedServices,catalogRealtimeConfig} from "@/lib/services/server";
import { siteHref } from "@/lib/navigation";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const whatsappService = whatsappLink("Halo Mas Jawa Laundry, saya ingin tanya layanan dan harga laundry.");

export const revalidate=60;

export default async function HomePage() {
  const catalog=await readPublishedServices();
  const schema = {
    "@context": "https://schema.org",
    "@type": "LaundryService",
    name: site.name,
    url: site.baseUrl,
    telephone: "+" + site.whatsappNumber,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address + " (" + site.landmark + ")",
      addressLocality: "Kandang Jati Kulon",
      addressRegion: "Jawa Timur",
      addressCountry: "ID",
    },
  };

  return (
    <>
      <SiteHeader />
      <main id="home">
        <section className="hero shell" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">MAS JAWA LAUNDRY</p>
            <h1 id="hero-title">Laundry kiloan dan satuan</h1>
            <p className="hero-description">Cuci lipat, cuci setrika, dan gorden di Kandang Jati Kulon, Probolinggo. Lihat pilihan layanan atau tanyakan kebutuhan cucian Anda.</p>
            <div className="hero-actions">
              <a className="button button-primary" href={siteHref("/#layanan")}>Lihat daftar harga <span aria-hidden="true">↓</span></a>
              <a className="button button-secondary" href={whatsappService} target="_blank" rel="noopener noreferrer">Hubungi lewat WhatsApp <span aria-hidden="true">↗</span></a>
            </div>
            <p className="hero-location"><span className="location-mark" aria-hidden="true" /> {site.landmark}</p>
          </div>
          <div className="hero-visual">
            <div className="hero-photo-frame">
              <Image src={assets.packing} alt="Area penyiapan cucian Mas Jawa Laundry" fill priority sizes="(max-width: 800px) 92vw, 44vw" className="cover-image" />
            </div>

          </div>
        </section>

        <section id="layanan" className="section section-alt" aria-labelledby="services-title">
          <div className="shell">
            <div className="section-top">
              <div><p className="eyebrow">LAYANAN & HARGA</p><h2 id="services-title">Daftar layanan dan harga</h2></div>
              <p className="section-intro">Lihat harga, satuan, dan perkiraan waktu pengerjaan untuk setiap layanan.</p>
            </div>
            <ServicePrices initial={catalog.services} initialFailed={catalog.failed} realtime={catalogRealtimeConfig()}/>
            <details className="price-disclaimer"><summary>Konfirmasi tarif dan estimasi sebelum memesan</summary><p>Konfirmasi biaya dan perkiraan waktu pengerjaan kepada petugas saat menyerahkan cucian.</p></details>
          </div>
        </section>

        <section id="keunggulan" className="section" aria-labelledby="about-title">
          <div className="shell">
            <span id="testimoni" aria-hidden="true" />
            <div className="section-top"><div><p className="eyebrow">CARA LAUNDRY</p><h2 id="about-title">Cara menggunakan layanan</h2></div></div>
            <ol className="service-steps">
              <li><span aria-hidden="true">01</span><h3>Pilih layanan</h3><p>Lihat jenis cucian, tarif, dan estimasi waktu. Tanyakan kepada petugas jika cucian Anda belum tercantum.</p></li>
              <li><span aria-hidden="true">02</span><h3>Bawa cucian ke laundry</h3><p>Konfirmasi layanan, biaya, dan perkiraan selesai saat menyerahkan cucian.</p></li>
              <li><span aria-hidden="true">03</span><h3>Konfirmasi pengambilan</h3><p>Hubungi petugas melalui WhatsApp untuk menanyakan cucian sebelum datang mengambil.</p></li>
            </ol>
          </div>
        </section>

        <section id="promo" className="section section-membership" aria-labelledby="member-title">
          <div className="shell">
            <div className="member-feature">
              <div className="member-feature-copy">
                <p className="eyebrow eyebrow-light">KARTU MEMBER</p>
                <h2 id="member-title">Kartu member</h2>
                <p>Daftar melalui petugas, tunjukkan kartu saat transaksi, lalu pindai QR untuk melihat poin dan riwayat transaksi.</p>
                <a className="button button-white" href={siteHref("/membership")}>Buka kartu member <span aria-hidden="true">→</span></a>
              </div>
            </div>
          </div>
        </section>

        <section className="section contact-section" id="kontak" aria-labelledby="contact-title">
          <div className="shell contact-grid">
            <div className="contact-copy">
              <p className="eyebrow">LOKASI & KONTAK</p>
              <h2 id="contact-title">Lokasi dan kontak</h2>
              <p>Tanyakan harga, jenis cucian, atau ketersediaan layanan antar jemput melalui WhatsApp.</p>
              <div className="contact-actions">
                <a className="button button-primary" href={whatsappService} target="_blank" rel="noopener noreferrer">Chat WhatsApp <span aria-hidden="true">↗</span></a>

              </div>
            </div>
            <aside className="contact-location-card" aria-label="Alamat Mas Jawa Laundry">
              <span className="location-label">ALAMAT LAUNDRY</span>

              <h3>{site.shortAddress}</h3>
              <p>{site.address}<br />{site.landmark}</p>
              <p className="location-hours">Jam buka: {site.hours}.</p>
              <a className="inline-link" href="https://www.google.com/maps/search/?api=1&query=Mas%20Jawa%20Laundry%20Kandang%20Jati%20Kulon" target="_blank" rel="noopener noreferrer">Buka Google Maps <span aria-hidden="true">↗</span></a>
            </aside>
          </div>
        </section>
      </main>
      <SiteFooter />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    </>
  );
}
