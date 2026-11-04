CREATE TABLE public.owner_contact_lookups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 listing_id text NOT NULL,
 status text NOT NULL DEFAULT 'pending',
 phone_found boolean NOT NULL DEFAULT false,
 email_found boolean NOT NULL DEFAULT false,
 credits_charged integer NOT NULL DEFAULT 0,
 free_lookup_used boolean NOT NULL DEFAULT false,
 error_code text,
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz
);
GRANT SELECT ON public.owner_contact_lookups TO authenticated;
GRANT ALL ON public.owner_contact_lookups TO service_role;
ALTER TABLE public.owner_contact_lookups ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_lookup_read ON public.owner_contact_lookups FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX owner_lookup_user_date ON public.owner_contact_lookups(user_id, created_at DESC);
CREATE UNIQUE INDEX owner_lookup_pending ON public.owner_contact_lookups(user_id, listing_id) WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.my_owner_lookup_allowance() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('is_free', COALESCE((SELECT w.plan_tier::text FROM workspaces w JOIN workspace_memberships m ON m.workspace_id=w.id WHERE m.user_id=auth.uid() LIMIT 1), 'free') = 'free',
 'total', COALESCE((SELECT (metadata->>'owner_lookups')::integer FROM pricing_settings WHERE setting_key='plan_free'),5),
 'used', (SELECT count(*) FROM owner_contact_lookups WHERE user_id=auth.uid() AND free_lookup_used),
 'attempted', EXISTS(SELECT 1 FROM owner_contact_lookups WHERE user_id=auth.uid() AND status NOT IN ('pending','blocked')))
 WHERE auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.my_owner_lookup_allowance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_owner_lookup_allowance() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.finish_owner_contact_lookup(p_id uuid, p_phone boolean, p_email boolean, p_listing jsonb DEFAULT NULL, p_error text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.owner_contact_lookups; v_tier text; v_total integer; v_used integer; v_charge jsonb; v_spent integer := 0; v_free boolean := false; v_cached boolean := false;
BEGIN
 SELECT * INTO a FROM owner_contact_lookups WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lookup not found'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('owner-lookups:' || a.user_id::text));
 SELECT * INTO a FROM owner_contact_lookups WHERE id=p_id FOR UPDATE;
 IF a.status <> 'pending' THEN RETURN jsonb_build_object('success', a.status='found' OR a.status='no_match','spent',a.credits_charged,'free_used',a.free_lookup_used); END IF;
 IF p_error IS NOT NULL THEN
  UPDATE owner_contact_lookups SET status='failed',error_code=p_error,completed_at=now() WHERE id=p_id;
  RETURN jsonb_build_object('success',false,'error',p_error,'spent',0);
 END IF;
 IF NOT p_phone AND NOT p_email THEN
  UPDATE owner_contact_lookups SET status='no_match',completed_at=now() WHERE id=p_id;
  RETURN jsonb_build_object('success',true,'spent',0,'free_used',false);
 END IF;
 SELECT COALESCE(w.plan_tier::text,'free') INTO v_tier FROM workspaces w JOIN workspace_memberships m ON m.workspace_id=w.id WHERE m.user_id=a.user_id LIMIT 1;
 SELECT COALESCE((metadata->>'owner_lookups')::integer,5) INTO v_total FROM pricing_settings WHERE setting_key='plan_free';
 v_total := COALESCE(v_total,5);
 SELECT count(*) INTO v_used FROM owner_contact_lookups WHERE user_id=a.user_id AND free_lookup_used;
 SELECT EXISTS(SELECT 1 FROM owner_contact_lookups WHERE user_id=a.user_id AND listing_id=a.listing_id AND status='found') INTO v_cached;
 IF NOT v_cached THEN
  IF COALESCE(v_tier,'free')='free' AND v_used < v_total THEN v_free:=true;
  ELSE
   v_charge := public.consume_action_credits_for_user(a.user_id,'action_owner_contact',1,a.listing_id);
   IF NOT (v_charge->>'success')::boolean THEN
    UPDATE owner_contact_lookups SET status='blocked', phone_found=p_phone,email_found=p_email,error_code='insufficient_credits',completed_at=now() WHERE id=p_id;
    RETURN jsonb_build_object('success',false,'error','insufficient_credits','spent',0);
   END IF;
   v_spent := COALESCE((v_charge->>'spent')::integer,0);
  END IF;
 END IF;
 UPDATE owner_contact_lookups SET status='found',phone_found=p_phone,email_found=p_email,credits_charged=v_spent,free_lookup_used=v_free,completed_at=now() WHERE id=p_id;
 IF p_listing IS NOT NULL THEN
  UPDATE owner_search_results SET listing_data=p_listing,updated_at=now() WHERE user_id=a.user_id AND external_id=a.listing_id;
 END IF;
 RETURN jsonb_build_object('success',true,'spent',v_spent,'free_used',v_free);
END;
$$;
REVOKE ALL ON FUNCTION public.finish_owner_contact_lookup(uuid,boolean,boolean,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_owner_contact_lookup(uuid,boolean,boolean,jsonb,text) TO service_role;