import Link from "next/link";
import {requireOwner} from "@/lib/supabase/owner";
import {savePointRules,initializePointYear} from "@/app/admin/points/actions";
import {availableProgramYears,canEditProgramYear,canInitializeProgramYear,currentProgramYear} from "@/lib/laundry/program-years";

type Props={searchParams:Promise<{year?:string;error?:string;saved?:string;initialized?:string}>};
type Tier={minimum:number;points:number};
const rp=(n:number)=>new Intl.NumberFormat("id-ID").format(n);
export default async function PointRuleSettings({searchParams}:Props){
 const {supabase}=await requireOwner();
 const q=await searchParams;
 const years=availableProgramYears();
 const requested=Number(q.year);
 const year=q.year && years.includes(requested) ? requested : Math.max(2027,currentProgramYear());
 const editable=canEditProgramYear(year);
 const setupEnabled=process.env.OWNER_POINT_YEAR_SETUP_ENABLED==="1";
 const {data,error}=await supabase.from("laundry_point_rules")
   .select("program_year,revision,tiers,updated_at").eq("program_year",year).maybeSingle();
 const tiers:Tier[]=Array.isArray(data?.tiers)?data.tiers as Tier[]:[];
 return <main className="admin-workspace">
   <div className="admin-topbar"><Link href="/admin/members" className="admin-brand">← Daftar Member</Link><Link href="/admin/settings">Pengaturan</Link></div>
   <section className="admin-content owner-point-rules">
     <p className="admin-kicker">ATURAN POIN</p>
     <h1>Atur poin transaksi</h1>
     <p className="admin-hint">Owner menentukan nominal minimal dan poin untuk lima kelompok transaksi. Aturan baru hanya berlaku untuk transaksi yang dicatat setelah disimpan.</p>
     <nav aria-label="Tahun program poin" className="owner-point-year-tabs">
       {years.map(y=><Link key={y} href={"/admin/points/rules?year="+y}
        aria-current={year===y?"page":undefined}>
         {y===2026?"2026 · Uji coba":y===2027?"2027 · Program":y+" · Program"}
       </Link>)}
     </nav>
     {year===2026&&<p className="member-note">Poin 2026 hanya untuk uji coba/persiapan; tidak dicampur dengan saldo tahun 2027.</p>}
     {q.saved==="1"&&<p className="admin-success" role="status">Aturan poin berhasil disimpan. Transaksi lama tetap memakai hasil perhitungan sebelumnya.</p>}
     {q.initialized&&<p className="admin-success" role="status">Aturan poin tahun {year} sudah tersedia. Periksa dan ubah bila diperlukan sebelum menerima transaksi.</p>}
     {q.error&&<p className="admin-error" role="alert">{q.error==="conflict"?"Aturan berubah dari perangkat lain. Muat ulang dan periksa sebelum menyimpan.":q.error==="invalid"?"Periksa semua nominal (harus meningkat) dan nilai poin.":"Aturan belum bisa disimpan. Periksa koneksi dan coba lagi."}</p>}
     {error?<p className="admin-error">Aturan poin belum dapat dimuat. Periksa koneksi dan coba lagi.</p>:
     !data||tiers.length!==5?
       <section aria-label="Persiapan tahun program poin" className="owner-year-setup">
         <p>Aturan poin tahun {year} belum tersedia. Tidak ada perubahan pada saldo transaksi sebelumnya.</p>
         {canInitializeProgramYear(year)&&setupEnabled?
           <form action={initializePointYear}>
             <input type="hidden" name="year" value={year}/>
             <label><input type="checkbox" name="confirmSetup" value="yes" required/>
               Saya ingin menyiapkan lima kelompok dari aturan tahun {year-1}. Saya akan memeriksanya sebelum transaksi.</label>
             <button type="submit" className="admin-primary">Siapkan aturan poin {year}</button>
           </form>:
           <p className="member-note">Tahun baru belum bisa diaktifkan di lingkungan ini. Tidak ada pencatatan poin otomatis.</p>}
       </section>:
       !editable?<p className="member-note">Aturan tahun {year} hanya untuk dilihat. Transaksi yang sudah dicatat tidak dihitung ulang.</p>:
       null}
     {!error && data && tiers.length===5 && <form className="owner-point-rule-form" action={savePointRules}>
         <input type="hidden" name="year" value={year}/>
         <input type="hidden" name="revision" value={data.revision}/>
         <p className="member-note">Contoh bawaan dari poster program: Rp10.000 = 1 poin, Rp25.000 = 3 poin, dan seterusnya. Nominal di bawah batas pertama menghasilkan 0 poin.</p>
         {tiers.map((tier,index)=><fieldset key={index}>
           <legend>Kelompok {index+1}</legend>
           <div className="owner-rule-inputs">
             <label>Nominal mulai (Rp)
               <input type="number" name={"minimum"+index} inputMode="numeric" min={0} max={1000000000} step={1} required defaultValue={tier.minimum} disabled={!editable}/>
             </label>
             <label>Jumlah poin
               <input type="number" name={"points"+index} inputMode="numeric" min={0} max={10000} step={1} required defaultValue={tier.points} disabled={!editable}/>
             </label>
           </div>
           <small>Contoh saat ini: transaksi mulai Rp{rp(tier.minimum)} memperoleh {tier.points} poin, hingga sebelum batas kelompok berikutnya.</small>
         </fieldset>)}
         {editable && <button className="admin-primary" type="submit">Simpan Aturan Poin {year}</button>}
       </form>}
     <p className="member-note">Poin hadiah/penukaran belum dikelola di tahap ini. Tidak ada poin yang dipotong otomatis.</p>
   </section>
 </main>;
}
