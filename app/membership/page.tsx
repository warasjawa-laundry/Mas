import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import CustomerCardScanner from "@/components/customer-card-scanner";
import { memberProgramLaunched, whatsappLink } from "@/lib/site";

const memberDescription = "Kenali kartu member Mas Jawa Laundry: daftar melalui petugas, bawa kartu QR, cek catatan transaksi tanpa login. Promo diberikan langsung oleh pemilik laundry.";

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
      <SiteHeader />
      <main className="member-information">
        <div className="shell">
          <div className="breadcrumb"><Link href="/">Beranda</Link><span aria-hidden="true">/</span><span>Kartu Member</span></div>
          <div className="member-page-heading">
            <p className="eyebrow">KARTU MEMBER MAS JAWA LAUNDRY</p>
            <h1>Simpan kartu, transaksi tercatat.</h1>
            <p>Pengganti kartu stempel kertas. Setiap kali laundry, petugas cukup memindai kartu lalu mencatat transaksi Anda.</p>
            {!memberProgramLaunched && <div className="program-status" role="status"><strong>Program sedang disiapkan.</strong> Jika sudah menerima kartu QR uji coba dari petugas, Anda bisa membuka progresnya di bawah. Pendaftaran tetap dibantu petugas.</div>}
          </div>
          <CustomerCardScanner />
          <p className="member-owner-entry">Khusus pemilik laundry: <Link href="/admin/login">Masuk ke pengelolaan kartu member →</Link></p>
          <div className="how-grid">
            <article className="how-card"><span>01</span><h2>Daftar ke petugas</h2><p>Anda cukup memberikan nama. Nomor WhatsApp bersifat opsional untuk menerima informasi promo jika Anda setuju.</p></article>
            <article className="how-card"><span>02</span><h2>Bawa kartu saat laundry</h2><p>Petugas memindai QR di kartu dan mengonfirmasi satu catatan transaksi. Tidak perlu memasang aplikasi.</p></article>
            <article className="how-card"><span>03</span><h2>Cek jumlah transaksi</h2><p>Scan QR dengan kamera HP. Halaman ringkas akan menampilkan transaksi yang tercatat dan promo yang Anda terima.</p></article>
          </div>
          <div className="member-policy">
            <div>
              <h2>Bagaimana dengan promo?</h2>
              <p>Promo tidak diberikan otomatis berdasarkan jumlah transaksi. Pemilik laundry menentukan promo secara langsung. Jika Anda mendapatkannya, informasi promo bisa ditampilkan pada halaman kartu member, dan petugas dapat mengirim pemberitahuan melalui WhatsApp setelah Anda bersedia.</p>
              <p>QR Code pada kartu dapat membuka informasi terbatas tanpa login. Simpan kartu Anda dengan baik dan jangan menyebarkan foto QR Code. Bila kartu hilang, hubungi petugas untuk menggantinya.</p>
            </div>
            <div className="member-policy-action">
              <strong>Ada yang ingin ditanyakan?</strong>
              <p>Hubungi Mas Jawa Laundry. Petugas akan membantu menjelaskan cara menggunakan kartu.</p>
              <a href={whatsappLink("Halo Mas Jawa Laundry, saya ingin tanya tentang kartu member.")} className="button button-primary" target="_blank" rel="noopener noreferrer">Tanya lewat WhatsApp <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
