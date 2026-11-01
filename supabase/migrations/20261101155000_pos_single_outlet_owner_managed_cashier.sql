-- POS owner-controlled cashier profiles and exactly one canonical location.
-- Source of truth: lib/site.ts (Jl. Raya Kandang Jati Kulon RT.06 RW.01).
-- Cashier profiles are NOT Supabase Auth users, and have no passwords.
-- Uses pgcrypto digest() from Supabase's extensions schema.
-- Payment and POS point mutation remain disabled; production application is unaffected
-- until this reviewed migration is explicitly applied.

-- The legacy G2 staff table has no live POS data. Preserve its internal UUID
-- and existing assignment FK, but detach it from auth.users (no employee login).
alter table public.laundry_pos_staff
  drop constraint laundry_pos_staff_auth_user_id_fkey;
alter table public.laundry_pos_staff rename column auth_user_id to staff_id;
alter table public.laundry_pos_staff alter column staff_id set default gen_random_uuid();
alter table public.laundry_pos_staff_outlets rename column auth_user_id to staff_id;

-- The system supports one fixed shop only; not a branch-management system.
alter table public.laundry_pos_outlets
  add column address text not null default 'Jl. Raya Kandang Jati Kulon RT.06 RW.01, Kandang Jati Kulon, Probolinggo'
    check (length(address) between 10 and 240),
  add column singleton_key smallint not null default 1 check (singleton_key = 1),
  add constraint laundry_pos_outlets_only_one unique (singleton_key);
insert into public.laundry_pos_outlets(code,name,address,active,write_enabled)
values ('MJL','Mas Jawa Laundry','Jl. Raya Kandang Jati Kulon RT.06 RW.01, Kandang Jati Kulon, Probolinggo',true,false);

-- Explicit individual permissions, no manager logins and no privileges inferred
-- from client fields, from staff names, or from owner session cookies.
alter table public.laundry_pos_staff_outlets drop constraint laundry_pos_staff_outlets_role_check;
alter table public.laundry_pos_staff_outlets alter column role set default 'cashier';
alter table public.laundry_pos_staff_outlets
  add constraint laundry_pos_staff_outlets_cashier_only check (role = 'cashier'),
  add column permissions jsonb not null default '{}'::jsonb;

create function laundry_private.pos_valid_cashier_permissions(p_permissions jsonb)
returns boolean language sql immutable set search_path = '' as $$
 select coalesce(
   pg_catalog.jsonb_typeof(p_permissions) = 'object'
   and not exists (
     select 1 from pg_catalog.jsonb_each(p_permissions) as p(k,v)
     where k not in (
       'order_view','order_create','order_work','member_lookup',
       'payment_collect','receipt_print','whatsapp_draft',
       'cash_view','cash_entry','reports_view','refund_full'
     ) or pg_catalog.jsonb_typeof(v) <> 'boolean'
   ), false
 );
$$;
revoke all on function laundry_private.pos_valid_cashier_permissions(jsonb)
  from public,anon,authenticated;
alter table public.laundry_pos_staff_outlets
  add constraint laundry_pos_permissions_valid
  check (laundry_private.pos_valid_cashier_permissions(permissions));

-- High-entropy per-device bearer token, stored SHA256 only. This is a local
-- workstation session, not a cashier username/password and not owner auth.
create table public.laundry_pos_cashier_devices (
 id uuid primary key default gen_random_uuid(),
 staff_id uuid not null references public.laundry_pos_staff(staff_id) on delete restrict,
 outlet_id uuid not null references public.laundry_pos_outlets(id) on delete restrict,
 token_digest bytea not null unique check (octet_length(token_digest) = 32),
 issued_by uuid not null references public.laundry_owner_accounts(auth_user_id) on delete restrict,
 issued_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 check (expires_at > issued_at),
 check (revoked_at is null or revoked_at >= issued_at)
);
create index laundry_pos_devices_by_staff on public.laundry_pos_cashier_devices(staff_id,expires_at desc);
create table public.laundry_pos_cashier_audit (
 id uuid primary key default gen_random_uuid(),
 staff_id uuid not null references public.laundry_pos_staff(staff_id) on delete restrict,
 owner_id uuid not null references public.laundry_owner_accounts(auth_user_id) on delete restrict,
 action text not null check (action in ('CREATE','UPDATE','DISABLE','PAIR','REVOKE')),
 changes jsonb not null check (jsonb_typeof(changes)='object'),
 occurred_at timestamptz not null default clock_timestamp()
);
create index laundry_pos_cashier_audit_staff_time on public.laundry_pos_cashier_audit(staff_id,occurred_at desc);

