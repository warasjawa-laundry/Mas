-- Owner configures real durations and prices; no sample tariff is seeded.
alter table public.laundry_pos_outlets add column package_workflow_enabled boolean not null default false;
create table public.laundry_pos_duration_packages (
 code text primary key check(code in ('REGULAR','EXPRESS','FLASH')),
 name text not null check(length(name) between 2 and 80),
 duration_minutes integer check(duration_minutes between 1 and 525600),
 active boolean not null default false,
 position integer not null check(position between 0 and 9999),
 revision bigint not null default 1,
 check(not active or duration_minutes is not null)
);
insert into public.laundry_pos_duration_packages(code,name,position) values
 ('REGULAR','Reguler',0),('EXPRESS','Ekspres',1),('FLASH','Kilat',2);
create table public.laundry_pos_service_families (
 id uuid primary key, name text not null check(length(name) between 1 and 100),
 category text not null check(length(category) between 1 and 80),
 unit text not null check(unit in ('kg','pcs','meter')),
 position integer not null check(position between 0 and 9999),
 active boolean not null, revision bigint not null default 1
);
alter table public.laundry_services
 add column package_available boolean not null default false,
 add column family_id uuid references public.laundry_pos_service_families(id),
 add column duration_package_code text references public.laundry_pos_duration_packages(code),
 add constraint pos_service_package_pair check((family_id is null)=(duration_package_code is null)),
 add constraint pos_service_family_package_unique unique(family_id,duration_package_code);
create index pos_services_package_idx on public.laundry_services(duration_package_code);
alter table public.laundry_pos_duration_packages enable row level security;
alter table public.laundry_pos_service_families enable row level security;
revoke all on public.laundry_pos_duration_packages,public.laundry_pos_service_families from public,anon,authenticated;
create table laundry_private.pos_configuration_events (
 id bigint generated always as identity primary key,
 actor_id uuid not null references auth.users(id),
 kind text not null, target text not null, revision bigint not null,
 occurred_at timestamptz not null default clock_timestamp()
);
create index pos_configuration_actor_idx on laundry_private.pos_configuration_events(actor_id);
alter table laundry_private.pos_configuration_events enable row level security;
revoke all on laundry_private.pos_configuration_events from public,anon,authenticated;
create trigger pos_configuration_immutable before update or delete on laundry_private.pos_configuration_events
 for each row execute function laundry_private.pos_reject_journal_changes();

create function public.laundry_pos_catalog_settings() returns jsonb
language plpgsql security definer set search_path='' stable as $$
begin
 perform laundry_private.pos_owner_required();
 return jsonb_build_object('packages',(select jsonb_agg(to_jsonb(p) order by p.position) from public.laundry_pos_duration_packages p),
 'families',coalesce((select jsonb_agg(to_jsonb(f)||jsonb_build_object('tariffs',coalesce((select jsonb_agg(jsonb_build_object(
 'code',s.duration_package_code,'price_idr',s.price_idr,'active',s.package_available)) from public.laundry_services s where s.family_id=f.id),'[]'::jsonb))
 order by f.position,f.id) from public.laundry_pos_service_families f),'[]'::jsonb),
 'legacy',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'package_name',s.package_name,'price_idr',s.price_idr,'revision',s.revision)) from public.laundry_services s where s.family_id is null),'[]'::jsonb),
 'enabled',(select package_workflow_enabled from public.laundry_pos_outlets where singleton_key=1));
end; $$;
revoke all on function public.laundry_pos_catalog_settings() from public,anon,authenticated;
grant execute on function public.laundry_pos_catalog_settings() to authenticated;

create function public.laundry_pos_save_package(p_code text,p_revision bigint,p_name text,p_minutes integer,p_active boolean)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 actor:=laundry_private.pos_owner_required();
 perform 1 from public.laundry_pos_outlets where singleton_key=1 for update;
 perform 1 from public.laundry_catalog_version where singleton for update;
 if p_name is null or length(btrim(p_name)) not between 2 and 80 or p_name ~ '[[:cntrl:]]'
 or p_minutes is null or p_minutes not between 1 and 525600 or p_active is null then raise exception 'catalog_invalid';end if;
 update public.laundry_pos_duration_packages set name=btrim(p_name),duration_minutes=p_minutes,active=p_active,revision=revision+1
 where code=p_code and revision=p_revision;
 if not found then raise exception 'catalog_conflict';end if;
 update public.laundry_services s set package_name=p.name,duration=p.duration_minutes||' menit',duration_minutes=p.duration_minutes,
 is_visible=s.package_available and p.active and (select f.active from public.laundry_pos_service_families f where f.id=s.family_id),
 revision=s.revision+1,updated_by=actor,updated_at=clock_timestamp()
 from public.laundry_pos_duration_packages p where p.code=p_code and s.duration_package_code=p.code;
 insert into laundry_private.pos_configuration_events(actor_id,kind,target,revision) values(actor,'PACKAGE',p_code,p_revision+1);
