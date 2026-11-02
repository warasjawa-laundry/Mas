import type { CSSProperties } from "react";
export type PosIconName = "orders" | "menu" | "plus" | "people" | "cash" | "report" | "search" | "logout" | "settings" | "staff" | "scan" | "back" | "check" | "receipt";
const paths: Record<PosIconName, string> = {
  orders: "M5 3h14v18l-3-2-4 2-4-2-3 2V3ZM8 8h8M8 12h8M8 16h5",
  menu: "m3 9 2-5h14l2 5v11H3V9Zm0 0h18M9 20v-7h6v7",
  plus: "M12 5v14M5 12h14",
  people: "M15 20H3v-2c0-3 3-5 6-5s6 2 6 5v2ZM9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM16 4a3 3 0 0 1 0 6M18 13c2 1 3 3 3 5v2h-3",
  cash: "M3 5h18v14H3V5ZM3 9h18M7 14h3M14 14h3",
  report: "M4 21V3h16v18H4ZM8 17v-4M12 17V8M16 17v-7",
  search: "M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM16 16l5 5",
  logout: "M9 4H4v16h5M13 7l5 5-5 5M8 12h13",
  settings: "m9 3-.5 3-3 1-2 2 2 3-1 3 3 2 1 3h4l1-3 3-1 2-3-2-3 1-3-3-2L15 3H9ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  scan: "M4 9V5h4M16 5h4v4M20 15v4h-4M8 19H4v-4M7 12h10M7 9v6M17 9v6",
  staff: "M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-3c0-3 3-5 6-5s6 2 6 5v3M17 10h5M19.5 7.5v5M17 17h5M19.5 14.5v5",
  back: "m14 5-7 7 7 7", check: "m5 12 4 4L19 6",
  receipt: "M5 3h14v18l-3-2-4 2-4-2-3 2V3ZM8 8h8M8 12h8M8 16h5",
};
export default function PosIcon({ name, size = 22, style }: { name: PosIconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={style}><path d={paths[name]} /></svg>;
}
