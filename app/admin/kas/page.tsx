import Link from "next/link";
import {requireOwner} from "@/lib/supabase/owner";
import PosWorkspace from "@/components/pos/pos-workspace";
export default async function OwnerCash(){
 await requireOwner();
 return <PosWorkspace title="Mutasi Kas" category="OPERASIONAL" description="Ringkasan kas outlet Mas Jawa Laundry."
  ><section className="binatu-locked-feature"><h2>Kas POS belum diaktifkan</h2>
  <p>Transaksi dan buku kas POS produksi belum tersedia (G8 NO-GO). Saldo tidak ditampilkan sebagai nol karena belum diverifikasi. Pengelolaan member lama tetap tersedia.</p>
  <Link href="/admin/menu" className="binatu-button binatu-button-soft">Kembali ke Menu</Link></section></PosWorkspace>;
}
