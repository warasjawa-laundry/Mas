begin;
set local statement_timeout='20s';
do $test$
declare owner_id uuid:=gen_random_uuid(); member_id uuid; batch jsonb; row_id uuid; n integer;
begin
 insert into auth.users(id,aud,role) values(owner_id,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(owner_id,true);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 insert into public.laundry_members(display_name,created_by) values('Import Audit QA',owner_id) returning id into member_id;
 batch:=public.laundry_pos_g6b_import_preview('BINATU',repeat('f',64),jsonb_build_array(
  jsonb_build_object('row','1','invoice','BNT-AUDIT-QA','customer','Import Audit QA','payment','PAID','status','ANTRIAN','total','10000','paid','10000')));
 select id into strict row_id from public.laundry_pos_import_rows where batch_id=(batch->>'batch_id')::uuid;
 perform public.laundry_pos_g6b_review_row(row_id,null,'CONFLICT','Identitas ditinjau');
 perform public.laundry_pos_g6b_review_row(row_id,member_id,'MATCHED','Identitas diperiksa');
 select count(*) into n from laundry_private.pos_import_review_audit where import_row_id=row_id;
 if n<>2 then raise exception 'review decisions were overwritten: %',n;end if;
 perform public.laundry_pos_g6b_review_row(row_id,member_id,'MATCHED','Identitas diperiksa');
 if (select count(*) from laundry_private.pos_import_review_audit where import_row_id=row_id)<>2 then raise exception 'exact review retry duplicated audit';end if;
 begin
  perform public.laundry_pos_g6b_import_preview('BINATU',repeat('e',64),jsonb_build_array(
   jsonb_build_object('row','1','invoice','BNT-UNKNOWN-QA','customer','Import Audit QA','payment','PAID','status','LAINNYA','total','10000','paid','10000')));
  raise exception 'unknown/cancelled status accepted as paid';
 exception when invalid_parameter_value then null;end;
 begin
  update laundry_private.pos_import_review_audit set reason='ubah' where import_row_id=row_id;
  raise exception 'audit update accepted';
 exception when insufficient_privilege then null;end;
 if has_table_privilege('authenticated','laundry_private.pos_import_review_audit','select') then raise exception 'audit PII exposed';end if;
 if exists(select 1 from public.laundry_pos_payments) or exists(select 1 from public.laundry_pos_point_links) then raise exception 'import posted finance';end if;
end;$test$;
rollback;
