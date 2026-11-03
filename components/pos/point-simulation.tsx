import {formatIdr} from "@/lib/pos/g4-order";
import {readPointSimulation,pointSimulationStatus,type PointSimulation as Data} from "@/lib/pos/point-simulation";
import styles from "@/app/kasir/pesanan/orders.module.css";
export default function PointSimulation({data,error}:{data:Data|null;error?:string}){
 const sim=readPointSimulation(data);
 return <section className={`${styles.card} ${styles.simulationPoints}`} aria-label="Simulasi poin member">
  <h2>SIMULASI POIN MEMBER</h2><strong className={styles.simulationLabel}>SIMULASI — TIDAK DIBUKUKAN</strong>
  {!sim?<p role="status">{error||'Simulasi poin belum tersedia. Baca ulang setelah koneksi tersedia.'}</p>:<>
   <p>Total nota{sim.persisted_order?'':' (perkiraan)'}: <strong>{formatIdr(sim.total_idr)}</strong></p>
   {!sim.rule_available?<p role="status">Aturan poin periode {sim.program_year} belum tersedia. Poin belum dapat dihitung.</p>:
    !['REFUNDED','CANCELLED'].includes(sim.state)&&<p>{sim.state==='PAID'?'Poin simulasi setelah pelunasan':'Perkiraan poin'}: <strong>+{sim.points} poin</strong></p>}
   <p>Status: <strong>{pointSimulationStatus(sim.state)}</strong></p>
   <p className={styles.muted}>Periode {sim.program_year}{sim.rule_available?` · aturan versi ${sim.rule_revision}`:''}. {sim.persisted_order?'Total berasal dari nota tersimpan.':'Total akhir dan periode diperiksa ulang setelah nota disimpan.'}</p>
  </>}
  <p className={styles.muted}>Simulasi, tidak menambah saldo member. Aturan simulasi dapat berubah; ini bukan riwayat poin yang dibukukan.</p>
 </section>;
}
