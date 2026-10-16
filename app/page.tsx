import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  assets, curtainPrices, kiloPackages, memberProgramLaunched, site, whatsappLink,
} from "@/lib/site";

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
            <p className="eyebrow"><span className="eyebrow-rule" /> MAS JAWA LAUNDRY · KANDANG JATI KULON</p>
            <h1 id="hero-title">Cuci kiloan dan satuan <em>di dekat rumah.</em></h1>
            <p className="hero-description">Cari layanan laundry dan harga yang sesuai kebutuhan. Kalau ingin tanya dulu, langsung hubungi kami lewat WhatsApp.</p>
            <div className="hero-actions">
              <a className="button button-primary" href={whatsappService} target="_blank" rel="noopener noreferrer">Hubungi lewat WhatsApp <span aria-hidden="true">↗</span></a>
              <a className="button button-secondary" href="#layanan">Lihat daftar harga <span aria-hidden="true">↓</span></a>
            </div>
            <p className="hero-location"><span className="location-mark" aria-hidden="true" /> {site.shortAddress} <span aria-hidden="true">·</span> {site.landmark}</p>
          </div>
          <div className="hero-visual">
            <div className="hero-photo-frame">
              <Image src={assets.packing} alt="Dokumentasi aktivitas penyiapan laundry Mas Jawa dari situs sebelumnya" fill priority sizes="(max-width: 800px) 92vw, 44vw" className="cover-image" />
            </div>
            <div className="hero-visual-note"><strong>Mas Jawa Laundry</strong><span>Informasi layanan dan harga dalam satu tempat.</span></div>
          </div>
        </section>

        <section id="layanan" className="section section-alt" aria-labelledby="services-title">
          <div className="shell">
            <div className="section-top">
              <div><p className="eyebrow">LAYANAN & HARGA</p><h2 id="services-title">Pilih yang sesuai kebutuhan.</h2></div>
              <p className="section-intro">Layanan kiloan dengan beberapa pilihan waktu pengerjaan. Untuk cucian khusus, tanyakan langsung kepada petugas.</p>
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
                <h3>Gorden dan cucian khusus</h3>
                <p>Butuh pencucian selain kiloan? Hubungi laundry untuk memastikan layanan dan perkiraan pengerjaan.</p>
              </div>
              <div className="special-service-prices">
                {curtainPrices.map((item) => <div className="special-row" key={item.label}><span>{item.label}</span><strong>{item.price}</strong></div>)}
                <a className="inline-link" href={whatsappService} target="_blank" rel="noopener noreferrer">Tanyakan layanan lain <span aria-hidden="true">↗</span></a>
              </div>
            </div>
            <p className="price-disclaimer">Harga dan estimasi di atas mengikuti informasi pada website Mas Jawa Laundry sebelumnya. Pastikan kembali layanan, tarif, dan estimasi terbaru kepada petugas sebelum memesan.</p>
          </div>
        </section>

        <section id="keunggulan" className="section" aria-labelledby="about-title">
          <div className="shell about-grid">
            <div className="about-image-group" id="testimoni">
              <div className="about-image-main">
                <Image src={assets.workspace} alt="Foto dokumentasi area kerja laundry dari website Mas Jawa sebelumnya" fill sizes="(max-width: 800px) 88vw, 38vw" className="cover-image" />
              </div>
              <p>Dokumentasi dari arsip website Mas Jawa Laundry</p>
            </div>
            <div className="about-copy">
              <p className="eyebrow">MAS JAWA LAUNDRY</p>
              <h2 id="about-title">Informasi jelas, jadi lebih mudah menentukan layanan.</h2>
              <p>Kebutuhan cucian setiap orang berbeda. Mas Jawa Laundry menyediakan pilihan cuci lipat dan cuci setrika, dengan beberapa opsi waktu pengerjaan.</p>
              <div className="about-points">
                <div><span className="point-index">01</span><span><strong>Layanan bisa dipilih</strong><small>Lihat paket reguler, express, dan kilat beserta tarifnya.</small></span></div>
                <div><span className="point-index">02</span><span><strong>Bisa bertanya dulu</strong><small>Tanyakan jenis cucian, harga, dan ketersediaan layanan melalui WhatsApp.</small></span></div>
                <div><span className="point-index">03</span><span><strong>Lokasi mudah dicari</strong><small>{site.address}, {site.landmark}.</small></span></div>
              </div>
            </div>
          </div>
        </section>

        <section id="promo" className="section section-membership" aria-labelledby="member-title">
          <div className="shell">
            <div className="member-feature">
              <div className="member-feature-copy">
                <p className="eyebrow eyebrow-light">KARTU MEMBER</p>
                <h2 id="member-title">Kartu langganan, tanpa harus mengingat jumlah transaksi.</h2>
                <p>{memberProgramLaunched
                  ? "Daftar di laundry, bawa kartu saat bertransaksi, dan lihat jumlah transaksi lewat QR Code pada kartu."
                  : "Kami sedang menyiapkan kartu member dengan pencatatan transaksi digital. Pendaftaran dan pengecekan akan dibantu oleh petugas ketika program mulai tersedia."}</p>
                <Link className="button button-white" href="/membership">Pelajari kartu member <span aria-hidden="true">→</span></Link>
              </div>
              <div className="member-feature-steps" aria-label="Cara kerja kartu member">
                <div><span className="feature-step-number">01</span><span><strong>Daftar di laundry</strong><small>Petugas membantu membuat kartu member.</small></span></div>
                <div><span className="feature-step-number">02</span><span><strong>Bawa kartu</strong><small>Petugas memindai QR saat transaksi dan mencatatnya.</small></span></div>
                <div><span className="feature-step-number">03</span><span><strong>Cek transaksi</strong><small>Scan QR kartu memakai kamera HP untuk melihat catatan pribadi.</small></span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="section contact-section" id="kontak" aria-labelledby="contact-title">
          <div className="shell contact-grid">
            <div className="contact-copy">
              <p className="eyebrow">LOKASI & KONTAK</p>
              <h2 id="contact-title">Mau tanya dulu? Hubungi langsung.</h2>
              <p>Untuk pertanyaan tentang harga, jenis cucian, maupun layanan antar jemput yang tersedia, silakan menghubungi Mas Jawa Laundry.</p>
              <div className="contact-address">
                <strong>Mas Jawa Laundry</strong>
                <span>{site.address}</span>
                <span>{site.landmark}</span>
                <span>Informasi jam pada situs sebelumnya: {site.hours}</span>
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
      <div className="mobile-cta"><a href={whatsappService} target="_blank" rel="noopener noreferrer">Hubungi via WhatsApp <span aria-hidden="true">↗</span></a></div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    </>
  );
}
