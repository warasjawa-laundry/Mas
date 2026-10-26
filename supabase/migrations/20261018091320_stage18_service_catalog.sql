-- Public price catalogue. No membership, contact or transaction data is published.
create table public.laundry_services (
 id uuid primary key,
 category text not null check(length(category) between 1 and 80 and category=btrim(category)),
 package_name text not null default '' check(length(package_name)<=80),
 name text not null check(length(name) between 1 and 100 and name=btrim(name)),
 price_idr bigint not null check(price_idr between 0 and 1000000000),
 unit text not null check(length(unit) between 1 and 24 and unit=btrim(unit)),
 duration text not null default '' check(length(duration)<=80),
 position integer not null default 100 check(position between 0 and 9999),
 is_visible boolean not null default true,
 revision bigint not null default 1 check(revision>0),
 updated_at timestamptz not null default now(),
 updated_by uuid references public.laundry_owner_accounts(auth_user_id)
);
create index laundry_services_actor_idx on public.laundry_services(updated_by);
alter table public.laundry_services enable row level security;
revoke all on public.laundry_services from public,anon,authenticated;
grant select(id,category,package_name,name,price_idr,unit,duration,position,is_visible) on public.laundry_services to anon;
grant select on public.laundry_services to authenticated;
create policy services_public_read on public.laundry_services for select to anon using(is_visible);
create policy services_owner_read on public.laundry_services for select to authenticated using(exists(select 1 from public.laundry_owner_accounts o where o.auth_user_id=(select auth.uid()) and o.is_active));
create table public.laundry_catalog_version(singleton boolean primary key default true check(singleton),revision bigint not null default 1);
insert into public.laundry_catalog_version values(true,1);
alter table public.laundry_catalog_version enable row level security;
revoke all on public.laundry_catalog_version from public,anon,authenticated;
grant select on public.laundry_catalog_version to anon,authenticated;
create policy catalog_version_read on public.laundry_catalog_version for select to anon,authenticated using(true);

insert into public.laundry_services(id,category,package_name,name,price_idr,unit,duration,position) values
 ('00000000-0000-4000-8000-000000000001','Laundry kiloan','Reguler','Cuci lipat',3000,'kg','1–3 hari',10),
 ('00000000-0000-4000-8000-000000000002','Laundry kiloan','Reguler','Cuci setrika',5000,'kg','1–3 hari',20),
 ('00000000-0000-4000-8000-000000000003','Laundry kiloan','Express','Cuci lipat',5000,'kg','1–2 hari',30),
 ('00000000-0000-4000-8000-000000000004','Laundry kiloan','Express','Cuci setrika',7000,'kg','1–2 hari',40),
 ('00000000-0000-4000-8000-000000000005','Laundry kiloan','Kilat','Cuci lipat',7000,'kg','6 jam',50),
 ('00000000-0000-4000-8000-000000000006','Laundry kiloan','Kilat','Cuci setrika',10000,'kg','6 jam',60),
 ('00000000-0000-4000-8000-000000000007','Gorden','','Gorden tebal',4500,'meter','',70),
 ('00000000-0000-4000-8000-000000000008','Gorden','','Gorden tipis',3500,'meter','',80);

create function laundry_private.bump_catalog_version() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.laundry_catalog_version set revision=revision+1 where singleton;return null;end;
$$;
revoke all on function laundry_private.bump_catalog_version() from public,anon,authenticated;
create trigger services_changed after insert or update or delete on public.laundry_services for each statement execute function laundry_private.bump_catalog_version();

create function laundry_private.save_service(p_id uuid,p_expected_revision bigint,p_input jsonb) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); current_revision bigint; category_v text; package_v text; name_v text; unit_v text; duration_v text; price_v bigint; position_v integer;
begin
 if actor is null or not exists(select 1 from public.laundry_owner_accounts where auth_user_id=actor and is_active) then raise exception 'owner_required' using errcode='42501';end if;
 if p_id is null or p_expected_revision is null or p_expected_revision<0 or p_input is null or jsonb_typeof(p_input)<>'object' then raise exception 'catalog_invalid';end if;
 if jsonb_typeof(p_input->'category') is distinct from 'string' or jsonb_typeof(p_input->'package_name') is distinct from 'string' or jsonb_typeof(p_input->'name') is distinct from 'string' or jsonb_typeof(p_input->'unit') is distinct from 'string' or jsonb_typeof(p_input->'duration') is distinct from 'string' or jsonb_typeof(p_input->'is_visible') is distinct from 'boolean' or jsonb_typeof(p_input->'price_idr') is distinct from 'number' or jsonb_typeof(p_input->'position') is distinct from 'number' then raise exception 'catalog_invalid';end if;
 category_v:=btrim(p_input->>'category');package_v:=btrim(p_input->>'package_name');name_v:=btrim(p_input->>'name');unit_v:=btrim(p_input->>'unit');duration_v:=btrim(p_input->>'duration');
 if length(category_v) not between 1 and 80 or length(package_v)>80 or length(name_v) not between 1 and 100 or length(unit_v) not between 1 and 24 or length(duration_v)>80 or (category_v||package_v||name_v||unit_v||duration_v) ~ '[[:cntrl:]]' or (p_input->>'price_idr') !~ '^(0|[1-9][0-9]{0,9})$' or (p_input->>'position') !~ '^[0-9]{1,4}$' then raise exception 'catalog_invalid';end if;
 price_v:=(p_input->>'price_idr')::bigint;position_v:=(p_input->>'position')::integer;
 if price_v>1000000000 then raise exception 'catalog_invalid';end if;
 -- Serializes the catalogue cap and revisions, including simultaneous additions.
 perform 1 from public.laundry_catalog_version where singleton for update;
 select revision into current_revision from public.laundry_services where id=p_id;
 if not found then
  if p_expected_revision<>0 then raise exception 'catalog_conflict';end if;
  if (select count(*) from public.laundry_services)>=200 then raise exception 'catalog_limit';end if;
  insert into public.laundry_services(id,category,package_name,name,price_idr,unit,duration,position,is_visible,updated_by)
  values(p_id,category_v,package_v,name_v,price_v,unit_v,duration_v,position_v,(p_input->>'is_visible')::boolean,actor);
 else
  if current_revision<>p_expected_revision then raise exception 'catalog_conflict';end if;
  update public.laundry_services set category=category_v,package_name=package_v,name=name_v,price_idr=price_v,unit=unit_v,duration=duration_v,position=position_v,is_visible=(p_input->>'is_visible')::boolean,revision=revision+1,updated_at=now(),updated_by=actor where id=p_id;
 end if;
end;
$$;
revoke all on function laundry_private.save_service(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function laundry_private.save_service(uuid,bigint,jsonb) to authenticated;
create function public.laundry_save_service(p_id uuid,p_expected_revision bigint,p_input jsonb) returns void language sql security invoker set search_path='' as $$select laundry_private.save_service(p_id,p_expected_revision,p_input);$$;
revoke all on function public.laundry_save_service(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.laundry_save_service(uuid,bigint,jsonb) to authenticated;
-- Only the harmless version counter is streamed; never the service rows or member tables.
do $$begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.laundry_catalog_version;
 end if;
end$$;
