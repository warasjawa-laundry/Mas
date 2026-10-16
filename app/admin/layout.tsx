import type { Metadata } from "next";
import "@/app/admin/admin.css";

export const metadata: Metadata = {
  title: "Area Pemilik",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="admin-root">{children}</div>;
}
