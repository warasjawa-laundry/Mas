begin;
do $$
begin
 if (select amount_idr from laundry_private.pos_delivery_options where code='NEAR')<>3000 then raise exception 'wrong NEAR price';end if;
 if (select amount_idr from laundry_private.pos_delivery_options where code='FAR')<>7000 then raise exception 'wrong FAR price';end if;
 if (select count(*) from laundry_private.pos_delivery_options where active)<>4 then raise exception 'delivery menu incomplete';end if;
 if not exists (select 1 from pg_attribute where attrelid='public.laundry_pos_orders'::regclass and attname='delivery_fee_idr' and not attisdropped) then raise exception 'snapshot missing';end if;
 if to_regprocedure('public.laundry_pos_owner_create_order_with_delivery(uuid,text,text,jsonb,text,text,text,bigint)') is null then raise exception 'owner route missing';end if;
 if to_regprocedure('public.laundry_pos_g4_create_order_with_delivery(text,text,uuid,text,text,jsonb,text,text,text,bigint)') is null then raise exception 'cashier route missing';end if;
 if has_table_privilege('anon','laundry_private.pos_delivery_options','SELECT') then raise exception 'delivery price table exposed';end if;
 if has_function_privilege('anon','public.laundry_pos_owner_create_order_with_delivery(uuid,text,text,jsonb,text,text,text,bigint)','EXECUTE') then raise exception 'owner RPC exposed';end if;
end;$$;
rollback;
