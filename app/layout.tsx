import type { Metadata, Viewport } from "next";
import "./globals.css";
import { assets, site } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.baseUrl),
  title: {
    default: "Mas Jawa Laundry | Laundry Kiloan & Satuan di Kandang Jati Kulon",
    template: "%s | Mas Jawa Laundry",
  },
  description: "Mas Jawa Laundry melayani laundry kiloan dan satuan di Kandang Jati Kulon. Lihat daftar harga, layanan, lokasi, dan hubungi langsung melalui WhatsApp.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: site.baseUrl,
    siteName: site.name,
    title: "Mas Jawa Laundry | Kiloan & Satuan",
    description: "Lihat layanan, harga dan cara menghubungi Mas Jawa Laundry.",
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
      <body>{children}</body>
    </html>
  );
}
