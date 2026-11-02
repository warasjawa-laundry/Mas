
import {getCashierSession} from "@/lib/pos/cashier-device";
import {CashierNavigation} from "@/components/admin/admin-navigation";
export default async function CashierLayout({children}:{children:React.ReactNode}){
 const session=await getCashierSession();
 return <div className={"mj-pos-root"+(session?" mj-has-sidebar":"")}>
  {session&&<CashierNavigation/>}<div className="mj-staff-main" id="cashier-main" tabIndex={-1}>{children}</div>
 </div>;
}
