-- Synthetic fixtures only; this test never persists people or QR material.
begin;
do $test$
declare actor uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid();
 m uuid:=gen_random_uuid(); m2 uuid:=gen_random_uuid(); not_imported uuid:=gen_random_uuid();
 card uuid; again uuid; denied boolean;
begin
 insert into auth.users(id,aud,role) values(actor,'authenticated','authenticated'),(stranger,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(actor,true);
 insert into public.laundry_members(id,display_name,whatsapp_e164,address,created_by) values
  (m,'Synthetic same name','+628123456780','Synthetic address',actor),
  (m2,'Synthetic same name',null,null,actor),
  (not_imported,'Synthetic ordinary',null,null,actor);
 insert into public.laundry_member_import_rows(source_sha256,source_row,member_id,source_phone,phone_needs_review,linked_existing,imported_by)
 values(repeat('a',64),2,m,'628123456780',false,false,actor),(repeat('a',64),3,m2,'123',true,false,actor);
 -- Source row replay cannot create a second association.
 insert into public.laundry_member_import_rows(source_sha256,source_row,member_id,source_phone,phone_needs_review,linked_existing,imported_by)
 values(repeat('a',64),2,m,'628123456780',false,false,actor) on conflict do nothing;
 if (select count(*) from public.laundry_member_import_rows where source_sha256=repeat('a',64))<>2 then raise exception 'replay duplicated source'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 execute 'set local role authenticated';
 if not exists(select 1 from public.laundry_members where id=m and address='Synthetic address')
  or not exists(select 1 from public.laundry_members where id=m2 and address is null and whatsapp_e164 is null)
 then raise exception 'import data not preserved'; end if;
 denied:=false;begin insert into public.laundry_member_import_rows values(repeat('b',64),2,m,'123',true,false,actor,now()); exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'web import write allowed';end if;
 denied:=false;begin perform public.laundry_issue_imported_member_card(not_imported,repeat('b',64),repeat('b',142)); exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'ordinary member issued through import API';end if;
 denied:=false;begin perform public.laundry_issue_imported_member_card(m,repeat('b',64),'00'); exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'bad encryption accepted';end if;
 card:=public.laundry_issue_imported_member_card(m,repeat('b',64),repeat('b',142));
 again:=public.laundry_issue_imported_member_card(m,repeat('c',64),repeat('c',142));
 if card is distinct from again then raise exception 'repeated issuance replaced card';end if;
 perform set_config('request.jwt.claim.sub',stranger::text,true);
 if exists(select 1 from public.laundry_member_import_rows) or exists(select 1 from public.laundry_members where id=m)
 then raise exception 'nonowner reads private contact';end if;
 denied:=false;begin perform public.laundry_issue_imported_member_card(m2,repeat('c',64),repeat('c',142));exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'nonowner issues card';end if;
 execute 'set local role anon';
 denied:=false;begin perform source_phone from public.laundry_member_import_rows;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'anon reads source phone';end if;
 denied:=false;begin perform address from public.laundry_members;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'anon reads address';end if;
 denied:=false;begin perform public.laundry_issue_imported_member_card(m2,repeat('c',64),repeat('c',142));exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'anon issues card';end if;
 execute 'reset role';
 if (select count(*) from public.laundry_member_cards where member_id=m)<>1 then raise exception 'duplicate cards';end if;
 update public.laundry_member_cards set revoked_at=now(),revoked_by=actor,revoked_reason='Synthetic revocation' where id=card;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 execute 'set local role authenticated';
 denied:=false;begin perform public.laundry_issue_imported_member_card(m,repeat('c',64),repeat('c',142));exception when invalid_parameter_value then denied:=true;end;
 if not denied then raise exception 'revoked card policy bypassed';end if;
 execute 'reset role';
 update public.laundry_owner_accounts set is_active=false where auth_user_id=actor;
 execute 'set local role authenticated';
 denied:=false;begin perform public.laundry_issue_imported_member_card(m2,repeat('c',64),repeat('c',142));exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'inactive owner issues card';end if;
 execute 'reset role';
end;
$test$;
rollback;
