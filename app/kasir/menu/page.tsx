import CashierHome from "../page";
export default function CashierMenu() {
  return <CashierHome searchParams={Promise.resolve({ view: "menu" })} />;
}
