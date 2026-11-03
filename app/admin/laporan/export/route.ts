import {getVerifiedOwner} from "@/lib/supabase/owner";
import { reportingPeriod,isReport } from "@/lib/pos/g6-cash";
import { escapeCsv } from "@/lib/pos/g6-import";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const owner=await getVerifiedOwner();if(!owner)return new Response("Tidak berhak",{status:403});
 const url=new URL(request.url);
 const start=url.searchParams.get('start')||'',end=url.searchParams.get('end')||'';
 const p=reportingPeriod(start,end);if(!p)return new Response("Tanggal tidak valid",{status:400});
 const {data,error}=await owner.supabase.rpc('laundry_pos_owner_report',p);
 if(error||!isReport(data))return new Response("Laporan tidak tersedia",{status:503});
 if(data.truncated)return new Response("Persempit tanggal agar tidak ada data terpotong",{status:422});
 const exportedAt=new Date().toISOString();
 const headers=['record_type','schema_version','date_start','date_end_exclusive','exported_at_utc','time_zone','outlet',
  'orders_created','cash_in_idr','cash_out_idr','noncash_in_idr','noncash_out_idr',
  'receivables_as_of_end_idr','net_pos_points','row_count',
  'category','direction','method','invoice','amount_idr','note','occurred_at'];
 const summary=['SUMMARY',1,start,end,exportedAt,'Asia/Jakarta','MJL',
  data.orders_created,data.cash_in_idr,data.cash_out_idr,data.noncash_in_idr,
  data.noncash_out_idr,data.receivables_as_of_end_idr,data.net_pos_points,data.rows.length,
  '','','','','','',''];
 const lines=[headers.map(escapeCsv).join(','),summary.map(escapeCsv).join(','),...data.rows.map(x=>
  ['ENTRY',1,start,end,exportedAt,'Asia/Jakarta','MJL','','','','','','','',data.rows.length,
   x.category,x.type,x.method,x.invoice_no,x.amount_idr,x.note,x.occurred_at]
    .map(escapeCsv).join(','))];
 const csv='\uFEFF'+lines.join('\r\n')+'\r\n';
 return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8',
  'Content-Disposition':`attachment; filename="masjawa-mutasi-${start}-${end}.csv"`,
  'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}