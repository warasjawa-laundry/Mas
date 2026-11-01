-- Owner-selected G3 extension: sequential public staff labels MAS-0001...MAS-9999.
-- A username is an IDENTIFIER, never a secret. Login is only possible on a
-- previously owner-paired device, using two separate high-entropy cookies.
-- POS payment and point posting remain write-disabled.

alter table public.laundry_pos_outlets
 add column last_cashier_number integer not null default 0
 check (last_cashier_number between 0 and 9999);

alter table public.laundry_pos_staff add column username text;
-- Forward compatible with QA/prod databases that may have staff data at apply
-- time. Existing UUID/created_at are unchanged. Deterministic order, no reuse.
do $migrate_existing$
declare v_staff record; v_num integer;
begin
 for v_staff in select staff_id from public.laundry_pos_staff
    order by created_at,staff_id
 loop
  update public.laundry_pos_outlets
    set last_cashier_number=last_cashier_number+1
    where singleton_key=1 and last_cashier_number < 9999
    returning last_cashier_number into v_num;
  if v_num is null then raise exception 'cashier_username_limit' using errcode='22023';end if;
  update public.laundry_pos_staff
    set username='MAS-'||lpad(v_num::text,4,'0') where staff_id=v_staff.staff_id;
 end loop;
end;
$migrate_existing$;
alter table public.laundry_pos_staff alter column username set not null;
alter table public.laundry_pos_staff add constraint laundry_pos_staff_username_format
 check (username ~ '^MAS-[0-9]{4}$' and username <> 'MAS-0000');
alter table public.laundry_pos_staff add constraint laundry_pos_staff_username_unique unique (username);

-- Protect historical identities from rename/reuse, including by privileged
-- updates. The owner can rename the person but never renumber their login.
create function laundry_private.pos_reject_cashier_username_change()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.username is distinct from old.username then
  raise exception 'cashier_username_immutable' using errcode='42501';
 end if;
 return new;
end;
$$;
revoke all on function laundry_private.pos_reject_cashier_username_change() from public,anon,authenticated;
create trigger pos_cashier_username_immutable before update on public.laundry_pos_staff
 for each row execute function laundry_private.pos_reject_cashier_username_change();

-- Schema update of existing RPC: all previous owner-only checks remain.
create or replace function laundry_private.pos_owner_save_cashier(
 p_staff_id uuid,p_display_name text,p_permissions jsonb,p_active boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_outlet uuid; v_id uuid; v_name text:=btrim(coalesce(p_display_name,''));
        v_before jsonb; v_number integer;
begin
 v_owner:=laundry_private.pos_owner_required();
 if p_active is null or length(v_name) not between 2 and 100
   or v_name ~ '[[:cntrl:]]' or not laundry_private.pos_valid_cashier_permissions(p_permissions)
 then raise exception 'invalid_cashier' using errcode='22023'; end if;
 select id into strict v_outlet from public.laundry_pos_outlets where singleton_key=1;
 if p_staff_id is null then
   -- Row lock on the fixed outlet serializes concurrent owner requests.
   -- Rolling back a failed create also rolls back the counter increment.
   update public.laundry_pos_outlets set last_cashier_number=last_cashier_number+1
    where id=v_outlet and last_cashier_number<9999
    returning last_cashier_number into v_number;
   if v_number is null then raise exception 'cashier_username_limit' using errcode='22023';end if;
   insert into public.laundry_pos_staff(display_name,active,username)
     values(v_name,p_active,'MAS-'||lpad(v_number::text,4,'0')) returning staff_id into v_id;
   insert into public.laundry_pos_staff_outlets(staff_id,outlet_id,role,enabled,permissions)
     values(v_id,v_outlet,'cashier',p_active,p_permissions);
   v_before:='{}'::jsonb;
 else
   v_id:=p_staff_id;
   select jsonb_build_object('name',st.display_name,'active',st.active,'username',st.username,'permissions',so.permissions)
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
          'name',v_name,'active',p_active,'permissions',p_permissions,
          'username',(select username from public.laundry_pos_staff where staff_id=v_id))));
 return v_id;
end;
$$;

-- SQL function's return signature changes so replace BOTH wrappers carefully.
drop function public.laundry_pos_owner_list_cashiers();
drop function laundry_private.pos_owner_list_cashiers();
create function laundry_private.pos_owner_list_cashiers()
returns table (staff_id uuid,username text,display_name text,active boolean,
               permissions jsonb,active_devices bigint)
