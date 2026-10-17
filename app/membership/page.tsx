import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import CustomerCardScanner from "@/components/customer-card-scanner";
import MembershipScrollEntry from "@/components/membership-scroll-entry";
import { siteHref } from "@/lib/navigation";
import { memberProgramLaunched, whatsappLink } from "@/lib/site";

const memberDescription = "Cara memakai kartu member Mas Jawa Laundry, mulai dari pendaftaran melalui petugas hingga melihat catatan transaksi lewat QR. Promo ditentukan oleh pemilik laundry.";

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
            <p className="eyebrow">KARTU MEMBER MAS JAWA LAUNDRY</p>
            <h1>Kartu member</h1>
            <nav className="member-entry-actions" aria-label="Akses kartu member">
              <a className="member-entry-action member-entry-action-primary" href="#scan-kartu">
                <strong>Scan QR Kartu <span aria-hidden="true">→</span></strong>
              </a>
              <Link className="member-admin-entry" href={siteHref("/admin/login")} prefetch={false}>
                <span>Untuk petugas: <strong>Masuk Admin <span aria-hidden="true">→</span></strong></span>
              </Link>
            </nav>
            <p>Scan QR untuk melihat catatan transaksi. Pendaftaran dan pencatatan transaksi dilakukan oleh petugas.</p>
            {!memberProgramLaunched && <div className="program-status" role="status"><strong>Program sedang disiapkan.</strong> Kartu uji coba dari petugas tetap dapat dipindai.</div>}
          </div>
          <div id="scan-kartu" className="member-scan-target">
            <CustomerCardScanner />
          </div>
          <div className="how-grid">
            <article className="how-card"><span>01</span><h2>Daftar melalui petugas</h2><p>Cukup berikan nama. Nomor WhatsApp boleh dikosongkan dan hanya digunakan untuk informasi promo jika Anda setuju.</p></article>
            <article className="how-card"><span>02</span><h2>Tunjukkan kartu saat transaksi</h2><p>Petugas memindai QR dan mencatat nominal transaksi. Anda tidak perlu memasang aplikasi.</p></article>
            <article className="how-card"><span>03</span><h2>Lihat catatan transaksi</h2><p>Pindai QR dengan kamera HP atau pilih foto QR dari galeri untuk melihat catatan kartu.</p></article>
          </div>
          <div className="member-policy">
            <div>
              <h2>Cara pemberian promo</h2>
              <p>Promo tidak diberikan otomatis berdasarkan jumlah transaksi. Pemilik laundry menentukan promo untuk setiap member. Jika ada promo untuk kartu Anda, informasinya bisa dilihat lewat QR. Pesan promo melalui WhatsApp hanya dikirim jika Anda setuju.</p>
              <p>QR pada kartu dapat dibuka tanpa login dan menampilkan informasi terbatas. Jangan bagikan foto QR kepada orang lain. Jika kartu hilang, hubungi petugas untuk meminta penggantian.</p>
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