-- No browser access to either table. Owner operations use reviewed RPCs below.
alter table public.laundry_pos_cashier_devices enable row level security;
alter table public.laundry_pos_cashier_audit enable row level security;
revoke all on public.laundry_pos_cashier_devices from public,anon,authenticated;
revoke all on public.laundry_pos_cashier_audit from public,anon,authenticated;

create function laundry_private.pos_owner_required()
returns uuid language plpgsql security definer set search_path = '' stable as $$
declare v_owner uuid := (select auth.uid());
begin
 if v_owner is null or not exists(
   select 1 from public.laundry_owner_accounts
   where auth_user_id=v_owner and is_active
 ) then raise exception 'owner_only' using errcode='42501'; end if;
 return v_owner;
end;
$$;
revoke all on function laundry_private.pos_owner_required() from public,anon,authenticated;

-- The fixed single shop has no "add outlet" API or dashboard controls.
create or replace function laundry_private.pos_authorized_outlets()
returns table (outlet_id uuid, outlet_code text, outlet_name text, assigned_role text)
language sql security definer set search_path = '' stable as $$
 select o.id,o.code,o.name,'owner'::text
 from public.laundry_pos_outlets o
 where o.active and (select auth.uid()) is not null
   and exists(select 1 from public.laundry_owner_accounts own
       where own.auth_user_id=(select auth.uid()) and own.is_active);
$$;

create function laundry_private.pos_owner_list_cashiers()
returns table (staff_id uuid,display_name text,active boolean,permissions jsonb,active_devices bigint)
language plpgsql security definer set search_path = '' stable as $$
begin
 perform laundry_private.pos_owner_required();
 return query select st.staff_id, st.display_name,st.active,so.permissions,
     (select count(*) from public.laundry_pos_cashier_devices d
      where d.staff_id=st.staff_id and d.revoked_at is null
        and d.expires_at > clock_timestamp())::bigint
 from public.laundry_pos_staff st
 join public.laundry_pos_staff_outlets so on so.staff_id=st.staff_id
 order by st.created_at,st.staff_id;
end;
$$;

