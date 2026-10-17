"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutOwner } from "@/app/admin/actions";

const sections = [
  { href: "/admin", label: "Ringkasan" },
  { href: "/admin/scan", label: "Scan QR" },
  { href: "/admin/members", label: "Member" },
  { href: "/admin/settings", label: "Pengaturan" },
] as const;

function currentSection(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
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
        <a href="/admin/leave">Lihat situs publik</a>
        <form action={logoutOwner}><button type="submit">Keluar akun</button></form>
      </div>
    </aside>
    <nav aria-label="Navigasi utama admin di HP" className="admin-shell-mobile">
      {sections.map(({ href, label }) => (
        <Link key={href} href={href} prefetch={false}
          aria-current={currentSection(pathname, href) ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  </>;
}
