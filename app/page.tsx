import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  assets, curtainPrices, kiloPackages, memberProgramLaunched, site, whatsappLink,
} from "@/lib/site";
import { siteHref } from "@/lib/navigation";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const whatsappService = whatsappLink("Halo Mas Jawa Laundry, saya ingin tanya layanan dan harga laundry.");

export default function HomePage() {
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
            <p className="eyebrow"><span className="eyebrow-rule" /> LAUNDRY DI KANDANG JATI KULON</p>
            <h1 id="hero-title">Cuci kiloan dan satuan <em>di Kandang Jati Kulon.</em></h1>
            <p className="hero-description">Lihat harga cuci lipat, cuci setrika, dan gorden. Untuk layanan lain atau perkiraan waktu selesai, tanya petugas melalui WhatsApp.</p>
            <div className="hero-actions">
              <a className="button button-primary" href={whatsappService} target="_blank" rel="noopener noreferrer">Hubungi lewat WhatsApp <span aria-hidden="true">↗</span></a>
              <a className="button button-secondary" href={siteHref("/#layanan")}>Lihat daftar harga <span aria-hidden="true">↓</span></a>
            </div>
            <p className="hero-location"><span className="location-mark" aria-hidden="true" /> {site.shortAddress} <span aria-hidden="true">·</span> {site.landmark}</p>
          </div>
          <div className="hero-visual">
            <div className="hero-photo-frame">
              <Image src={assets.packing} alt="Dokumentasi aktivitas penyiapan laundry Mas Jawa dari situs sebelumnya" fill priority sizes="(max-width: 800px) 92vw, 44vw" className="cover-image" />
            </div>
            <div className="hero-visual-note"><strong>Mas Jawa Laundry</strong><span>Dokumentasi penyiapan cucian.</span></div>
          </div>
        </section>

        <section id="layanan" className="section section-alt" aria-labelledby="services-title">
          <div className="shell">
            <div className="section-top">
              <div><p className="eyebrow">LAYANAN & HARGA</p><h2 id="services-title">Daftar harga laundry</h2></div>
              <p className="section-intro">Harga kiloan berbeda menurut jenis layanan dan waktu pengerjaan. Untuk cucian lain, tanyakan dulu kepada petugas.</p>
            </div>
            <div className="price-grid">
              {kiloPackages.map((pack) => (
                <article className="price-card" key={pack.name}>
                  <div className="price-card-top">
                    <h3>{pack.name}</h3>
                    <span className="duration">{pack.duration}</span>
                  </div>
                  <div className="price-rows">
                    {pack.items.map((item) => (
                      <div key={item.label} className="price-row"><span>{item.label}</span><strong>{item.price}</strong></div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <div className="special-service">
              <div>
                <p className="eyebrow">LAYANAN SATUAN</p>
                <h3>Cuci gorden</h3>
                <p>Tarif gorden dihitung per meter. Untuk jenis cucian satuan lainnya, hubungi petugas lebih dulu.</p>
              </div>
              <div className="special-service-prices">
                {curtainPrices.map((item) => <div className="special-row" key={item.label}><span>{item.label}</span><strong>{item.price}</strong></div>)}
                <a className="inline-link" href={whatsappService} target="_blank" rel="noopener noreferrer">Tanya cucian lainnya <span aria-hidden="true">↗</span></a>
              </div>
            </div>
            <p className="price-disclaimer">Harga dan perkiraan waktu berasal dari situs Mas Jawa Laundry sebelumnya. Konfirmasi tarif dan waktu pengerjaan terbaru kepada petugas sebelum memesan.</p>
          </div>
        </section>

        <section id="keunggulan" className="section" aria-labelledby="about-title">
          <div className="shell about-grid">
            <div className="about-image-group" id="testimoni">
              <div className="about-image-main">
                <Image src={assets.workspace} alt="Foto dokumentasi area kerja laundry dari website Mas Jawa sebelumnya" fill sizes="(max-width: 800px) 88vw, 38vw" className="cover-image" />
              </div>
              <p>Foto area kerja dari arsip situs Mas Jawa Laundry</p>
            </div>
            <div className="about-copy">
              <p className="eyebrow">MAS JAWA LAUNDRY</p>
              <h2 id="about-title">Cuci lipat atau cuci setrika?</h2>
              <p>Layanan kiloan tersedia dalam paket Reguler, Express, dan Kilat. Pilih sesuai jenis cucian dan waktu pengerjaan yang dibutuhkan.</p>
              <div className="about-points">
                <div><span className="point-index">01</span><span><strong>Pilihan waktu pengerjaan</strong><small>Lihat tarif dan estimasi setiap paket kiloan.</small></span></div>
                <div><span className="point-index">02</span><span><strong>Konfirmasi sebelum datang</strong><small>Tanyakan jenis cucian atau layanan yang tersedia lewat WhatsApp.</small></span></div>
                <div><span className="point-index">03</span><span><strong>Alamat laundry</strong><small>{site.address}, {site.landmark}.</small></span></div>
              </div>
            </div>
          </div>
        </section>

        <section id="promo" className="section section-membership" aria-labelledby="member-title">
          <div className="shell">
            <div className="member-feature">
              <div className="member-feature-copy">
                <p className="eyebrow eyebrow-light">KARTU MEMBER</p>
                <h2 id="member-title">Lihat catatan transaksi lewat kartu QR.</h2>
                <p>{memberProgramLaunched
                  ? "Daftar melalui petugas, tunjukkan kartu saat laundry, lalu pindai QR untuk melihat transaksi yang sudah dicatat."
                  : "Kami sedang menyiapkan kartu member. Saat program dibuka, pendaftaran dilakukan melalui petugas. Catatan transaksi dapat dilihat lewat QR pada kartu."}</p>
                <a className="button button-white" href={siteHref("/membership")}>Cara memakai kartu member <span aria-hidden="true">→</span></a>
              </div>
              <div className="member-feature-steps" aria-label="Cara kerja kartu member">
                <div><span className="feature-step-number">01</span><span><strong>Daftar ke petugas</strong><small>Kartu dibuat oleh petugas laundry.</small></span></div>
                <div><span className="feature-step-number">02</span><span><strong>Tunjukkan kartu</strong><small>Petugas memindai QR dan mencatat transaksi.</small></span></div>
                <div><span className="feature-step-number">03</span><span><strong>Periksa transaksi</strong><small>Pindai QR dengan HP untuk melihat catatan pada kartu.</small></span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="section contact-section" id="kontak" aria-labelledby="contact-title">
          <div className="shell contact-grid">
            <div className="contact-copy">
              <p className="eyebrow">LOKASI & KONTAK</p>
              <h2 id="contact-title">Hubungi Mas Jawa Laundry</h2>
              <p>Tanyakan harga, jenis cucian, atau ketersediaan layanan antar jemput melalui WhatsApp.</p>
              <div className="contact-address">
                <strong>Mas Jawa Laundry</strong>
                <span>{site.address}</span>
                <span>{site.landmark}</span>
                <span>Jam yang tercantum di situs sebelumnya: {site.hours}</span>
              </div>
              <div className="contact-actions">
                <a className="button button-primary" href={whatsappService} target="_blank" rel="noopener noreferrer">Chat WhatsApp <span aria-hidden="true">↗</span></a>
                <a className="button button-secondary" href="https://www.google.com/maps/search/?api=1&query=Mas%20Jawa%20Laundry%20Kandang%20Jati%20Kulon" target="_blank" rel="noopener noreferrer">Petunjuk lokasi <span aria-hidden="true">↗</span></a>
              </div>
            </div>
            <aside className="contact-location-card" aria-label="Alamat Mas Jawa Laundry">
              <span className="location-label">ALAMAT LAUNDRY</span>
              <span className="location-monogram" aria-hidden="true">MJ</span>
              <h3>Mas Jawa Laundry</h3>
              <p>{site.address}<br />{site.landmark}<br />{site.shortAddress}</p>
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
