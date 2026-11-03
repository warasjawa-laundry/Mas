import {formatIdr} from "@/lib/pos/g4-order";
import styles from "@/app/kasir/pesanan/orders.module.css";
export type OrderDelivery={code:string;name:string;amount_idr:string};
export default function OrderCharges({subtotal,total,delivery}:{subtotal?:string;total:string|number;delivery?:OrderDelivery|null}){
 return <div role="group" aria-label="Rincian biaya">
  {delivery&&delivery.code!=='NONE'&&<>
   {subtotal!==undefined&&<div className={styles.item}><span>Subtotal layanan</span><strong>{formatIdr(subtotal)}</strong></div>}
   <div className={styles.item}><span>Antar-jemput ({delivery.name})</span><strong>{formatIdr(delivery.amount_idr)}</strong></div>
  </>}
  <div className={styles.item}><strong>Total nota</strong><strong>{formatIdr(total)}</strong></div>
 </div>;
}
