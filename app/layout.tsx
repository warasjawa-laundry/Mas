import type { Metadata, Viewport } from "next";
import "./globals.css";
import SiteAdminBoundary from "@/components/admin/site-admin-boundary";
import { assets, site } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.baseUrl),
  title: {
    default: "Mas Jawa Laundry | Laundry Kiloan & Satuan di Kandang Jati Kulon",
    template: "%s | Mas Jawa Laundry",
  },
  description: "Informasi harga laundry kiloan dan satuan Mas Jawa Laundry di Kandang Jati Kulon, lokasi, dan kontak WhatsApp.",
  alternates: { canonical: "/" },
  verification: { google: "XQz0UL0rQ7ULMEegfQWFxImJpJWBh7mEW8Ied_zJwXE" },
  robots: { index: process.env.VERCEL_ENV !== "preview", follow: true },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: site.baseUrl,
    siteName: site.name,
    title: "Mas Jawa Laundry | Kiloan & Satuan",
    description: "Lihat tarif laundry kiloan dan satuan, alamat, serta kontak WhatsApp Mas Jawa Laundry.",
    images: [{ url: assets.og, alt: "Mas Jawa Laundry" }],
  },
  icons: { icon: assets.logo },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body><SiteAdminBoundary />{children}</body>
    </html>
  );
}