language plpgsql security definer set search_path = '' stable as $$
begin
 perform laundry_private.pos_owner_required();
 return query select st.staff_id,st.username,st.display_name,st.active,so.permissions,
   (select count(*) from public.laundry_pos_cashier_devices d
      where d.staff_id=st.staff_id and d.revoked_at is null
        and d.expires_at>clock_timestamp())::bigint
 from public.laundry_pos_staff st
 join public.laundry_pos_staff_outlets so on so.staff_id=st.staff_id
 order by st.created_at,st.username;
end;
$$;
revoke all on function laundry_private.pos_owner_list_cashiers() from public,anon,authenticated;
grant execute on function laundry_private.pos_owner_list_cashiers() to authenticated;
create function public.laundry_pos_owner_list_cashiers()
returns table (staff_id uuid,username text,display_name text,active boolean,
               permissions jsonb,active_devices bigint)
language sql security invoker set search_path = '' stable as $$
 select * from laundry_private.pos_owner_list_cashiers();
$$;
revoke all on function public.laundry_pos_owner_list_cashiers() from public,anon,authenticated;
grant execute on function public.laundry_pos_owner_list_cashiers() to authenticated;

-- A paired device is tied to exactly one cashier. Supplying a different,
-- guessable MAS-XXXX label NEVER switches the device identity.
alter table public.laundry_pos_cashier_devices
  add column failed_username_attempts integer not null default 0
    check (failed_username_attempts between 0 and 5),
  add column locked_until timestamptz;

create table public.laundry_pos_cashier_logins (
 id uuid primary key default gen_random_uuid(),
 device_id uuid not null references public.laundry_pos_cashier_devices(id) on delete restrict,
 staff_id uuid not null references public.laundry_pos_staff(staff_id) on delete restrict,
 token_digest bytea not null unique check (octet_length(token_digest)=32),
 logged_in_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 check (expires_at>logged_in_at),
 check (revoked_at is null or revoked_at>=logged_in_at)
);
create index laundry_pos_cashier_logins_device_idx
  on public.laundry_pos_cashier_logins(device_id,expires_at desc);
alter table public.laundry_pos_cashier_logins enable row level security;
revoke all on public.laundry_pos_cashier_logins from public,anon,authenticated;

