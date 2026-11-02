import Link from "next/link";
import PosWorkspace from "@/components/pos/pos-workspace";
import { requireOwner } from "@/lib/supabase/owner";
import { importBinatuPreview, reviewBinatuRow } from "./actions";
import { formatIdr } from "@/lib/pos/g4-order";
export const dynamic="force-dynamic";
export const metadata={title:"Pratinjau Impor Binatu - Mas Jawa Laundry",robots:{index:false,follow:false}};
type Batch={id:string;source:string;received_at:string;total_rows:number;pending_paid:number};
type Row={id:string;row:number;invoice:string;customer:string;status:string;
 payment:string;total_idr:string;paid_idr:string;review:string;member_id:string|null};
type Candidate={id:string;number:string;name:string;phone:string|null;address:string|null};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const shell={maxWidth:850,margin:"auto",padding:"24px 16px 90px",fontFamily:"var(--font-pos)",color:"#22252a"} as const;
const panel={background:"#fff",border:"1px solid #dce1ea",borderRadius:16,padding:20,marginTop:20} as const;
export default async function ImportPreview({searchParams}:{searchParams:Promise<{batch?:string;row?:string;hide?:string;error?:string;saved?:string}>}){
 const {supabase}=await requireOwner();const params=await searchParams;
 const {data:list,error:batchError}=await supabase.rpc('laundry_pos_g6b_import_batches');
 const batches=Array.isArray(list)?list as Batch[]:[];
 const selected=typeof params.batch==='string'&&UUID.test(params.batch)?params.batch:null;
 const {data:rowsResult,error:rowsError}=selected?await supabase.rpc('laundry_pos_g6b_import_rows',{p_batch_id:selected}):{data:null,error:null};
 const rows=Array.isArray(rowsResult)?rowsResult as Row[]:[];
 const pending=rows.filter(x=>x.payment==='PAID'&&x.review==='PENDING');
 const conflicts=rows.filter(x=>x.payment==='PAID'&&x.review==='CONFLICT');
 const current=params.hide==='1'?null:((params.row&&UUID.test(params.row)?rows.find(r=>r.id===params.row&&r.payment==='PAID'&&r.review==='CONFLICT'):null)??pending[0]??null);
 const {data:candidatesResult,error:candidateError}=current?await supabase.rpc('laundry_pos_g6b_member_candidates',{p_row_id:current.id}):{data:[],error:null};
 const candidates=Array.isArray(candidatesResult)?candidatesResult as Candidate[]:[];
 return <PosWorkspace title="Impor Binatu" category="DATA & PELANGGAN" description="Rekonsiliasi laporan transaksi Binatu dengan database member MasJawa."><div className="binatu-import-content">
  <p>Unggah laporan pesanan Binatu untuk ditinjau. <strong>Tidak ada pembayaran atau poin yang diberikan oleh impor.</strong> Nomor nota Binatu dipakai sebagai identitas asal, bukan nomor member MJL.</p>
  {params.error&&<p role="alert" style={{color:'#9f1239',padding:14,background:'#fff1f2',borderRadius:12}}>
   {params.error==='file'?'Hanya CSV atau XLSX maksimal 1,5 MB.':params.error==='template'?'Template/header atau data XLSX tidak dapat divalidasi. Gunakan laporan Binatu tanpa rumus, makro, dan sheet tambahan.':
    'Proses gagal atau ada konflik identitas/nota. Tidak ada poin maupun transaksi yang dibuat.'}</p>}
  {params.saved&&<p role="status" style={{color:'#047857'}}>Keputusan review tersimpan. Tidak ada posting finansial.</p>}
  <section style={panel}><h2>Unggah laporan</h2>
   <form action={importBinatuPreview} style={{display:'grid',gap:12}}>
    <label>File laporan (.xlsx / .csv)<input name="report" type="file" accept=".xlsx,.csv" required style={{display:'block',marginTop:10,minHeight:44}}/></label>
    <button style={{background:'#f7b801',color:'#22252a',padding:14,border:0,borderRadius:12,minHeight:48,fontWeight:700}}>Buka pratinjau</button>
   </form>
   <p style={{color:'#64748b',fontSize:13}}>Batas 200 nota, satu sheet. Kolom Binatu harus mencakup NOTA, PELANGGAN, STATUS, PEMBAYARAN, HARGA AKHIR, SUDAH BAYAR. File asli tidak disimpan.</p>
  </section>
  <section style={panel}><h2>Riwayat impor</h2>
   {batchError?<p role="status">Database impor belum diaktifkan; tidak ada data produksi yang diubah.</p>:
   batches.length===0?<p>Belum ada batch.</p>:<ul>{batches.map(b=><li key={b.id} style={{marginBottom:10}}>
    <Link href={`/admin/pos/import?batch=${b.id}`}>{new Date(b.received_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB</Link>
    {' · '}{b.total_rows} nota · {b.pending_paid} transaksi lunas perlu review
   </li>)}</ul>}
  </section>
  {selected&&<section style={panel}>
   <h2>Pratinjau batch</h2>
   {rowsError?<p role="alert">Batch tidak ditemukan atau akses ditolak.</p>:<>
    <p><strong>{rows.length} nota</strong>, {rows.filter(r=>r.payment==='PAID').length} sudah lunas, {pending.length} menunggu review, {conflicts.length} konflik sumber.</p>
    {current?<div role="dialog" aria-modal="true" aria-label="Konfirmasi transaksi lunas Binatu" style={{position:'fixed',inset:0,zIndex:100,background:'rgba(15,23,42,.68)',display:'flex',alignItems:'center',justifyContent:'center',padding:12}}>
     <div style={{background:'#fffaf0',padding:20,border:'1px solid #dfe2e6',borderRadius:16,maxWidth:650,width:'100%',maxHeight:'94vh',overflowY:'auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}><strong>Konfirmasi data</strong><Link href={`/admin/pos/import?batch=${selected}&hide=1`} aria-label="Tutup konfirmasi sementara">Tutup ×</Link></div>
      <p style={{fontSize:12,fontWeight:800,color:'#665000'}}>KONFIRMASI {rows.filter(r=>r.payment==='PAID').length-pending.length+1} DARI {rows.filter(r=>r.payment==='PAID').length}</p>
      <h3>{current.customer}</h3>
      <p>Nota Binatu: <strong>{current.invoice}</strong> · Baris {current.row}</p>
      <p>Status: <strong>Lunas</strong> · Dibayar: <strong>{formatIdr(current.paid_idr)}</strong></p>
      {current.review==='CONFLICT'&&<p role="alert" style={{color:'#9f1239'}}>Nomor nota ini terdeteksi duplikat/konflik. Periksa sumber sebelum mengonfirmasi.</p>}
      {candidateError?<p>Daftar calon member tidak tersedia.</p>:<>
       <p style={{fontWeight:750}}>Cocokkan dengan member Mas Jawa Laundry:</p>
       {candidates.length===0?<p>Tidak ada nama persis yang cocok. Tandai konflik atau lewati, jangan membuat member otomatis.</p>:
       <form action={reviewBinatuRow} style={{display:'grid',gap:12}}>
        <input type="hidden" name="batch" value={selected}/><input type="hidden" name="row" value={current.id}/>
        <input type="hidden" name="decision" value="MATCHED"/>
        {candidates.map(c=><label key={c.id} style={{background:'white',border:'1px solid #858b94',padding:12,borderRadius:12}}>
          <input type="radio" name="member" value={c.id} required/> <strong>{c.name}</strong> · Member #{c.number}
          <small style={{display:'block',marginLeft:23}}>Telepon: {c.phone||'—'} · Alamat: {c.address||'—'}</small>
        </label>)}
        <button style={{minHeight:48,background:'#f7b801',color:'#22252a',border:0,borderRadius:12,fontWeight:700}}>Konfirmasi hanya pencocokan (tanpa poin)</button>
       </form>}
      </>}
      <form action={reviewBinatuRow} style={{display:'grid',gap:10,marginTop:18}}>
       <input type="hidden" name="batch" value={selected}/><input type="hidden" name="row" value={current.id}/>
       <label>Alasan tidak cocok / dilewati<input name="reason" required minLength={3} maxLength={300} style={{width:'100%',padding:10,marginTop:6}}/></label>
       <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <button name="decision" value="CONFLICT" style={{padding:12,borderRadius:10,border:'1px solid #e11d48',background:'white'}}>Tandai konflik</button>
        <button name="decision" value="SKIPPED" style={{padding:12,borderRadius:10,border:'1px solid #cbd5e1',background:'white'}}>Lewati nota</button>
       </div>
      </form>
     </div></div>:<p role="status" style={{color:'#047857'}}>Tidak ada dialog konfirmasi terbuka. {pending.length>0?'Lanjutkan verifikasi dari tombol di bawah.':'Semua baris lunas tidak ada yang menunggu.'}</p>}
    {pending.length>0&&<p><Link href={`/admin/pos/import?batch=${selected}`}>Lanjutkan konfirmasi ({pending.length} nota)</Link></p>}
    {conflicts.length>0&&<section style={{marginTop:18}}><h3>Konflik nomor nota</h3><p>Pilih untuk meninjau, atau tandai lewati jika tidak dapat direkonsiliasi.</p>{conflicts.map(c=><p key={c.id}><Link href={`/admin/pos/import?batch=${selected}&row=${c.id}`}>{c.invoice} · {c.customer}</Link></p>)}</section>}
    <details style={{marginTop:22}}><summary>Daftar seluruh nota ({rows.length})</summary>
      <div style={{maxHeight:360,overflowY:'auto'}}>{rows.map(r=><p key={r.id} style={{borderBottom:'1px solid #e2e8f0',paddingBottom:8}}>
       {r.invoice} · {r.customer} · {r.payment} · {r.review} · {formatIdr(r.total_idr)}</p>)}</div>
    </details>
   </>}
  </section>}
 </div></PosWorkspace>;
}
