import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import CustomerCardScanner from "@/components/customer-card-scanner";
import MembershipScrollEntry from "@/components/membership-scroll-entry";
import { siteHref } from "@/lib/navigation";
import { whatsappLink } from "@/lib/site";

const memberDescription = "Scan QR kartu member MasJawa Laundry lewat kamera atau galeri untuk melihat poin, riwayat transaksi, dan promo yang tercatat.";

export const metadata: Metadata = {
  title: "Kartu Member",
  description: memberDescription,
  alternates: { canonical: "/membership" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/membership",
    title: "Kartu Member | Mas Jawa Laundry",
    description: memberDescription,
    siteName: "Mas Jawa Laundry",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kartu Member | Mas Jawa Laundry",
    description: memberDescription,
  },
};

export default function MembershipPage() {
  return (
    <>
      <MembershipScrollEntry />
      <SiteHeader />
      <main className="member-information">
        <div className="shell">
          <div className="breadcrumb"><Link href={siteHref("/")}>Beranda</Link><span aria-hidden="true">/</span><span>Kartu Member</span></div>
          <div className="member-page-heading">
            <h1>Scan Kartu Member</h1>
            <p>Lihat saldo poin, riwayat transaksi, dan promo pada kartu Anda. Pilih kamera atau foto QR dari galeri.</p>
          </div>
          <div id="scan-kartu" className="member-scan-target">
            <CustomerCardScanner />
          </div>
          <div className="member-policy">
            <div>
              <h2>Tentang kartu Anda</h2>
              <p>Belum punya kartu? Daftar melalui petugas. Nomor WhatsApp boleh dikosongkan. Promo tidak diberikan otomatis berdasarkan poin atau jumlah transaksi; promo yang tersedia tercatat pada kartu. Pesan promo hanya dikirim jika Anda setuju.</p>
              <p>QR dapat membuka catatan tanpa login. Jangan bagikan fotonya kepada orang lain. Jika kartu hilang, minta penggantian kepada petugas.</p>
            </div>
            <div className="member-policy-action">
              <strong>Perlu bantuan kartu member?</strong>
              <p>Hubungi petugas jika QR sulit dipindai atau ada catatan transaksi yang ingin ditanyakan.</p>
              <a href={whatsappLink("Halo, saya ingin tanya tentang kartu member Mas Jawa Laundry.")} className="button button-primary" target="_blank" rel="noopener noreferrer">Tanya lewat WhatsApp <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
