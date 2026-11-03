export function durationMinutes(label:string):number|null{
 const parts=/^([1-9][0-9]{0,5}) (menit|jam|hari)$/.exec(label.trim().toLowerCase());
 if(!parts)return null;
 const minutes=Number(parts[1])*({menit:1,jam:60,hari:1440}[parts[2]]??0);
 return minutes>=1&&minutes<=525600?minutes:null;
}

/** Present an authoritative calendar duration in hours without changing stored minutes. */
export function formatDurationHours(label:string):string{
 const minutes=durationMinutes(label);
 if(minutes===null)return 'Durasi belum diatur';
 const hours=minutes/60;
 const rounded=Math.round(hours*100)/100;
 const approximate=Math.abs(rounded*60-minutes)>0.000001;
 return `${approximate?'≈':''}${new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}).format(hours)} jam`;
}

export function estimateCompletion(start:string|null,minutes:number|null|undefined):string|null{
 if(!start||!/(Z|[+-]\d{2}:\d{2})$/i.test(start)||typeof minutes!=="number"||!Number.isInteger(minutes)||minutes<1||minutes>525600)return null;
 const timestamp=Date.parse(start);
 return Number.isFinite(timestamp)?new Date(timestamp+minutes*60000).toISOString():null;
}

export function formatEta(timestamp:string|null):string{
 if(!timestamp||!Number.isFinite(Date.parse(timestamp)))return 'Belum dapat dihitung';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(timestamp)).map(p=>[p.type,p.value]));
 return `${parts.day}/${parts.month}/${parts.year} - ${parts.hour}:${parts.minute} WIB`;
}
