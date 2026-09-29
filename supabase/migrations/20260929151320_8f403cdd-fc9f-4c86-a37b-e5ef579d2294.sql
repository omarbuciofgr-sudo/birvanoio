CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

ALTER TABLE public.pricing_settings ADD COLUMN IF NOT EXISTS saved_search_limit integer;
UPDATE public.pricing_settings SET saved_search_limit = 1 WHERE setting_key = 'plan_free';
UPDATE public.pricing_settings SET saved_search_limit = 3 WHERE setting_key = 'plan_starter';
UPDATE public.pricing_settings SET saved_search_limit = 10 WHERE setting_key = 'plan_growth';
UPDATE public.pricing_settings SET saved_search_limit = 25 WHERE setting_key IN ('plan_scale','plan_enterprise');
INSERT INTO public.pricing_settings (setting_key, setting_type, label, credits, is_active)
VALUES ('action_saved_search_alert', 'action', 'Daily saved search alert', 1, true)
ON CONFLICT (setting_key) DO NOTHING;

CREATE TABLE public.owner_search_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  location text NOT NULL,
  listing_type text NOT NULL DEFAULT 'both',
  match_level text NOT NULL DEFAULT 'best',
  timezone text NOT NULL DEFAULT 'America/Chicago',
  is_active boolean NOT NULL DEFAULT true,
  baseline_done boolean NOT NULL DEFAULT false,
  last_run_date date,
  last_sent_at timestamptz,
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT owner_search_alerts_type_chk CHECK (listing_type IN ('sale','rental','both')),
  CONSTRAINT owner_search_alerts_match_chk CHECK (match_level IN ('best','all'))
);
CREATE INDEX owner_search_alerts_active_idx ON public.owner_search_alerts (is_active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_search_alerts TO authenticated;
GRANT ALL ON public.owner_search_alerts TO service_role;
ALTER TABLE public.owner_search_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own search alerts" ON public.owner_search_alerts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_owner_search_alerts_updated_at BEFORE UPDATE ON public.owner_search_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Users can't flip server-managed fields.
CREATE OR REPLACE FUNCTION public.protect_owner_search_alert_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tier text; v_limit integer; v_count integer;
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.user_id := OLD.user_id;
    NEW.unsubscribe_token := OLD.unsubscribe_token;
    NEW.last_run_date := OLD.last_run_date;
    NEW.last_sent_at := OLD.last_sent_at;
    IF NEW.location IS DISTINCT FROM OLD.location OR NEW.listing_type IS DISTINCT FROM OLD.listing_type
       OR NEW.match_level IS DISTINCT FROM OLD.match_level THEN
      NEW.baseline_done := false;
    ELSE
      NEW.baseline_done := OLD.baseline_done;
    END IF;
    IF NEW.is_active AND NOT OLD.is_active THEN
      -- resuming counts toward the limit
      NULL;
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    NEW.baseline_done := false;
    NEW.last_run_date := NULL;
    NEW.last_sent_at := NULL;
    NEW.unsubscribe_token := gen_random_uuid();
  END IF;
  SELECT COALESCE(subscription_tier::text, 'free') INTO v_tier FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;
  SELECT saved_search_limit INTO v_limit FROM public.pricing_settings WHERE setting_key = 'plan_' || COALESCE(v_tier, 'free');
  v_limit := COALESCE(v_limit, 1);
  SELECT count(*) INTO v_count FROM public.owner_search_alerts WHERE user_id = NEW.user_id AND is_active AND id <> NEW.id;
  IF NEW.is_active AND v_count >= v_limit THEN
    RAISE EXCEPTION 'SAVED_SEARCH_LIMIT: Your plan allows % active saved searches. Upgrade for more.', v_limit;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.protect_owner_search_alert_fields() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_owner_search_alert_fields BEFORE INSERT OR UPDATE ON public.owner_search_alerts
  FOR EACH ROW EXECUTE FUNCTION public.protect_owner_search_alert_fields();

CREATE TABLE public.owner_alert_seen (
  alert_id uuid NOT NULL REFERENCES public.owner_search_alerts(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alert_id, external_id)
);
GRANT ALL ON public.owner_alert_seen TO service_role;
ALTER TABLE public.owner_alert_seen ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.city_search_cache (
  location_key text NOT NULL,
  listing_type text NOT NULL,
  fetched_on date NOT NULL,
  listings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_key, listing_type, fetched_on)
);
GRANT ALL ON public.city_search_cache TO service_role;
ALTER TABLE public.city_search_cache ENABLE ROW LEVEL SECURITY;

-- Private token the scheduled job uses to call the alerts function.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS private.job_tokens (name text PRIMARY KEY, token text NOT NULL);
REVOKE ALL ON private.job_tokens FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT SELECT ON private.job_tokens TO service_role;
INSERT INTO private.job_tokens (name, token)
VALUES ('owner_alerts', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_job_token(p_name text, p_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS (SELECT 1 FROM private.job_tokens WHERE name = p_name AND token = p_token);
$$;
REVOKE ALL ON FUNCTION public.verify_job_token(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_job_token(text, text) TO service_role;