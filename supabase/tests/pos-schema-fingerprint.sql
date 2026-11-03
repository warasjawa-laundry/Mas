-- Metadata only, no customer rows or secrets. Compare replayed source with QA.
select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'identity',identity,'hash',md5(definition)) order by kind,identity),'[]'::jsonb)
from (
 select 'column' kind,n.nspname||'.'||c.relname||'.'||a.attname identity,
  concat_ws('|',a.attnum,pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull,
    pg_catalog.pg_get_expr(d.adbin,d.adrelid)) definition
 from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
 where n.nspname in ('public','laundry_private') and c.relkind='r'
  and (c.relname like 'laundry_%' or n.nspname='laundry_private') and a.attnum>0 and not a.attisdropped
 union all
 select 'constraint',n.nspname||'.'||c.relname||'.'||k.conname,pg_catalog.pg_get_constraintdef(k.oid)
 from pg_catalog.pg_constraint k join pg_catalog.pg_class c on c.oid=k.conrelid
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','laundry_private') and (c.relname like 'laundry_%' or n.nspname='laundry_private')
 union all
 select 'function',n.nspname||'.'||p.proname||'('||pg_catalog.pg_get_function_identity_arguments(p.oid)||')',
  concat_ws('|',regexp_replace(pg_catalog.pg_get_functiondef(p.oid),'\s+',' ','g'),p.prosecdef,p.provolatile,
    p.proconfig::text,p.proacl::text)
 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='public' and p.proname like 'laundry_%') or n.nspname='laundry_private'
 union all
 select 'table',n.nspname||'.'||c.relname,concat_ws('|',c.relrowsecurity,c.relforcerowsecurity,c.relacl::text)
 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','laundry_private') and c.relkind='r'
  and (c.relname like 'laundry_%' or n.nspname='laundry_private')
) objects;
