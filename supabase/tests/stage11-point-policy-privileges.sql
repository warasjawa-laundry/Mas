-- Runs on isolated QA or ephemeral CI DB after Stage 11 migration.
-- Asserts browser roles cannot modify point policy while scoring stays live.
DO $test$
DECLARE
  v_role text;
  v_function text;
  v_privilege text;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    FOREACH v_function IN ARRAY ARRAY[
      'public.laundry_set_point_rules(integer,jsonb,integer)',
      'laundry_private.set_point_rules(integer,jsonb,integer)',
      'public.laundry_initialize_point_year(integer)',
      'laundry_private.initialize_point_year(integer)'
    ] LOOP
      IF has_function_privilege(v_role,v_function,'EXECUTE') THEN
        RAISE EXCEPTION 'point policy function available to application role %',v_role;
      END IF;
    END LOOP;
    FOREACH v_privilege IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE'] LOOP
      IF has_table_privilege(v_role,'public.laundry_point_rules',v_privilege) THEN
        RAISE EXCEPTION 'point policy table writable by application role %',v_role;
      END IF;
    END LOOP;
  END LOOP;
  IF NOT has_table_privilege('authenticated','public.laundry_point_rules','SELECT')
    OR NOT has_function_privilege('authenticated',
      'public.laundry_record_amount_visit(uuid,bigint,text,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'transaction scoring or rule reading was accidentally disabled';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.laundry_point_rules WHERE program_year=2026)
    OR NOT EXISTS (SELECT 1 FROM public.laundry_point_rules WHERE program_year=2027) THEN
    RAISE EXCEPTION 'existing yearly point rules missing';
  END IF;
END
$test$;
SELECT 'PASS: API roles denied rule mutation; owner scoring & rule reading preserved' AS policy_result;
