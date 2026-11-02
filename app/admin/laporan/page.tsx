import Link from "next/link";
import {requireOwner} from "@/lib/supabase/owner";
import PosWorkspace from "@/components/pos/pos-workspace";
export default async function OwnerReports(){
 await requireOwner();
 return <PosWorkspace title="Laporan" category="OPERASIONAL"
   description="Laporan operasional POS Owner akan mengambil data transaksi yang sudah diverifikasi database."
  ><section className="binatu-locked-feature"><h2>Laporan POS belum tersedia</h2>
   <p>Database POS produksi belum diaktifkan. Tidak ada angka pemasukan, saldo kas, atau piutang yang dibuat-buat.</p>
   <Link className="binatu-button binatu-button-soft" href="/admin/pos/import">Tinjau Impor Binatu</Link>
  </section></PosWorkspace>;
}