end; $$;
revoke all on function public.laundry_pos_save_package(text,bigint,text,integer,boolean) from public,anon,authenticated;
grant execute on function public.laundry_pos_save_package(text,bigint,text,integer,boolean) to authenticated;

create function public.laundry_pos_save_family(p_id uuid,p_revision bigint,p_input jsonb,p_tariffs jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid; v_revision bigint; t jsonb; p record; v_active boolean;
begin
 actor:=laundry_private.pos_owner_required();
 perform 1 from public.laundry_pos_outlets where singleton_key=1 for update;
 perform 1 from public.laundry_catalog_version where singleton for update;
 if p_id is null or p_input is null or jsonb_typeof(p_input)<>'object'
 or coalesce(length(btrim(p_input->>'name')),0) not between 1 and 100
 or coalesce(length(btrim(p_input->>'category')),0) not between 1 and 80
 or p_input->>'unit' not in ('kg','pcs','meter') or p_input->>'unit' is null
 or coalesce(p_input->>'position','') !~ '^[0-9]{1,4}$'
 or jsonb_typeof(p_input->'active') is distinct from 'boolean'
 or (p_input->>'name') ~ '[[:cntrl:]]' or (p_input->>'category') ~ '[[:cntrl:]]'
 or jsonb_typeof(p_tariffs) is distinct from 'array' or jsonb_array_length(p_tariffs)<>3
 then raise exception 'catalog_invalid';end if;
 if (select count(distinct x->>'code') from jsonb_array_elements(p_tariffs) x)<>3 then raise exception 'catalog_invalid';end if;
 select revision into v_revision from public.laundry_pos_service_families where id=p_id;
 if found then
  if v_revision<>p_revision then raise exception 'catalog_conflict';end if;
  update public.laundry_pos_service_families set name=btrim(p_input->>'name'),category=btrim(p_input->>'category'),unit=p_input->>'unit',
  position=(p_input->>'position')::integer,active=(p_input->>'active')::boolean,revision=revision+1 where id=p_id;
 else
  if p_revision<>0 then raise exception 'catalog_conflict';end if;
  if (select count(*) from public.laundry_services)+(select count(*) from jsonb_array_elements(p_tariffs) x where nullif(x->>'existing_id','') is null)>200 then raise exception 'catalog_limit';end if;
  insert into public.laundry_pos_service_families(id,name,category,unit,position,active)
  values(p_id,btrim(p_input->>'name'),btrim(p_input->>'category'),p_input->>'unit',(p_input->>'position')::integer,(p_input->>'active')::boolean);
 end if;
 for t in select value from jsonb_array_elements(p_tariffs) loop
  select * into p from public.laundry_pos_duration_packages where code=t->>'code';
  if not found or jsonb_typeof(t->'active') is distinct from 'boolean'
   or coalesce(t->>'price_idr','') !~ '^(0|[1-9][0-9]{0,9})$' or (t->>'price_idr')::bigint>1000000000
  then raise exception 'catalog_invalid';end if;
  v_active:=(t->>'active')::boolean and (p_input->>'active')::boolean and p.active;
  if nullif(t->>'existing_id','') is not null then
   update public.laundry_services set family_id=p_id,duration_package_code=p.code,name=btrim(p_input->>'name'),category=btrim(p_input->>'category'),unit=p_input->>'unit',
    position=(p_input->>'position')::integer,package_name=p.name,duration=coalesce(p.duration_minutes||' menit','Belum diatur'),duration_minutes=p.duration_minutes
    where id=(t->>'existing_id')::uuid and (family_id is null or (family_id=p_id and duration_package_code=p.code)) and revision=(t->>'existing_revision')::bigint;
   if not found then raise exception 'catalog_conflict';end if;
  end if;
  insert into public.laundry_services(id,family_id,duration_package_code,name,category,unit,position,is_visible,package_available,package_name,duration,duration_minutes,price_idr,updated_by)
  values(gen_random_uuid(),p_id,p.code,btrim(p_input->>'name'),btrim(p_input->>'category'),p_input->>'unit',(p_input->>'position')::integer,
   v_active,(t->>'active')::boolean,p.name,coalesce(p.duration_minutes||' menit','Belum diatur'),p.duration_minutes,(t->>'price_idr')::bigint,actor)
  on conflict(family_id,duration_package_code) do update set name=excluded.name,category=excluded.category,unit=excluded.unit,
   position=excluded.position,is_visible=excluded.is_visible,package_available=excluded.package_available,package_name=excluded.package_name,duration=excluded.duration,
   duration_minutes=excluded.duration_minutes,price_idr=excluded.price_idr,revision=laundry_services.revision+1,updated_by=actor,updated_at=clock_timestamp();
 end loop;
 insert into laundry_private.pos_configuration_events(actor_id,kind,target,revision) values(actor,'FAMILY',p_id::text,p_revision+1);
end; $$;
revoke all on function public.laundry_pos_save_family(uuid,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.laundry_pos_save_family(uuid,bigint,jsonb,jsonb) to authenticated;

create function public.laundry_pos_enable_package_workflow() returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 actor:=laundry_private.pos_owner_required();
 perform 1 from public.laundry_pos_outlets where singleton_key=1 for update;
 if not exists(select 1 from public.laundry_services s join public.laundry_pos_duration_packages p on p.code=s.duration_package_code
 join public.laundry_pos_service_families f on f.id=s.family_id where s.is_visible and p.active and f.active)
 then raise exception 'catalog_package_not_configured';end if;
 update public.laundry_pos_outlets set package_workflow_enabled=true where singleton_key=1;
 insert into laundry_private.pos_configuration_events(actor_id,kind,target,revision) values(actor,'PACKAGE_WORKFLOW','ENABLED',1);
end; $$;
revoke all on function public.laundry_pos_enable_package_workflow() from public,anon,authenticated;
grant execute on function public.laundry_pos_enable_package_workflow() to authenticated;

create function public.laundry_pos_package_catalog(p_device_token text default null,p_login_token text default null)
returns jsonb language plpgsql security definer set search_path='' stable as $$
begin
 if p_device_token is null and p_login_token is null then perform laundry_private.pos_owner_required();
 else perform 1 from laundry_private.pos_g4_cashier_authorize(p_device_token,p_login_token,'order_view',false);end if;
 return jsonb_build_object('enabled',(select package_workflow_enabled from public.laundry_pos_outlets where singleton_key=1),
 'services',coalesce((select jsonb_agg(to_jsonb(s) - 'updated_by' - 'updated_at' order by s.position,s.id)
 from public.laundry_services s join public.laundry_pos_duration_packages p on p.code=s.duration_package_code
 join public.laundry_pos_service_families f on f.id=s.family_id where s.is_visible and p.active and f.active),'[]'::jsonb));
end; $$;
revoke all on function public.laundry_pos_package_catalog(text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_package_catalog(text,text) to anon,authenticated;

-- Group metadata and duration are owned by the family/package RPCs. The legacy
-- editor cannot silently diverge a variant from its parent.
create function laundry_private.pos_guard_grouped_service() returns trigger
language plpgsql set search_path='' as $$
declare f record; p record;
begin
 if new.family_id is null then return new;end if;
 select * into strict f from public.laundry_pos_service_families where id=new.family_id;
 select * into strict p from public.laundry_pos_duration_packages where code=new.duration_package_code;
 if new.name<>f.name or new.category<>f.category or new.unit<>f.unit or new.position<>f.position
 or new.package_name<>p.name or new.duration_minutes is distinct from p.duration_minutes
 or new.duration<>coalesce(p.duration_minutes||' menit','Belum diatur') then raise exception 'catalog_use_family_editor';end if;
 return new;
end; $$;
revoke all on function laundry_private.pos_guard_grouped_service() from public,anon,authenticated;
create trigger pos_guard_grouped_service before insert or update on public.laundry_services
 for each row execute function laundry_private.pos_guard_grouped_service();
