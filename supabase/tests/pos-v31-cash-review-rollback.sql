begin;
set local statement_timeout='30s';
create temporary table v31_review_historical_journal on commit drop as select * from public.laundry_pos_cash_ledger;
do $test$
declare owner_v uuid:=gen_random_uuid();request_v uuid:=gen_random_uuid();legacy_v uuid:=gen_random_uuid();entry_v uuid;foreign_v uuid;outlet_v uuid;
 staff_v uuid;name_v text;device_v text:=repeat('v',43);login_v text:=repeat('w',43);
 result_v jsonb;again_v jsonb;cash_v jsonb;detail_v jsonb;report_v jsonb;
 family_v uuid:=gen_random_uuid();service_v uuid;order_v uuid;payment_entry_v uuid;refund_entry_v uuid;
 note_v text;direction_v text;category_v text;i integer;
begin
 insert into auth.users(id,aud,role) values(owner_v,'authenticated','authenticated');
 insert into public.laundry_owner_accounts(auth_user_id,is_active) values(owner_v,true);
 perform set_config('request.jwt.claim.sub',owner_v::text,true);
 update public.laundry_pos_outlets set active=true,write_enabled=true,finance_enabled=true,pilot_test_only=true,package_workflow_enabled=true;
 outlet_v:=laundry_private.pos_owner_outlet();

 -- Transfer is one drawer movement. Its destination/source is mandatory metadata, not another account balance.
 foreach direction_v in array array['IN','OUT'] loop
  foreach note_v in array array['','Bank','Sumber: ab','Tujuan: ab',case direction_v when 'IN' then 'Tujuan: Bank' else 'Sumber: Bank' end,E'Sumber: Bank\n',repeat('x',301),
   case direction_v when 'IN' then 'Sumber: ' else 'Tujuan: ' end||'| Catatan: pembelian',
   case direction_v when 'IN' then 'Sumber: ' else 'Tujuan: ' end||'   | Catatan: pembelian',
   case direction_v when 'IN' then 'Sumber: ' else 'Tujuan: ' end||'ab | Catatan: pembelian',
   case direction_v when 'IN' then 'Sumber: ' else 'Tujuan: ' end||'ab|Catatan: pembelian'] loop
   begin
    perform public.laundry_pos_v31_cash_entry(gen_random_uuid(),direction_v,'100','CASH_TRANSFER',note_v);
    raise exception 'invalid transfer accepted: % / %',direction_v,note_v;
   exception when invalid_parameter_value then null;end;
  end loop;
  perform public.laundry_pos_v31_cash_entry(gen_random_uuid(),direction_v,'1','CASH_TRANSFER',
   case direction_v when 'IN' then 'Sumber: ' else 'Tujuan: ' end||'Bank uji | Catatan: pembelian');
 end loop;
 result_v:=public.laundry_pos_v31_cash_entry(request_v,'OUT','100','CASH_TRANSFER','Tujuan: Bank uji');
 if (select note from public.laundry_pos_cash_ledger where command_id=request_v)<>'Perpindahan uang laci (satu sisi)' then raise exception 'new transfer raw journal label ambiguous';end if;
 again_v:=public.laundry_pos_v31_cash_entry(request_v,'OUT','100','CASH_TRANSFER','Tujuan: Bank uji');
 if result_v<>again_v or (select count(*) from public.laundry_pos_cash_ledger where command_id=request_v)<>1 then raise exception 'transfer retry duplicated or changed';end if;
 select id into entry_v from public.laundry_pos_cash_ledger where command_id=request_v;
 detail_v:=public.laundry_pos_cash_entry_detail(entry_v);
 if detail_v->>'expense_category_label'<>'Perpindahan uang laci (satu sisi)' or detail_v->>'note'<>'Tujuan: Bank uji'
  or detail_v->>'accounting_classification'<>'TRANSFER' or detail_v->>'amount_idr'<>'100' then raise exception 'single-sided transfer contract wrong';end if;
 begin perform public.laundry_pos_v31_cash_entry(request_v,'OUT','100','CASH_TRANSFER','Tujuan: Kas lain');raise exception 'transfer retry changed metadata';exception when unique_violation then null;end;
 perform public.laundry_pos_v31_cash_entry(gen_random_uuid(),'IN','100','CASH_TRANSFER','Sumber: Bank uji');
 perform public.laundry_pos_v31_cash_entry(gen_random_uuid(),'IN','100','CAPITAL','Modal uji');

 -- Simulate a completed pre-closure typed request, with its original core digest and optional free note.
 result_v:=public.laundry_pos_v3_finance('CASH_ENTRY',legacy_v,null,'75',null,null,'Transfer antar kas','OUT');
 insert into laundry_private.pos_v31_cash_metadata values(legacy_v,'CASH_TRANSFER','Catatan lama');
 again_v:=public.laundry_pos_v31_cash_entry(legacy_v,'OUT','75','CASH_TRANSFER','Catatan lama');
 if result_v<>again_v or (select count(*) from public.laundry_pos_cash_ledger where command_id=legacy_v)<>1
  or (select note from public.laundry_pos_cash_ledger where command_id=legacy_v)<>'Transfer antar kas'
  or (select note from laundry_private.pos_v31_cash_metadata where request_id=legacy_v)<>'Catatan lama' then raise exception 'legacy typed transfer retry altered history';end if;
 begin perform public.laundry_pos_v31_cash_entry(legacy_v,'OUT','76','CASH_TRANSFER','Catatan lama');raise exception 'legacy retry amount changed';exception when unique_violation then null;end;
 begin perform public.laundry_pos_v31_cash_entry(legacy_v,'IN','75','CASH_TRANSFER','Catatan lama');raise exception 'legacy retry direction changed';exception when unique_violation then null;end;
 begin perform public.laundry_pos_v31_cash_entry(legacy_v,'OUT','75','CASH_TRANSFER','Different old note');raise exception 'legacy retry metadata changed';exception when unique_violation then null;end;

 perform public.laundry_pos_save_package('REGULAR',(select revision from public.laundry_pos_duration_packages where code='REGULAR'),'Reguler',4320,true);
 perform public.laundry_pos_save_family(family_v,0,'{"name":"QA review kg","category":"QA review","unit":"kg","position":1,"active":true}',
  '[{"code":"REGULAR","price_idr":"6000","active":true},{"code":"EXPRESS","price_idr":"0","active":false},{"code":"FLASH","price_idr":"0","active":false}]');
 select id into service_v from public.laundry_services where family_id=family_v and duration_package_code='REGULAR';
 order_v:=(public.laundry_pos_owner_create_order(gen_random_uuid(),'UJI - V31 review',null,
  jsonb_build_array(jsonb_build_object('service_id',service_v,'quantity','2','revision',1)),null,null)->>'order_id')::uuid;
 perform public.laundry_pos_v3_finance('PAYMENT',gen_random_uuid(),order_v,'12000','QRIS',1);
 select l.id into payment_entry_v from public.laundry_pos_cash_ledger l join public.laundry_pos_payments p on p.id=l.payment_id where p.order_id=order_v;
 perform public.laundry_pos_v3_finance('FULL_REFUND',gen_random_uuid(),order_v,null,null,2,'QA review refund');
 select l.id into refund_entry_v from public.laundry_pos_cash_ledger l join public.laundry_pos_payments p on p.id=l.payment_id where p.order_id=order_v and p.entry_type='REFUND';
 detail_v:=public.laundry_pos_cash_entry_detail(refund_entry_v);
 if detail_v->>'method'<>'QRIS' or detail_v->>'quantity_summary'<>'2 kg' or detail_v->'quantities_milli'->>'kg'<>'2000' or detail_v->>'item_count'<>'1' then raise exception 'owner refund detail lost method or summary';end if;

 staff_v:=public.laundry_pos_owner_save_cashier(null,'QA V31 review cashier','{"cash_view":true,"cash_entry":true,"reports_view":false,"order_view":false}',true);
 select username into name_v from public.laundry_pos_staff where staff_id=staff_v;

 -- Create a genuine foreign row in this rollback-only fixture despite the single-outlet production constraint.
 alter table public.laundry_pos_outlets drop constraint laundry_pos_outlets_only_one;
 insert into public.laundry_pos_outlets(code,name,active,write_enabled,finance_enabled,pilot_test_only)
  values('QAREVIEW','QA foreign outlet',true,true,true,true) returning id into foreign_v;
 perform laundry_private.pos_v3_auto_cash(owner_v,null,foreign_v);
 result_v:=laundry_private.pos_cash_entry_core(owner_v,null,foreign_v,gen_random_uuid(),'OUT','1','QA foreign entry');
 select id into foreign_v from public.laundry_pos_cash_ledger where outlet_id=foreign_v;
 update public.laundry_pos_outlets set active=false,write_enabled=false where id<>outlet_v;
 begin perform public.laundry_pos_cash_entry_detail(foreign_v);raise exception 'owner cross-outlet entry exposed';exception when no_data_found then null;end;

 perform set_config('request.jwt.claim.sub','',true);
 if not public.laundry_pos_cashier_direct_id_login(name_v,device_v,login_v) then raise exception 'cashier login failed';end if;
 foreach category_v in array array['CAPITAL','CASH_TRANSFER'] loop
  foreach direction_v in array array['IN','OUT'] loop
   begin perform public.laundry_pos_v31_cash_entry(gen_random_uuid(),direction_v,'10',category_v,case direction_v when 'IN' then 'Sumber: Bank' else 'Tujuan: Bank' end,device_v,login_v);
    raise exception 'cashier forged sensitive category accepted';exception when insufficient_privilege then null;end;
  end loop;
 end loop;
 begin perform public.laundry_pos_v31_cash_entry(legacy_v,'OUT','75','CASH_TRANSFER','Catatan lama',device_v,login_v);raise exception 'cashier legacy transfer retry accepted';exception when insufficient_privilege then null;end;
 perform public.laundry_pos_v31_cash_entry(gen_random_uuid(),'OUT','1','OTHER','QA allowed',device_v,login_v);
 cash_v:=public.laundry_pos_v3_cash(device_v,login_v);
 if exists(select 1 from jsonb_array_elements(cash_v->'entries')e where e ?| array['item_count','quantities_milli','quantity_summary'] or e->>'customer' is not null or e->>'can_view_order'='true') then raise exception 'cash-only overview exposed order data';end if;
 detail_v:=public.laundry_pos_cash_entry_detail(payment_entry_v,device_v,login_v);
 if detail_v ?| array['item_count','quantities_milli','quantity_summary'] or detail_v->>'customer' is not null or detail_v->>'can_view_order'<>'false' or detail_v->>'method'<>'QRIS' then raise exception 'cash-only detail exposed order data';end if;
 begin perform public.laundry_pos_v3_report(clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour',device_v,login_v);raise exception 'cash-only reports leak';exception when insufficient_privilege then null;end;
 begin perform public.laundry_pos_cash_entry_detail(foreign_v,device_v,login_v);raise exception 'cashier cross-outlet entry exposed';exception when no_data_found then null;end;
 begin perform public.laundry_pos_cash_entry_detail(gen_random_uuid(),device_v,login_v);raise exception 'unknown UUID exposed';exception when no_data_found then null;end;
 begin perform public.laundry_pos_cash_entry_detail(entry_v,repeat('x',43),repeat('z',43));raise exception 'invalid session accepted';exception when insufficient_privilege then null;end;
 begin perform public.laundry_pos_cash_entry_detail(entry_v);raise exception 'anonymous detail accepted';exception when insufficient_privilege then null;end;

 perform set_config('request.jwt.claim.sub',owner_v::text,true);
 update public.laundry_pos_staff_outlets set permissions=permissions||'{"reports_view":true}'::jsonb where staff_id=staff_v;
 report_v:=public.laundry_pos_v3_report(clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour',device_v,login_v);
 if not exists(select 1 from jsonb_array_elements(report_v->'cash')e where e->>'order_id'=order_v::text and e->>'quantity_summary'='2 kg') then raise exception 'explicit reports grant lost quantities';end if;
 update public.laundry_pos_staff_outlets set permissions=permissions||'{"order_view":true}'::jsonb where staff_id=staff_v;
 detail_v:=public.laundry_pos_cash_entry_detail(payment_entry_v,device_v,login_v);
 if detail_v->>'quantity_summary'<>'2 kg' or detail_v->>'customer'<>'UJI - V31 review' then raise exception 'authorized cashier detail lost order fields';end if;
 update public.laundry_pos_staff_outlets set permissions=permissions||'{"order_view":false}'::jsonb where staff_id=staff_v;
 for i in 1..81 loop perform public.laundry_pos_v31_cash_entry(gen_random_uuid(),'OUT','1','OTHER','QA recent entry');end loop;
 cash_v:=public.laundry_pos_v3_cash();
 if jsonb_array_length(cash_v->'entries')<>80 or exists(select 1 from jsonb_array_elements(cash_v->'entries')e where e->>'id'=entry_v::text) then raise exception 'old fixture did not leave recent window';end if;
 detail_v:=public.laundry_pos_cash_entry_detail(entry_v);
 if detail_v->>'id'<>entry_v::text or detail_v->>'amount_idr'<>'100' then raise exception 'owner historical lookup failed';end if;
 detail_v:=public.laundry_pos_cash_entry_detail(entry_v,device_v,login_v);
 if detail_v->>'id'<>entry_v::text then raise exception 'cashier historical lookup failed';end if;
 report_v:=public.laundry_pos_v3_report(clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour');
 if not exists(select 1 from jsonb_array_elements(report_v->'cash')e where e->>'order_id'=order_v::text and e->>'quantity_summary'='2 kg') then raise exception 'owner reports lost authorized quantities';end if;
 update public.laundry_pos_staff set active=false where staff_id=staff_v;
 begin perform public.laundry_pos_cash_entry_detail(entry_v,device_v,login_v);raise exception 'inactive cashier accepted';exception when insufficient_privilege then null;end;
 execute 'set local role anon';
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.laundry_pos_cash_entry_detail(entry_v);raise exception 'anon role accepted';exception when insufficient_privilege then null;end;
 execute 'reset role';
 if exists(select to_jsonb(h) from v31_review_historical_journal h except select to_jsonb(l) from public.laundry_pos_cash_ledger l) then raise exception 'historical journal changed';end if;
end;$test$;
rollback;
