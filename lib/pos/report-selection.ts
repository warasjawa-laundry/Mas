import {resolveReportPeriod,reportPeriodBounds,type ReportGranularity,type ReportPeriodPreset} from './report-v32';
export type ReportSearchParams={start?:string;end?:string;period?:string;granularity?:string};
const presets=['today','yesterday','this_week','last_week','this_month','last_month','custom'];
export function readReportSelection(params:ReportSearchParams,now?:Date|string){
 const legacy=!params.period&&(params.start!==undefined||params.end!==undefined);
 const preset=(params.period||(legacy?'custom':'today')) as ReportPeriodPreset;
 const granularity=(params.granularity||'day') as ReportGranularity;
 let startDate=params.start||'',endDate=params.end||'';
 let bounds:ReturnType<typeof reportPeriodBounds>|null=null;
 try{
  if(!presets.includes(preset)||!['day','week','month'].includes(granularity))throw Error('Invalid selection');
  if(preset!=='custom')({startDate,endDate}=resolveReportPeriod(preset,now));
  if(legacy){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(endDate))throw Error('Invalid legacy end');
   const exclusive=new Date(endDate+'T00:00:00Z');
   if(exclusive.toISOString().slice(0,10)!==endDate)throw Error('Invalid legacy end');
   endDate=new Date(exclusive.getTime()-86400_000).toISOString().slice(0,10);
  }
  bounds=reportPeriodBounds(startDate,endDate);
 }catch{}
 return {preset,startDate,endDate,granularity,bounds};
}
