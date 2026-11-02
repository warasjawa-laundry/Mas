import AdminHome from "../page";
export default function AdminMenu() {
  return <AdminHome searchParams={Promise.resolve({ view: "menu" })} />;
}
