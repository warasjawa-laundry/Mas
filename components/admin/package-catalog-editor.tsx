import {randomUUID} from "node:crypto";
import RecoverableForm from "./recoverable-form";
import LegacyServiceSelector from "./legacy-service-selector";
import PendingSubmit from "./pending-submit";
import {savePackage,saveFamily,enablePackageWorkflow,saveReceiptSettings} from "@/app/admin/settings/services/package-actions";

type Package={code:string;name:string;duration_minutes:number|null;active:boolean;revision:number};
type Legacy={id:string;name:string;package_name:string;price_idr:number;revision:number};
type Family={id:string;name:string;category:string;unit:string;position:number;active:boolean;revision:number;tariffs:{code:string;price_idr:number;active:boolean}[]};
export type PackageSettings={packages:Package[];families:Family[];legacy:Legacy[];enabled:boolean};

const money=(value:number)=>"Rp"+new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(value);
function packageDuration(minutes:number|null):string{
 if(minutes===null)return "Belum diatur";
 return minutes%60===0?`${minutes/60} jam`:`${minutes} menit`;
}
function FamilyForm({family,packages,legacy=[]}:{family:Partial<Family>;packages:Package[];legacy?:Legacy[]}){
 const id=family.id??randomUUID();
 return <RecoverableForm action={saveFamily} className="service-editor admin-form mj-catalog-form">
  <input type="hidden" name="id" value={id}/><input type="hidden" name="revision" value={family.revision??0}/>
  <div className="mj-catalog-form-grid">
   <label>Nama layanan<input name="name" required maxLength={100} defaultValue={family.name}/></label>
   <label>Kategori<input name="category" required maxLength={80} defaultValue={family.category}/></label>
   <label>Satuan<select name="unit" defaultValue={family.unit??'kg'}><option value="kg">kg</option><option value="pcs">pcs</option><option value="meter">meter</option></select></label>
   <label>Urutan tampilan<input name="position" type="number" min={0} max={9999} required defaultValue={family.position??100}/></label>
  </div>
  <label className="mj-catalog-switch"><input type="checkbox" name="active" value="yes" defaultChecked={family.active??true}/> Layanan aktif</label>
  <h4 className="mj-catalog-form-heading">Harga dan ketersediaan paket</h4>
  <div className="mj-catalog-tariff-edit">
  {packages.map(p=>{const tariff=family.tariffs?.find(t=>t.code===p.code);return <fieldset key={p.code}>
   <legend>{p.name} <span>· {packageDuration(p.duration_minutes)}</span></legend>
   <label className="mj-catalog-switch"><input type="checkbox" name={'active-'+p.code} value="yes" defaultChecked={tariff?.active??false}/> Tersedia untuk paket ini</label>
   {!family.id&&<LegacyServiceSelector code={p.code} services={legacy}/>}
   <label>Harga {p.name} (Rp)<input type="number" inputMode="numeric" min={0} max={1000000000} step={1} name={'price-'+p.code} defaultValue={tariff?.price_idr} placeholder="Masukkan tarif"/></label>
  </fieldset>})}
  </div>
  <div className="mj-catalog-form-actions"><PendingSubmit label="Simpan layanan & tarif"/></div>
 </RecoverableForm>;
}
export default function PackageCatalogEditor({settings,receipt}:{settings:PackageSettings;receipt:{revision:number;config:Record<string,string>}|null}){
 const labels:Record<string,string>={outlet_name:'Nama outlet',address:'Alamat outlet',contact:'Kontak outlet',new_title:'Judul Nota Baru',ready_title:'Judul Siap Diambil',collected_title:'Judul Sudah Diambil',terms:'Ketentuan komplain',payment_notice:'Pemberitahuan pembayaran',bank:'Rekening bank',ewallet:'E-wallet',cs:'Kontak CS'};
 const activeFamilies=settings.families.filter(f=>f.active).length;
 const activeTariffs=settings.families.reduce((count,f)=>count+(f.active?f.tariffs.filter(t=>t.active&&settings.packages.some(p=>p.code===t.code&&p.active)).length:0),0);
 const activePackages=settings.packages.filter(p=>p.active).length;
 return <section className="mj-catalog">
  <div className="mj-catalog-section-head"><div><h2>Pengaturan Paket</h2><p>Durasi berlaku untuk seluruh layanan pada paket yang sama.</p></div></div>
  <div className="mj-catalog-packages">
   {settings.packages.map(p=><details className="mj-catalog-card mj-package-card" key={p.code}>
    <summary aria-label={`Ubah paket ${p.name}, ${packageDuration(p.duration_minutes)}`}>
     <span className="mj-package-detail"><strong>{p.name}</strong><span className="mj-package-duration">{packageDuration(p.duration_minutes)}</span><small>Jam kalender</small></span>
     <span className="mj-package-controls"><span className={`mj-catalog-status ${p.active?'is-active':'is-inactive'}`}>{p.active?'Aktif':'Nonaktif'}</span><span className="mj-catalog-edit" aria-hidden="true">Ubah <span className="mj-editor-closed">Buka</span><span className="mj-editor-open">Tutup</span></span></span>
    </summary>
    <div className="mj-catalog-edit-panel">
     <RecoverableForm action={savePackage} className="admin-form mj-catalog-form">
      <input type="hidden" name="code" value={p.code}/><input type="hidden" name="revision" value={p.revision}/>
      <label>Nama paket<input name="name" required maxLength={80} defaultValue={p.name}/></label>
      <label>Durasi (menit kalender)<input name="minutes" type="number" min={1} max={525600} required defaultValue={p.duration_minutes??''}/></label>
      <label className="mj-catalog-switch"><input type="checkbox" name="active" value="yes" defaultChecked={p.active}/> Paket aktif</label>
      <div className="mj-catalog-form-actions"><PendingSubmit label="Simpan paket"/></div>
     </RecoverableForm>
    </div>
   </details>)}
  </div>
  <div className="mj-catalog-section-head mj-catalog-service-heading">
   <div><h2>Layanan &amp; Harga per Paket</h2><p>Harga tiap paket langsung terlihat. Pilih <strong>Ubah</strong> untuk mengedit layanan.</p></div>
   <span className="mj-catalog-count">{settings.families.length} layanan</span>
  </div>
  {settings.legacy.length>0&&<p className="mj-catalog-legacy-note">{settings.legacy.length} layanan lama tetap tersimpan untuk riwayat. Harga lama tidak dipakai sebagai harga paket baru. Saat membuat layanan, Owner dapat memilih pemetaan data lama.</p>}
  <details className="mj-catalog-card mj-catalog-create">
   <summary><span className="mj-catalog-add-icon" aria-hidden="true">+</span><span>Tambah layanan baru <small>Atur harga untuk Reguler, Ekspres, dan Kilat</small></span><span className="mj-catalog-edit" aria-hidden="true">Tambah</span></summary>
   <div className="mj-catalog-edit-panel"><FamilyForm family={{}} packages={settings.packages} legacy={settings.legacy}/></div>
  </details>
  {settings.families.length===0?<p className="mj-catalog-empty">Belum ada layanan paket. Tambahkan layanan terlebih dahulu sebelum mengaktifkan katalog untuk nota baru.</p>:null}
  <div className="mj-catalog-services">
  {settings.families.map(f=><details className="mj-catalog-card mj-service-card" key={f.id}>
   <summary aria-label={`Ubah layanan ${f.name}`}>
    <span className="mj-service-head"><span><strong>{f.name}</strong><small>{f.category} · {f.unit}</small></span><span className={`mj-catalog-status ${f.active?'is-active':'is-inactive'}`}>{f.active?'Aktif':'Nonaktif'}</span></span>
    <span className="mj-service-price-list">
     {settings.packages.map(p=>{const tariff=f.tariffs.find(t=>t.code===p.code);const available=f.active&&p.active&&tariff?.active;return <span key={p.code}><span>{p.name}</span><strong className={available?'':'mj-price-unavailable'}>{available&&tariff?money(tariff.price_idr):'Tidak tersedia'}</strong></span>})}
    </span>
    <span className="mj-catalog-edit mj-service-edit" aria-hidden="true">Ubah layanan <span className="mj-editor-closed">Buka</span><span className="mj-editor-open">Tutup</span></span>
   </summary>
   <div className="mj-catalog-edit-panel"><FamilyForm family={f} packages={settings.packages}/></div>
  </details>)}
  </div>
  {!settings.enabled?<section className="mj-catalog-activation">
   <h3>Gunakan katalog untuk nota baru</h3>
   <p>Periksa kembali durasi, paket yang tersedia, dan seluruh tarif sebelum mengaktifkan.</p>
   <dl><div><dt>Paket aktif</dt><dd>{activePackages}</dd></div><div><dt>Layanan aktif</dt><dd>{activeFamilies}</dd></div><div><dt>Variasi tarif tersedia</dt><dd>{activeTariffs}</dd></div></dl>
   <RecoverableForm action={enablePackageWorkflow}><PendingSubmit label="Gunakan katalog paket untuk nota baru"/></RecoverableForm>
  </section>:<p className="mj-catalog-live-note">Katalog paket digunakan untuk nota baru. Perubahan tarif berikutnya tidak mengubah nota lama.</p>}
  {receipt&&<details className="mj-catalog-card mj-catalog-receipt">
   <summary><span><strong>Template WhatsApp & informasi outlet</strong><small>Versi {receipt.revision} · Nota dan pesan pelanggan</small></span><span className="mj-catalog-edit" aria-hidden="true">Ubah</span></summary>
   <div className="mj-catalog-edit-panel"><RecoverableForm action={saveReceiptSettings} className="admin-form mj-catalog-form">
    <input type="hidden" name="revision" value={receipt.revision}/>
    <p>Rincian nota, pembayaran, dan poin tetap diambil dari database. Sesuaikan teks outlet saja.</p>
    {Object.entries(labels).map(([key,label])=><label key={key}>{label}<textarea name={key} rows={key==='terms'?7:3} maxLength={4000} defaultValue={receipt.config[key]??''}/></label>)}
    <div className="mj-catalog-form-actions"><PendingSubmit label="Simpan template"/></div>
   </RecoverableForm></div>
  </details>}
 </section>;
}
