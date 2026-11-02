-- G3 correction (owner decision 2 Nov 2026): employee enters only MAS-0001 ... MAS-9999.
-- Remove owner-device-pairing as a *login prerequisite*. Preserve owner Auth,
-- current paired sessions, DB permission checks, revocation and financial flags.
-- IMPORTANT: Four numeric digits are low-entropy. Database throttling only
-- mitigates guessing; G8 activation requires separate risk review and UAT.

-- Direct-ID sessions keep both opaque 256-bit cookie credentials, but an owner
-- no longer appears as the issuer of a device they never approved.
alter table public.laundry_pos_cashier_devices
  alter column issued_by drop not null,
  add column login_origin text not null default 'OWNER_PAIRED',
  add constraint laundry_pos_cashier_device_origin_check
    check ((login_origin='OWNER_PAIRED' and issued_by is not null)
        or (login_origin='DIRECT_ID' and issued_by is null));

-- A single-shop, database-enforced global rate limit also applies to unknown
-- usernames (no account enumeration bypass by trying different IDs).
-- A malicious caller can cause temporary denial of service; G8 must review
-- this tradeoff before financial POS writes are enabled.
create table laundry_private.pos_cashier_id_login_throttle (
  singleton smallint primary key default 1 check (singleton = 1),
  window_started_at timestamptz not null default clock_timestamp(),
  attempts integer not null default 0 check (attempts between 0 and 1000),
  locked_until timestamptz
);
alter table laundry_private.pos_cashier_id_login_throttle enable row level security;
revoke all on laundry_private.pos_cashier_id_login_throttle from public,anon,authenticated;
insert into laundry_private.pos_cashier_id_login_throttle(singleton) values (1);

create function laundry_private.pos_cashier_direct_id_login(
  p_username text,p_device_token text,p_login_token text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_gate record; v_staff uuid; v_outlet uuid; v_device_id uuid;
  v_active_sessions integer;
begin
  if p_username is null or (p_username !~ '^MAS-[0-9]{4}$' or p_username='MAS-0000')
     or p_device_token is null or p_device_token !~ '^[A-Za-z0-9_-]{43}$'
     or p_login_token is null or p_login_token !~ '^[A-Za-z0-9_-]{43}$'
     or p_device_token = p_login_token then return false; end if;

  -- Serialize attempts across the *entire* single outlet, including guesses
  -- for staff who do not exist. Update, never throw for invalid credentials:
  -- exceptions would roll back the throttling counter.
  select * into strict v_gate from laundry_private.pos_cashier_id_login_throttle where singleton=1 for update;
  if v_gate.locked_until is not null and v_gate.locked_until>v_now then return false; end if;
  if v_gate.window_started_at <= v_now-interval '1 minute' then
    update laundry_private.pos_cashier_id_login_throttle
    set window_started_at=v_now,attempts=0,locked_until=null where singleton=1;
    v_gate.attempts:=0;
  end if;
  if v_gate.attempts>=10 then
    update laundry_private.pos_cashier_id_login_throttle
    set locked_until=v_now+interval '5 minutes' where singleton=1;
    return false;
  end if;
  update laundry_private.pos_cashier_id_login_throttle set attempts=attempts+1 where singleton=1;

  select st.staff_id,so.outlet_id into v_staff,v_outlet
  from public.laundry_pos_staff st
  join public.laundry_pos_staff_outlets so on so.staff_id=st.staff_id
  join public.laundry_pos_outlets o on o.id=so.outlet_id
  where st.username=p_username and st.active and so.enabled
    and so.role='cashier' and o.active and o.singleton_key=1;
  if not found then return false; end if;

  -- Bound active direct sessions per cashier; owner can revoke them with the
  -- existing revoke-all action. Both bearer digests remain DB-only.
  select count(*) into v_active_sessions from public.laundry_pos_cashier_devices
    where staff_id=v_staff and login_origin='DIRECT_ID'
      and revoked_at is null and expires_at>v_now;
  if v_active_sessions>=5 then return false; end if;

  insert into public.laundry_pos_cashier_devices(
     staff_id,outlet_id,token_digest,issued_by,expires_at,login_origin)
  values (v_staff,v_outlet,extensions.digest(p_device_token,'sha256'),null,
          v_now+interval '12 hours','DIRECT_ID') returning id into v_device_id;
  insert into public.laundry_pos_cashier_logins(device_id,staff_id,token_digest,expires_at)
  values (v_device_id,v_staff,extensions.digest(p_login_token,'sha256'),v_now+interval '12 hours');
  return true;
end;
$$;
revoke all on function laundry_private.pos_cashier_direct_id_login(text,text,text)
  from public,anon,authenticated;
grant execute on function laundry_private.pos_cashier_direct_id_login(text,text,text)
  to anon,authenticated;

create function public.laundry_pos_cashier_direct_id_login(
  p_username text,p_device_token text,p_login_token text
) returns boolean language sql security invoker set search_path = '' as $$
  select laundry_private.pos_cashier_direct_id_login(p_username,p_device_token,p_login_token);
$$;
revoke all on function public.laundry_pos_cashier_direct_id_login(text,text,text)
  from public,anon,authenticated;
grant execute on function public.laundry_pos_cashier_direct_id_login(text,text,text)
  to anon,authenticated;

comment on function public.laundry_pos_cashier_direct_id_login(text,text,text) is
  'Cashier MAS-XXXX ID-only login, 10 attempts/minute globally (5-minute lock), two high-entropy 12h session secrets. No owner pairing. Low-entropy identifier; require G8 security review before live finance.';