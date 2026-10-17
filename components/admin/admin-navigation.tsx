"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutOwner } from "@/app/admin/actions";

const sections = [
  { href: "/admin", label: "Ringkasan" },
  { href: "/admin/scan", label: "Scan QR" },
  { href: "/admin/members", label: "Member" },
  { href: "/admin/points/rules", label: "Atur Poin" },
  { href: "/admin/settings", label: "Pengaturan" },
] as const;

function currentSection(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/points/rules") return pathname.startsWith("/admin/points/");
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AdminNavigation() {
  const pathname = usePathname();
  // No extra owner fetch from navigation; every admin page/action enforces
  // server-side owner verification and DB RLS remain authoritative.
  if (!pathname || pathname === "/admin/login") return null;

  const navItems = sections.map(({ href, label }) => (
    <Link key={href} href={href} prefetch={false}
      aria-current={currentSection(pathname, href) ? "page" : undefined}>
      {label}
    </Link>
  ));

  return <>
    <a href="#admin-main" className="admin-skip-link">Lewati navigasi</a>
    <aside className="admin-shell-sidebar" aria-label="Menu pemilik">
      <Link href="/admin" className="admin-shell-brand" prefetch={false}>
        <span className="admin-shell-monogram" aria-hidden="true">MJ</span>
        <span>Mas Jawa Laundry<small>Area Pemilik</small></span>
      </Link>
      <nav aria-label="Navigasi utama admin" className="admin-shell-links">{navItems}</nav>
      <div className="admin-shell-footer">
        <Link href="/" prefetch={false}>Lihat situs publik</Link>
        <form action={logoutOwner}><button type="submit">Keluar akun</button></form>
      </div>
    </aside>
    <nav aria-label="Navigasi utama admin di HP" className="admin-shell-mobile">
      {sections.filter(x=>x.href!=="/admin/points/rules").map(({ href, label }) => (
        <Link key={href} href={href} prefetch={false}
          aria-current={currentSection(pathname, href) ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  </>;
}