-- Login requires (1) owner-paired active device secret, (2) exact assigned
-- username and (3) fresh server-generated 256-bit login token. Bad usernames
-- record a per-device failure and lock after five failures. Return false;
-- exceptions here would roll back failed-attempt counters.
create function laundry_private.pos_cashier_login(
 p_device_token text,p_username text,p_login_token text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_device record; v_valid boolean; v_new_time timestamptz:=clock_timestamp();
begin
 if p_device_token is null or p_device_token !~ '^[A-Za-z0-9_-]{43}$'
   or p_login_token is null or p_login_token !~ '^[A-Za-z0-9_-]{43}$'
   or p_username is null or p_username !~ '^MAS-[0-9]{4}$' then
  return false;
 end if;
 select d.id,d.staff_id,d.expires_at,d.failed_username_attempts,d.locked_until,
        st.username,st.active,so.enabled,o.active as outlet_active
 into v_device
 from public.laundry_pos_cashier_devices d
 join public.laundry_pos_staff st on st.staff_id=d.staff_id
 join public.laundry_pos_staff_outlets so on so.staff_id=d.staff_id and so.outlet_id=d.outlet_id
 join public.laundry_pos_outlets o on o.id=d.outlet_id
 where d.token_digest=extensions.digest(p_device_token,'sha256')
   and d.revoked_at is null and d.expires_at>v_new_time
 for update of d;
 if not found then return false; end if;
 if not v_device.active or not v_device.enabled or not v_device.outlet_active
    or (v_device.locked_until is not null and v_device.locked_until>v_new_time) then
   return false;
 end if;
 v_valid:=p_username=v_device.username;
 if not v_valid then
   update public.laundry_pos_cashier_devices
    set failed_username_attempts=least(failed_username_attempts+1,5),
        locked_until=case when failed_username_attempts+1>=5
                            then v_new_time+interval '5 minutes'
                          else null end
    where id=v_device.id;
   return false;
 end if;
 update public.laundry_pos_cashier_devices
   set failed_username_attempts=0,locked_until=null where id=v_device.id;
 -- Only one active cashier login per paired device. The pairing remains
 -- valid after logout so re-entering the username never requires owner again.
 update public.laundry_pos_cashier_logins set revoked_at=v_new_time
  where device_id=v_device.id and revoked_at is null;
 insert into public.laundry_pos_cashier_logins(device_id,staff_id,token_digest,expires_at)
 values(v_device.id,v_device.staff_id,extensions.digest(p_login_token,'sha256'),
        least(v_device.expires_at,v_new_time+interval '12 hours'));
 return true;
end;
$$;
revoke all on function laundry_private.pos_cashier_login(text,text,text) from public,anon,authenticated;
grant execute on function laundry_private.pos_cashier_login(text,text,text) to anon,authenticated;
create function public.laundry_pos_cashier_login(p_device_token text,p_username text,p_login_token text)
returns boolean language sql security invoker set search_path = '' as $$
 select laundry_private.pos_cashier_login(p_device_token,p_username,p_login_token); $$;
revoke all on function public.laundry_pos_cashier_login(text,text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_cashier_login(text,text,text) to anon,authenticated;

-- Existing cashier_session(token) is retained as device diagnostic for the
-- legacy owner pairing flow; it is NOT authorization for cashier features.
-- Every new feature must call the two-cookie *authenticated* session checker.
create function laundry_private.pos_cashier_logged_in(p_device_token text,p_login_token text)
returns table(staff_id uuid,username text,outlet_id uuid,display_name text,
 permissions jsonb,outlet_name text,outlet_address text,write_enabled boolean,
 expires_at timestamptz)
language sql security definer set search_path = '' stable as $$
 select st.staff_id,st.username,o.id,st.display_name,so.permissions,
        o.name,o.address,o.write_enabled,l.expires_at
 from public.laundry_pos_cashier_logins l
 join public.laundry_pos_cashier_devices d on d.id=l.device_id and d.staff_id=l.staff_id
 join public.laundry_pos_staff st on st.staff_id=d.staff_id
 join public.laundry_pos_staff_outlets so on so.staff_id=st.staff_id and so.outlet_id=d.outlet_id
 join public.laundry_pos_outlets o on o.id=d.outlet_id
 where p_device_token ~ '^[A-Za-z0-9_-]{43}$'
   and p_login_token ~ '^[A-Za-z0-9_-]{43}$'
   and d.token_digest=extensions.digest(p_device_token,'sha256')
   and l.token_digest=extensions.digest(p_login_token,'sha256')
   and d.revoked_at is null and d.expires_at>clock_timestamp()
   and l.revoked_at is null and l.expires_at>clock_timestamp()
   and st.active and so.enabled and so.role='cashier' and o.active;
$$;
revoke all on function laundry_private.pos_cashier_logged_in(text,text) from public,anon,authenticated;
grant execute on function laundry_private.pos_cashier_logged_in(text,text) to anon,authenticated;
create function public.laundry_pos_cashier_logged_in(p_device_token text,p_login_token text)
returns table(staff_id uuid,username text,outlet_id uuid,display_name text,
 permissions jsonb,outlet_name text,outlet_address text,write_enabled boolean,
 expires_at timestamptz)
language sql security invoker set search_path = '' stable as $$
 select * from laundry_private.pos_cashier_logged_in(p_device_token,p_login_token); $$;
revoke all on function public.laundry_pos_cashier_logged_in(text,text) from public,anon,authenticated;
grant execute on function public.laundry_pos_cashier_logged_in(text,text) to anon,authenticated;

create function laundry_private.pos_cashier_logout(p_login_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
 if p_login_token is null or p_login_token !~ '^[A-Za-z0-9_-]{43}$' then return false;end if;
 update public.laundry_pos_cashier_logins set revoked_at=clock_timestamp()
 where token_digest=extensions.digest(p_login_token,'sha256') and revoked_at is null;
 get diagnostics v_count=row_count;
 return v_count>0;
end;
$$;
revoke all on function laundry_private.pos_cashier_logout(text) from public,anon,authenticated;
grant execute on function laundry_private.pos_cashier_logout(text) to anon,authenticated;
create function public.laundry_pos_cashier_logout(p_login_token text)
returns boolean language sql security invoker set search_path = '' as $$
 select laundry_private.pos_cashier_logout(p_login_token); $$;
revoke all on function public.laundry_pos_cashier_logout(text) from public,anon,authenticated;
grant execute on function public.laundry_pos_cashier_logout(text) to anon,authenticated;

comment on function public.laundry_pos_cashier_login(text,text,text)
 is 'Enter staff username only on owner-paired device; no passwords. Wrong username never grants another staff identity.';
comment on function public.laundry_pos_cashier_logged_in(text,text)
 is 'Only valid paired-device plus staff-login secret authorizes cashier screen. Database writes still gated.';