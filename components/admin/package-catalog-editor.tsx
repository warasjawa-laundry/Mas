import {randomUUID} from "node:crypto";
import RecoverableForm from "./recoverable-form";
import LegacyServiceSelector from "./legacy-service-selector";
import PendingSubmit from "./pending-submit";
import {savePackage,saveFamily,enablePackageWorkflow,saveReceiptSettings} from "@/app/admin/settings/services/package-actions";
type Package={code:string;name:string;duration_minutes:number|null;active:boolean;revision:number};
type Legacy={id:string;name:string;package_name:string;price_idr:number;revision:number};
type Family={id:string;name:string;category:string;unit:string;position:number;active:boolean;revision:number;tariffs:{code:string;price_idr:number;active:boolean}[]};
export type PackageSettings={packages:Package[];families:Family[];legacy:Legacy[];enabled:boolean};
function FamilyForm({family,packages,legacy=[]}:{family:Partial<Family>;packages:Package[];legacy?:Legacy[]}){
 const id=family.id??randomUUID();
 return <RecoverableForm action={saveFamily} className="service-editor admin-form">
  <input type="hidden" name="id" value={id}/><input type="hidden" name="revision" value={family.revision??0}/>
  <label>Nama layanan<input name="name" required maxLength={100} defaultValue={family.name}/></label>
  <label>Kategori<input name="category" required maxLength={80} defaultValue={family.category}/></label>
  <label>Satuan<select name="unit" defaultValue={family.unit??'kg'}><option value="kg">kg</option><option value="pcs">pcs</option><option value="meter">meter</option></select></label>
  <label>Urutan tampilan<input name="position" type="number" min={0} max={9999} required defaultValue={family.position??100}/></label>
  <label><input type="checkbox" name="active" value="yes" defaultChecked={family.active??true}/> Layanan aktif</label>
  {packages.map(p=>{const tariff=family.tariffs?.find(t=>t.code===p.code);return <fieldset key={p.code}><legend>{p.name}</legend>
   <label><input type="checkbox" name={'active-'+p.code} value="yes" defaultChecked={tariff?.active??false}/> Tersedia</label>
   {!family.id&&<LegacyServiceSelector code={p.code} services={legacy}/>}
   <label>Harga {p.name} (Rp)<input type="number" inputMode="numeric" min={0} max={1000000000} step={1} name={'price-'+p.code} defaultValue={tariff?.price_idr}/></label>
  </fieldset>})}
  <PendingSubmit label="Simpan layanan & tarif"/>
 </RecoverableForm>;
}
function packageDuration(minutes:number|null):string{
 if(minutes===null)return "Belum diatur";
 return minutes%60===0?`${minutes/60} jam`:`${minutes} menit`;
}
export default function PackageCatalogEditor({settings,receipt}:{settings:PackageSettings;receipt:{revision:number;config:Record<string,string>}|null}){
 const labels:Record<string,string>={outlet_name:'Nama outlet',address:'Alamat outlet',contact:'Kontak outlet',new_title:'Judul Nota Baru',ready_title:'Judul Siap Diambil',collected_title:'Judul Sudah Diambil',terms:'Ketentuan komplain',payment_notice:'Pemberitahuan pembayaran',bank:'Rekening bank',ewallet:'E-wallet',cs:'Kontak CS'};
 return <section>
  <h2>Pengaturan Paket</h2><p className="admin-hint">Atur durasi pengerjaan sekali untuk Reguler, Ekspres, dan Kilat (jam kalender). Durasi ini dipakai menghitung estimasi nota baru, bukan ditampilkan berulang pada setiap layanan. Isi nilai resmi Owner sebelum mengaktifkan paket.</p>
  {settings.packages.map(p=><details key={p.code}><summary>{p.name} · {packageDuration(p.duration_minutes)} · {p.active?'Aktif':'Nonaktif'}</summary>
   <RecoverableForm action={savePackage} className="admin-form service-editor"><input type="hidden" name="code" value={p.code}/><input type="hidden" name="revision" value={p.revision}/>
    <label>Nama paket<input name="name" required maxLength={80} defaultValue={p.name}/></label>
    <label>Durasi (menit kalender)<input name="minutes" type="number" min={1} max={525600} required defaultValue={p.duration_minutes??''}/></label>
    <label><input type="checkbox" name="active" value="yes" defaultChecked={p.active}/> Paket aktif</label><PendingSubmit label="Simpan paket"/>
   </RecoverableForm></details>)}
  <h2>Layanan &amp; Harga per Paket</h2><p className="admin-hint">Satu nama layanan, tiga pilihan paket. Aktifkan hanya paket yang memang tersedia dan isi tarif resmi Owner; harga dan durasi contoh tidak diisi otomatis.</p>
  {settings.legacy.length>0&&<p className="member-note">{settings.legacy.length} record katalog lama tetap tersimpan dan tidak diubah. Saat menambah layanan, Owner dapat memilih record lama untuk dipetakan ke tarif paket, tanpa menyalin harga secara otomatis.</p>}
  {settings.families.length===0&&<p className="member-note">Belum ada layanan paket. Pilih Tambah layanan dengan paket untuk membuat satu layanan utama dan mengisi tarif tiap paket.</p>
  <details><summary>+ Tambah layanan dengan paket</summary><FamilyForm family={{}} packages={settings.packages} legacy={settings.legacy}/></details>
  {settings.families.map(f=><details key={f.id}><summary>{f.name} · {f.category} · {f.unit} · {f.active?'Aktif':'Nonaktif'}</summary><FamilyForm family={f} packages={settings.packages}/></details>)}
  {!settings.enabled&&<RecoverableForm action={enablePackageWorkflow}><p>Aktifkan katalog paket hanya setelah durasi, harga, dan ketersediaan layanan disahkan Owner. Tindakan ini tidak mengubah flag transaksi maupun pembayaran Production.</p><PendingSubmit label="Gunakan katalog paket untuk nota baru"/></RecoverableForm>}
  {receipt&&<details><summary>Template WhatsApp & informasi outlet · versi {receipt.revision}</summary>
   <RecoverableForm action={saveReceiptSettings} className="admin-form service-editor"><input type="hidden" name="revision" value={receipt.revision}/>
   <p>Urutan rincian nota, pembayaran dan poin tetap menggunakan data database. Ubah teks resmi outlet di bawah ini.</p>
   {Object.entries(labels).map(([key,label])=><label key={key}>{label}<textarea name={key} rows={key==='terms'?7:3} maxLength={4000} defaultValue={receipt.config[key]??''}/></label>)}
   <PendingSubmit label="Simpan template"/></RecoverableForm></details>}
 </section>;
}
