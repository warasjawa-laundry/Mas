-- QA-only privilege test; zero persistent test users/member records.
BEGIN;
DO $qa$
DECLARE
  owner_id uuid := gen_random_uuid();
  member_id uuid;
  card_id uuid;
  request_id uuid := gen_random_uuid();
  previous_digest text := encode(sha256(convert_to('qa-original-'||gen_random_uuid()::text,'UTF8')),'hex');
  replacement_digest text := encode(sha256(convert_to('qa-replacement-'||gen_random_uuid()::text,'UTF8')),'hex');
  denied boolean;
BEGIN
  INSERT INTO auth.users(id,role,aud) VALUES (owner_id,'authenticated','authenticated');
  INSERT INTO public.laundry_owner_accounts(auth_user_id,is_active) VALUES (owner_id,true);
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  INSERT INTO public.laundry_members(display_name,created_by)
    VALUES ('Isolated QA Role Test',owner_id) RETURNING id INTO member_id;
  INSERT INTO public.laundry_member_cards(member_id,token_digest,token_ciphertext,issued_by)
    VALUES (member_id,decode(previous_digest,'hex'),decode(repeat('ee',60),'hex'),owner_id);

  EXECUTE 'SET LOCAL ROLE authenticated';
  IF current_user <> 'authenticated' THEN RAISE EXCEPTION 'role switch failed'; END IF;
  IF (SELECT count(*) FROM public.laundry_members WHERE id=member_id) <> 1
  THEN RAISE EXCEPTION 'authorized owner RLS cannot read member'; END IF;
  EXECUTE format(
    'select public.laundry_reissue_card(%L::uuid,%L,%L,%L,%L::uuid)',
    member_id,'QA card replacement',replacement_digest,repeat('ab',60),request_id
  ) INTO card_id;
  IF card_id IS NULL THEN RAISE EXCEPTION 'authenticated role failed RPC'; END IF;

  denied := false;
  BEGIN
    EXECUTE 'select count(*) from public.laundry_card_reissues';
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'authenticated role could read audit journal'; END IF;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub','',true);
  EXECUTE 'SET LOCAL ROLE anon';
  denied := false;
  BEGIN
    EXECUTE format(
      'select public.laundry_reissue_card(%L::uuid,%L,%L,%L,%L::uuid)',
      member_id,'QA invalid anonymous access',replacement_digest,repeat('ab',60),gen_random_uuid()
    );
  EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'anonymous was able to execute owner RPC'; END IF;
  EXECUTE 'RESET ROLE';
END
$qa$;
SELECT 'PASS: impersonated authenticated/anon role privileges and owner RLS' AS qa_roles_result;
ROLLBACK;