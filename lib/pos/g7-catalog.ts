/** G7 catalog UX: duration is a filter over actual priced services, not a surcharge. */
export const ALL_DURATIONS="__ALL__";
export type DurationService={duration:string};
export type DurationOption={value:string;label:string;count:number};
export function durationOptions<T extends DurationService>(services:readonly T[]):DurationOption[]{
 const groups=new Map<string,number>();
 for(const service of services){
  const label=service.duration.trim();
  groups.set(label,(groups.get(label)??0)+1);
 }
 const choices=[...groups.entries()].sort((a,b)=>{
  if(a[0]==="")return 1;if(b[0]==="")return -1;
  return a[0].localeCompare(b[0],"id-ID");
 }).map(([value,count])=>({value,label:value||"Durasi belum tercantum",count}));
 return [{value:ALL_DURATIONS,label:"Semua durasi layanan",count:services.length},...choices];
}
export function servicesForDuration<T extends DurationService>(
 services:readonly T[],selected:string):T[]{
 if(selected===ALL_DURATIONS)return [...services];
 return services.filter(s=>s.duration.trim()===selected);
}