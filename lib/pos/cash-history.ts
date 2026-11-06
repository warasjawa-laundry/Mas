export function cashEntryId(value:unknown):value is string{
 return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export function includeCashEntry<T extends {entries:{id?:string}[]}>(overview:T|null,requested:unknown,response:{data:unknown;error?:unknown}|null){
 if(requested===undefined)return {overview,notice:''};
 if(!cashEntryId(requested))return {overview,notice:'Referensi mutasi tidak valid.'};
 const entry=response?.data as T['entries'][number]|null;
 if(!overview||response?.error||!entry||entry.id!==requested)return {overview,notice:'Mutasi tidak ditemukan atau aksesnya tidak tersedia.'};
 return {overview:{...overview,entries:[entry,...overview.entries.filter(row=>row.id!==requested)].slice(0,81)} as T,notice:'Mutasi yang dipilih ditampilkan bersama riwayat terbaru.'};
}