create function laundry_private.pos_owner_save_cashier(
 p_staff_id uuid,p_display_name text,p_permissions jsonb,p_active boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_outlet uuid; v_id uuid; v_name text:=btrim(coalesce(p_display_name,''));
        v_before jsonb;
begin
 v_owner:=laundry_private.pos_owner_required();
 if p_active is null or length(v_name) not between 2 and 100
   or v_name ~ '[[:cntrl:]]' or not laundry_private.pos_valid_cashier_permissions(p_permissions)
 then raise exception 'invalid_cashier' using errcode='22023'; end if;
 select id into strict v_outlet from public.laundry_pos_outlets where singleton_key=1;
 if p_staff_id is null then
   insert into public.laundry_pos_staff(display_name,active)
     values(v_name,p_active) returning staff_id into v_id;
   insert into public.laundry_pos_staff_outlets(staff_id,outlet_id,role,enabled,permissions)
     values(v_id,v_outlet,'cashier',p_active,p_permissions);
   v_before:='{}'::jsonb;
 else
   v_id:=p_staff_id;
   select jsonb_build_object('name',st.display_name,'active',st.active,'permissions',so.permissions)
     into v_before from public.laundry_pos_staff st
     join public.laundry_pos_staff_outlets so on so.staff_id=st.staff_id
     where st.staff_id=v_id and so.outlet_id=v_outlet for update of st,so;
   if not found then raise exception 'cashier_not_found' using errcode='22023'; end if;
   update public.laundry_pos_staff set display_name=v_name,active=p_active where staff_id=v_id;
   update public.laundry_pos_staff_outlets set enabled=p_active,permissions=p_permissions
     where staff_id=v_id and outlet_id=v_outlet;
   if not p_active then
     update public.laundry_pos_cashier_devices set revoked_at=clock_timestamp()
     where staff_id=v_id and revoked_at is null;
   end if;
 end if;
 insert into public.laundry_pos_cashier_audit(staff_id,owner_id,action,changes)
 values(v_id,v_owner,case when p_staff_id is null then 'CREATE'
                         when not p_active then 'DISABLE' else 'UPDATE' end,
        jsonb_build_object('before',v_before,'after',jsonb_build_object(
          'name',v_name,'active',p_active,'permissions',p_permissions)));
 return v_id;
end;
$$;

create function laundry_private.pos_owner_revoke_cashier_devices(p_staff_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;v_count integer;
begin
 v_owner:=laundry_private.pos_owner_required();
 if not exists(select 1 from public.laundry_pos_staff where staff_id=p_staff_id) then
   raise exception 'cashier_not_found' using errcode='22023';end if;
 update public.laundry_pos_cashier_devices set revoked_at=clock_timestamp()
 where staff_id=p_staff_id and revoked_at is null and expires_at>clock_timestamp();
 get diagnostics v_count = row_count;
 insert into public.laundry_pos_cashier_audit(staff_id,owner_id,action,changes)
 values(p_staff_id,v_owner,'REVOKE',jsonb_build_object('sessions',v_count));
 return v_count;
end;
$$;

create function laundry_private.pos_owner_revoke_device(p_device_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;v_staff uuid;
begin
 v_owner:=laundry_private.pos_owner_required();
 update public.laundry_pos_cashier_devices set revoked_at=clock_timestamp()
 where id=p_device_id and revoked_at is null returning staff_id into v_staff;
 if v_staff is null then return false;end if;
 insert into public.laundry_pos_cashier_audit(staff_id,owner_id,action,changes)
 values(v_staff,v_owner,'REVOKE',jsonb_build_object('device_id',p_device_id));
 return true;
end;
$$;

-- Owner must be physically present on the employee device to activate it.
-- No cashier can generate or renew credentials by themselves.
create function laundry_private.pos_owner_pair_cashier(p_staff_id uuid,p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;v_outlet uuid;v_id uuid;v_active boolean;
begin
 v_owner:=laundry_private.pos_owner_required();
 if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
   raise exception 'invalid_device_token' using errcode='22023';end if;
 select st.active and so.enabled,so.outlet_id into v_active,v_outlet
 from public.laundry_pos_staff st
 join public.laundry_pos_staff_outlets so on st.staff_id=so.staff_id
 where st.staff_id=p_staff_id and so.role='cashier' for update of st,so;
 if not found or not v_active then raise exception 'cashier_inactive' using errcode='42501';end if;
 if (select count(*) from public.laundry_pos_cashier_devices
      where staff_id=p_staff_id and revoked_at is null and expires_at>clock_timestamp()) >= 5
 then raise exception 'device_limit' using errcode='22023';end if;
 insert into public.laundry_pos_cashier_devices(staff_id,outlet_id,token_digest,issued_by,expires_at)
 values(p_staff_id,v_outlet,extensions.digest(p_token,'sha256'),v_owner,
       clock_timestamp()+interval '7 days') returning id into v_id;
 insert into public.laundry_pos_cashier_audit(staff_id,owner_id,action,changes)
 values(p_staff_id,v_owner,'PAIR',jsonb_build_object('device_id',v_id));
 return v_id;
end;
$$;

-- Internal verifier for subsequent order/payment RPCs. Treat the raw token as
-- secret; the database stores SHA256 only, never the raw value. Future command
-- must additionally require a named permission and check write_enabled.
create function laundry_private.pos_cashier_device(p_token text)
returns table(staff_id uuid,outlet_id uuid,display_name text,
 permissions jsonb,outlet_name text,outlet_address text,write_enabled boolean,
 expires_at timestamptz)
language sql security definer set search_path = '' stable as $$
 select st.staff_id,o.id,st.display_name,so.permissions,o.name,o.address,o.write_enabled,d.expires_at
 from public.laundry_pos_cashier_devices d
 join public.laundry_pos_staff st on st.staff_id=d.staff_id
 join public.laundry_pos_staff_outlets so on so.staff_id=st.staff_id and so.outlet_id=d.outlet_id
 join public.laundry_pos_outlets o on o.id=d.outlet_id
 where p_token ~ '^[A-Za-z0-9_-]{43}$'
   and d.token_digest=extensions.digest(p_token,'sha256')
   and d.revoked_at is null and d.expires_at>clock_timestamp()
   and st.active and so.enabled and so.role='cashier' and o.active;
$$;

create function public.laundry_pos_owner_list_cashiers()
returns table(staff_id uuid,display_name text,active boolean,permissions jsonb,active_devices bigint)
language sql security invoker set search_path = '' stable as $$
 select * from laundry_private.pos_owner_list_cashiers(); $$;
create function public.laundry_pos_owner_save_cashier(
 p_staff_id uuid,p_display_name text,p_permissions jsonb,p_active boolean)
returns uuid language sql security invoker set search_path = '' as $$
 select laundry_private.pos_owner_save_cashier(p_staff_id,p_display_name,p_permissions,p_active); $$;
create function public.laundry_pos_owner_revoke_cashier_devices(p_staff_id uuid)
returns integer language sql security invoker set search_path = '' as $$
 select laundry_private.pos_owner_revoke_cashier_devices(p_staff_id); $$;
create function public.laundry_pos_owner_revoke_device(p_device_id uuid)
returns boolean language sql security invoker set search_path = '' as $$
 select laundry_private.pos_owner_revoke_device(p_device_id); $$;
create function public.laundry_pos_owner_pair_cashier(p_staff_id uuid,p_token text)
returns uuid language sql security invoker set search_path = '' as $$
 select laundry_private.pos_owner_pair_cashier(p_staff_id,p_token); $$;
create function public.laundry_pos_cashier_session(p_token text)
returns table(staff_id uuid,outlet_id uuid,display_name text,permissions jsonb,
 outlet_name text,outlet_address text,write_enabled boolean,expires_at timestamptz)
language sql security invoker set search_path = '' stable as $$
 select staff_id,outlet_id,display_name,permissions,outlet_name,outlet_address,write_enabled,expires_at
 from laundry_private.pos_cashier_device(p_token); $$;

-- Cashier can revoke its own device token; no other action permitted anonymously.
create function laundry_private.pos_cashier_end_session(p_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
 if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then return false;end if;
 update public.laundry_pos_cashier_devices set revoked_at=clock_timestamp()
 where token_digest=extensions.digest(p_token,'sha256') and revoked_at is null;
 get diagnostics v_count=row_count;
 return v_count>0;
end;
$$;
create function public.laundry_pos_cashier_end_session(p_token text)
returns boolean language sql security invoker set search_path = '' as $$
 select laundry_private.pos_cashier_end_session(p_token); $$;

-- Explicit function grants; triggers and helpers cannot be called by anonymous
-- users except the narrow token validation/logout wrappers.
do $$
declare p record;
begin
 for p in select x.oid, pg_get_function_identity_arguments(x.oid) as args,
   x.proname,n.nspname
   from pg_proc x join pg_namespace n on n.oid=x.pronamespace
   where (n.nspname='laundry_private' and x.proname like 'pos_%')
      or (n.nspname='public' and x.proname like 'laundry_pos_owner_%')
      or (n.nspname='public' and x.proname in ('laundry_pos_cashier_session','laundry_pos_cashier_end_session'))
 loop
  execute format('revoke all on function %I.%I(%s) from public,anon,authenticated',p.nspname,p.proname,p.args);
  if p.nspname='public' and p.proname like 'laundry_pos_owner_%' then
   execute format('grant execute on function %I.%I(%s) to authenticated',p.nspname,p.proname,p.args);
  elsif p.nspname='public' and p.proname in ('laundry_pos_cashier_session','laundry_pos_cashier_end_session') then
   execute format('grant execute on function %I.%I(%s) to anon,authenticated',p.nspname,p.proname,p.args);
  elsif p.nspname='laundry_private' and p.proname in (
    'pos_owner_list_cashiers','pos_owner_save_cashier','pos_owner_revoke_cashier_devices',
    'pos_owner_revoke_device','pos_owner_pair_cashier','pos_cashier_device','pos_cashier_end_session',
    'pos_authorized_outlets'
  ) then
   execute format('grant execute on function %I.%I(%s) to %s',p.nspname,p.proname,p.args,
     case when p.proname in ('pos_cashier_device','pos_cashier_end_session')
       then 'anon,authenticated' else 'authenticated' end);
  end if;
 end loop;
end $$;

comment on function public.laundry_pos_owner_save_cashier(uuid,text,jsonb,boolean)
 is 'Owner authenticated: create/edit/disable passwordless cashier. Disable revokes devices and retains audit.';
comment on function public.laundry_pos_cashier_session(text)
 is 'Read-only bearer-session lookup. Raw device token must never be logged or exposed to the browser.';