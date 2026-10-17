-- Standalone QA transaction test for Stage 10. ALWAYS ROLLBACK.
-- Run only against mas-jawa-laundry-qa; never against customer Supabase.
BEGIN;
DO $qa$
DECLARE
 v_owner uuid := gen_random_uuid();
 v_owner2 uuid := gen_random_uuid();
 v_member uuid;
 v_card_old uuid;
 v_card_new uuid;
 v_card_retry uuid;
 v_req uuid := gen_random_uuid();
 v_old_digest text := encode(sha256(convert_to('qa-old-' || gen_random_uuid()::text,'UTF8')),'hex');
 v_new_digest text := encode(sha256(convert_to('qa-new-' || gen_random_uuid()::text,'UTF8')),'hex');
 v_other_digest text := encode(sha256(convert_to('qa-other-' || gen_random_uuid()::text,'UTF8')),'hex');
 v_old_cipher text := repeat('ac',60);
 v_new_cipher text := repeat('bd',60);
 v_denied boolean;
 v_created boolean;
BEGIN
 -- Test identities are non-login SQL fixtures with no passwords or real emails.
 INSERT INTO auth.users (id,aud,role) VALUES
   (v_owner,'authenticated','authenticated'),
   (v_owner2,'authenticated','authenticated');
 INSERT INTO public.laundry_owner_accounts(auth_user_id,is_active)
 VALUES (v_owner,true),(v_owner2,true);
 PERFORM set_config('request.jwt.claim.sub',v_owner::text,true);
 INSERT INTO public.laundry_members(display_name,created_by)
 VALUES ('Synthetic QA Member',v_owner) RETURNING id INTO v_member;
 INSERT INTO public.laundry_member_cards
    (member_id,token_digest,token_ciphertext,issued_by)
 VALUES (v_member,decode(v_old_digest,'hex'),decode(v_old_cipher,'hex'),v_owner)
 RETURNING id INTO v_card_old;

 IF (SELECT count(*) FROM public.laundry_public_card_progress(v_old_digest)) <> 1
 THEN RAISE EXCEPTION 'old test QR missing at start'; END IF;

 v_card_new := public.laundry_reissue_card(
   v_member,'QA replacement requested',v_new_digest,v_new_cipher,v_req);
 IF v_card_new IS NULL OR v_card_new=v_card_old
 THEN RAISE EXCEPTION 'new card was not issued'; END IF;
 IF (SELECT count(*) FROM public.laundry_member_cards
     WHERE member_id=v_member AND revoked_at IS NULL) <> 1
 THEN RAISE EXCEPTION 'active-card uniqueness failed'; END IF;
 IF (SELECT revoked_at IS NULL FROM public.laundry_member_cards
     WHERE id=v_card_old)
 THEN RAISE EXCEPTION 'old card was not revoked'; END IF;
 IF (SELECT count(*) FROM public.laundry_public_card_progress(v_old_digest)) <> 0
 THEN RAISE EXCEPTION 'revoked QR remains public'; END IF;
 IF (SELECT count(*) FROM public.laundry_public_card_progress(v_new_digest)) <> 1
 THEN RAISE EXCEPTION 'replacement QR not public'; END IF;

 v_card_retry := public.laundry_reissue_card(
   v_member,'QA replacement requested',v_other_digest,v_new_cipher,v_req);
 IF v_card_retry <> v_card_new OR
    (SELECT count(*) FROM public.laundry_card_reissues WHERE member_id=v_member) <> 1
 THEN RAISE EXCEPTION 'same-key retry created extra card'; END IF;

 v_denied := false;
 BEGIN
   PERFORM public.laundry_reissue_card(
     v_member,'Different reason',v_other_digest,v_new_cipher,v_req);
 EXCEPTION WHEN SQLSTATE '23505' THEN v_denied:=true;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'reason-conflict accepted'; END IF;

 PERFORM set_config('request.jwt.claim.sub',v_owner2::text,true);
 v_denied := false;
 BEGIN
   PERFORM public.laundry_reissue_card(
     v_member,'QA replacement requested',v_other_digest,v_new_cipher,v_req);
 EXCEPTION WHEN SQLSTATE '23505' THEN v_denied:=true;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'other actor reused request'; END IF;

 PERFORM set_config('request.jwt.claim.sub','',true);
 v_denied := false;
 BEGIN
   PERFORM public.laundry_reissue_card(
     v_member,'No session',v_other_digest,v_new_cipher,gen_random_uuid());
 EXCEPTION WHEN SQLSTATE '42501' THEN v_denied:=true;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'anon was authorized'; END IF;

 PERFORM set_config('request.jwt.claim.sub',v_owner::text,true);
 v_denied := false;
 BEGIN
   PERFORM public.laundry_initialize_point_year(2028);
 EXCEPTION WHEN SQLSTATE '22023' THEN v_denied:=true;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'out-of-range 2028 initialized in 2026'; END IF;
 IF public.laundry_initialize_point_year(2027) IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'existing point year overwritten'; END IF;
 DELETE FROM public.laundry_point_rules WHERE program_year=2027;
 v_created := public.laundry_initialize_point_year(2027);
 IF v_created IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'new year was not initialized'; END IF;
 IF (SELECT a.tiers<>b.tiers FROM public.laundry_point_rules a
     JOIN public.laundry_point_rules b ON b.program_year=2026
     WHERE a.program_year=2027)
 THEN RAISE EXCEPTION 'year bootstrap changed tiers'; END IF;
 IF public.laundry_initialize_point_year(2027) IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'idempotent point setup failed'; END IF;
END
$qa$;
SELECT 'PASS: card lifecycle, old/new token, idempotency, owner checks, WIB year guards' AS qa_stage10_result;
ROLLBACK;