// Run only after reviewing the source workbook and explicitly confirming targets.
// Input/output contain private contact data: keep them outside the repository.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

export function buildCustomerImport(rows,sourceHash,{dryRun=true}={}) {
 if(!/^[a-f0-9]{64}$/.test(sourceHash)||!Array.isArray(rows)||!rows.length||rows.length>5000)throw Error('Invalid import');
 const seen=new Set();
 const payload=rows.map(r=>{
  if(!Number.isInteger(r.row)||r.row<2||seen.has(r.row))throw Error('Invalid source row');seen.add(r.row);
  if(typeof r.name!=='string'||r.name.trim()!==r.name||r.name.length<2||r.name.length>100||/[\x00-\x1f\x7f]/.test(r.name))throw Error('Invalid name');
  if(typeof r.raw_phone!=='string'||r.raw_phone.length>100||typeof r.valid_phone!=='boolean')throw Error('Invalid phone source');
  if(r.valid_phone&&!/^\+[1-9][0-9]{7,14}$/.test(r.phone??''))throw Error('Invalid normalized phone');
  if(r.address!==null&&(typeof r.address!=='string'||!r.address.trim()||r.address.length>1000||r.address.includes('\0')))throw Error('Invalid address');
  const b=createHash('sha256').update(`${sourceHash}:${r.row}`).digest().subarray(0,16);b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;
  const h=b.toString('hex');const request_id=`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  return {row:r.row,name:r.name,phone:r.valid_phone?r.phone:null,raw_phone:r.raw_phone,address:r.address,phone_needs_review:!r.valid_phone,request_id};
 });
 const json=JSON.stringify(payload).replaceAll("'","''");
 return `begin;
set local lock_timeout='10s';
lock table public.laundry_members in share row exclusive mode;
lock table public.laundry_member_import_rows in share row exclusive mode;
do $import$
declare source_hash text:='${sourceHash}'; source jsonb:='${json}'::jsonb;
 actor uuid; item jsonb; member uuid; matched integer; linked boolean; old_source record;
begin
 if (select count(*) from public.laundry_owner_accounts where is_active)<>1 then raise exception 'Ambiguous owner';end if;
 select auth_user_id into strict actor from public.laundry_owner_accounts where is_active;
 for item in select value from jsonb_array_elements(source) loop
  select * into old_source from public.laundry_member_import_rows where source_sha256=source_hash and source_row=(item->>'row')::integer;
  if found then
   if old_source.source_phone is distinct from item->>'raw_phone' then raise exception 'Import source changed';end if;
   continue;
  end if;
  member:=null; linked:=false;
  if item->>'phone' is not null then
   select count(*) into matched from public.laundry_members
    where lower(regexp_replace(btrim(display_name),'[[:space:]]+',' ','g'))=lower(item->>'name') and whatsapp_e164=item->>'phone';
   if matched>1 then raise exception 'Ambiguous existing customer on source row %',item->>'row';end if;
   if matched=1 then
    select id into strict member from public.laundry_members
     where lower(regexp_replace(btrim(display_name),'[[:space:]]+',' ','g'))=lower(item->>'name') and whatsapp_e164=item->>'phone';
    linked:=true;
   end if;
  end if;
  if member is null then
   insert into public.laundry_members(display_name,whatsapp_e164,address,created_by,registration_request_id)
   values(item->>'name',item->>'phone',item->>'address',actor,(item->>'request_id')::uuid) returning id into member;
  else
   -- Fill only an absent address; preserve all existing identity/consent/card data.
   update public.laundry_members set address=item->>'address'
    where id=member and address is null and item->>'address' is not null;
  end if;
  insert into public.laundry_member_import_rows(source_sha256,source_row,member_id,source_phone,phone_needs_review,linked_existing,imported_by)
  values(source_hash,(item->>'row')::integer,member,item->>'raw_phone',(item->>'phone_needs_review')::boolean,linked,actor);
  insert into public.laundry_audit_events(actor_id,entity_type,entity_id,action,context)
  values(actor,'member',member,case when linked then 'IMPORT_LINKED' else 'MEMBER_IMPORTED' end,jsonb_build_object('source_sha256',source_hash,'source_row',(item->>'row')::integer));
 end loop;
 if (select count(*) from public.laundry_member_import_rows where source_sha256=source_hash)<>${payload.length}
 then raise exception 'Incomplete import';end if;
end;
$import$;
select count(*) as source_rows,count(distinct member_id) as distinct_members,
 count(*) filter(where linked_existing) as linked_existing,
 count(*) filter(where not linked_existing) as created_members,
 count(*) filter(where phone_needs_review) as phones_to_review
from public.laundry_member_import_rows where source_sha256='${sourceHash}';
${dryRun?'rollback':'commit'};
`;
}

if(process.argv[1]?.endsWith('/customer-import-sql.mjs')&&process.argv.length>2){
 const [input,workbook,output,mode]=process.argv.slice(2);
 if(!input||!workbook||!output||!['dry-run','commit'].includes(mode))throw Error('Usage: customer-import-sql.mjs prepared.json workbook.xlsx output.sql dry-run|commit');
 const hash=createHash('sha256').update(readFileSync(workbook)).digest('hex');
 writeFileSync(output,buildCustomerImport(JSON.parse(readFileSync(input,'utf8')),hash,{dryRun:mode!=='commit'}),{mode:0o600});
 console.log(JSON.stringify({sourceHash:hash,rows:JSON.parse(readFileSync(input,'utf8')).length,mode}));
}
