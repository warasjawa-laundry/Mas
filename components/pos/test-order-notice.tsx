import styles from "@/app/kasir/pesanan/orders.module.css";
export default function TestOrderNotice({isTestOrder}:{isTestOrder:boolean}){
 if(!isTestOrder)return null;
 return <aside className={`${styles.card} ${styles.testNotice}`} role="note" aria-label="Nota uji">
  <strong>NOTA UJI - SIMULASI. Bukan bukti pembayaran nyata.</strong>
  <p>Gunakan data dummy dan uang simulasi. Jangan terima uang sungguhan atau kirim nota ini kepada pelanggan.</p>
 </aside>;
}
