export type OrderEvent={kind:string;at:string;actor:string;reason:string|null;from:string|null;to:string|null};
const statuses:Record<string,string>={QUEUED:'Antrian',PROCESSING:'Diproses',READY:'Siap Diambil',COLLECTED:'Sudah Diambil'};
export default function OrderTimeline({events}:{events:OrderEvent[]}){
 return <><h2>Histori pesanan</h2>{events.length?<ol>{events.map((event,i)=><li key={event.at+'-'+i}>
  <strong>{event.kind==='ORDER_CREATED'?'Nota dibuat':event.kind==='ORDER_CANCELLED'?'Nota dibatalkan':statuses[event.to??'']??'Perubahan status'}</strong>
  <p>{new Date(event.at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB · {event.actor}</p>
  {event.reason&&<p>Alasan: {event.reason}</p>}
 </li>)}</ol>:<p>Histori operasional belum tersedia pada skema aktif.</p>}</>;
}
