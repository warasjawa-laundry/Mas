import Link from "next/link";
import { site, whatsappLink } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <div>
          <strong>Mas Jawa Laundry</strong>
          <p>Jl. Raya Kandang Jati Kulon RT.06 RW.01<br />{site.landmark}</p>
        </div>
        <nav aria-label="Navigasi footer">
          <Link href="/#layanan">Harga</Link>
          <Link href="/membership">Kartu Member</Link>
          <a href={whatsappLink()} target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>
        </nav>
        <p className="copyright">© {new Date().getFullYear()} Mas Jawa Laundry</p>
      </div>
    </footer>
  );
}
