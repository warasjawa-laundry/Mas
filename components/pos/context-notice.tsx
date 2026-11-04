export type DisplayContext={pilot_test_only:boolean;write_enabled:boolean;finance_enabled:boolean};
export function readDisplayContext(value:unknown):DisplayContext|null{
 if(!value||typeof value!=='object')return null;
 const v=value as DisplayContext;
 return ['pilot_test_only','write_enabled','finance_enabled'].every(k=>typeof v[k as keyof DisplayContext]==='boolean')?v:null;
}
export default function ContextNotice({context}:{context:DisplayContext|null}){
 return context?.pilot_test_only?<p className="binatu-inline-notice" role="note"><strong>Mode uji.</strong> Angka kas dan laporan dapat mencakup transaksi simulasi. Jangan gunakan sebagai bukti pembayaran pelanggan atau menerima dana sungguhan.</p>:
  !context?<p className="binatu-inline-notice" role="status">Mode transaksi belum dapat diperiksa. Muat ulang sebelum mencatat atau menafsirkan transaksi.</p>:null;
}
