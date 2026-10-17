import type { Metadata } from "next";
import "@/app/admin/admin.css";
import AdminNavigation from "@/components/admin/admin-navigation";

export const metadata: Metadata = {
  title: "Area Pemilik",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="admin-root"><AdminNavigation /><div id="admin-main" tabIndex={-1}>{children}</div></div>;
}
