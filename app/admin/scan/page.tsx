import {requireOwner} from "@/lib/supabase/owner";
import ScanCard from "@/components/admin/scan-card";
import PosWorkspace from "@/components/pos/pos-workspace";
export default async function OwnerScan(){
 await requireOwner();
 return <PosWorkspace title="Scan Barcode / QR" category="DATA PELANGGAN"
  description="Pindai kartu pelanggan memakai kamera atau galeri. Scan hanya membuka data member, bukan mencatat transaksi atau poin."
  ><ScanCard/></PosWorkspace>;
}
