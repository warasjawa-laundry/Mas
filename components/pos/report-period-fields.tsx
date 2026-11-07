'use client';
import {useState} from 'react';
import {resolveReportPeriod,type ReportGranularity,type ReportPeriodPreset} from '@/lib/pos/report-v32';
import styles from '@/app/kasir/pesanan/orders.module.css';
const presets:{value:ReportPeriodPreset;label:string}[]=[
 {value:'today',label:'Hari Ini'},{value:'yesterday',label:'Kemarin'},
 {value:'this_week',label:'Minggu Ini'},{value:'last_week',label:'Minggu Lalu'},
 {value:'this_month',label:'Bulan Ini'},{value:'last_month',label:'Bulan Lalu'},
 {value:'custom',label:'Kustom'}
];
export default function ReportPeriodFields({preset,startDate,endDate,granularity}:{preset:ReportPeriodPreset;startDate:string;endDate:string;granularity:ReportGranularity}){
 const [period,setPeriod]=useState(preset),[start,setStart]=useState(startDate),[end,setEnd]=useState(endDate);
 function choose(value:ReportPeriodPreset){
  setPeriod(value);
  if(value!=='custom'){const range=resolveReportPeriod(value);setStart(range.startDate);setEnd(range.endDate);}
 }
 return <>
  <p className={styles.muted}>Periode memakai WIB. Tanggal akhir termasuk dalam laporan. Maksimal 93 hari.</p>
  <label>Jenis periode<select name="period" value={period} onChange={event=>choose(event.target.value as ReportPeriodPreset)}>{presets.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
  <label>Granularitas rekap<select name="granularity" defaultValue={granularity}><option value="day">Per Hari</option><option value="week">Per Minggu</option><option value="month">Per Bulan</option></select></label>
  <label>Tanggal mulai<input type="date" name="start" value={start} onChange={event=>{setStart(event.target.value);setPeriod('custom');}} required/></label>
  <label>Tanggal akhir (termasuk)<input type="date" name="end" value={end} onChange={event=>{setEnd(event.target.value);setPeriod('custom');}} required/></label>
  <p className={styles.muted} role="status">Rentang dipilih: {start||'belum dipilih'} sampai {end||'belum dipilih'} WIB (termasuk).</p>
 </>;
}
