CREATE TABLE public.pricing_settings (
  setting_key text PRIMARY KEY,
  setting_type text NOT NULL CHECK (setting_type IN ('plan', 'action', 'addon', 'cache')),
  label text NOT NULL,
  credits integer,
  monthly_credits_per_seat integer,
  ai_messages_per_seat integer,
  price_cents integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pricing_settings TO anon, authenticated;
GRANT ALL ON public.pricing_settings TO service_role;
ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active pricing settings"
ON public.pricing_settings FOR SELECT
TO anon, authenticated
USING (is_active = true);
CREATE POLICY "Administrators can manage pricing settings"
ON public.pricing_settings FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER update_pricing_settings_updated_at
BEFORE UPDATE ON public.pricing_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.pricing_settings
(setting_key, setting_type, label, credits, monthly_credits_per_seat, ai_messages_per_seat, price_cents, metadata)
VALUES
('plan_free', 'plan', 'Free', NULL, 50, 20, 0, '{"description":"Try with no commitment.","owner_lookups":5}'::jsonb),
('plan_starter', 'plan', 'Starter', NULL, 1000, 300, 4900, '{"description":"For solo agents","owner_lookups":100}'::jsonb),
('plan_growth', 'plan', 'Growth', NULL, 2500, 1000, 9900, '{"description":"For busy agents and small teams","owner_lookups":250}'::jsonb),
('plan_scale', 'plan', 'Scale', NULL, 7500, 3000, 24900, '{"description":"For brokerages and property management companies","owner_lookups":750}'::jsonb),
('action_city_search', 'action', 'City search', 1, NULL, NULL, NULL, '{}'::jsonb),
('action_owner_contact', 'action', 'Successful owner contact lookup', 10, NULL, NULL, NULL, '{"charge_only_on_match":true}'::jsonb),
('action_ai_message', 'action', 'AI-written message', 0, NULL, NULL, NULL, '{"fair_use":true}'::jsonb),
('action_sms', 'action', 'SMS message', 1, NULL, NULL, NULL, '{}'::jsonb),
('action_voice_minute', 'action', 'Voice calling per started minute', 10, NULL, NULL, NULL, '{}'::jsonb),
('action_email', 'action', 'Email message', 0, NULL, NULL, NULL, '{}'::jsonb),
('addon_500', 'addon', '500 add-on credits', 500, NULL, NULL, 2500, '{}'::jsonb),
('cache_city_search', 'cache', 'City search cache', NULL, NULL, NULL, NULL, '{"ttl_hours":24}'::jsonb);

CREATE TABLE public.ai_message_usage (
  user_id uuid NOT NULL,
  period_start date NOT NULL,
  messages_used integer NOT NULL DEFAULT 0 CHECK (messages_used >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period_start)
);
GRANT SELECT ON public.ai_message_usage TO authenticated;
GRANT ALL ON public.ai_message_usage TO service_role;
ALTER TABLE public.ai_message_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own AI message usage"
ON public.ai_message_usage FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "Administrators can view AI message usage"
ON public.ai_message_usage FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER update_ai_message_usage_updated_at
BEFORE UPDATE ON public.ai_message_usage
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.consume_action_credits(
  p_action_key text,
  p_units integer DEFAULT 1,
  p_reference_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_unit_cost integer;
  v_total integer;
  v_workspace_id uuid;
  v_period_start date := date_trunc('month', now())::date;
  v_period_end date := (date_trunc('month', now()) + interval '1 month - 1 day')::date;
  v_remaining integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_units < 1 OR p_units > 10000 THEN RAISE EXCEPTION 'Invalid unit count'; END IF;

  SELECT credits INTO v_unit_cost
  FROM public.pricing_settings
  WHERE setting_key = p_action_key AND setting_type = 'action' AND is_active = true;
  IF v_unit_cost IS NULL THEN RAISE EXCEPTION 'Unknown credit action'; END IF;
  v_total := v_unit_cost * p_units;

  IF v_total = 0 THEN
    RETURN jsonb_build_object('success', true, 'spent', 0);
  END IF;

  v_workspace_id := public.get_user_workspace_id(v_user_id);
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'Workspace required'; END IF;

  INSERT INTO public.user_monthly_credits
    (user_id, workspace_id, period_start, period_end, monthly_allowance, credits_used, topup_credits)
  VALUES
    (v_user_id, v_workspace_id, v_period_start, v_period_end,
     COALESCE((SELECT monthly_credits_per_seat FROM public.pricing_settings WHERE setting_key = 'plan_free'), 50), 0, 0)
  ON CONFLICT (user_id, period_start) DO NOTHING;

  UPDATE public.user_monthly_credits
  SET credits_used = credits_used + v_total, updated_at = now()
  WHERE user_id = v_user_id
    AND period_start <= CURRENT_DATE
    AND period_end >= CURRENT_DATE
    AND credits_used + v_total <= monthly_allowance + topup_credits
  RETURNING monthly_allowance + topup_credits - credits_used INTO v_remaining;

  IF v_remaining IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits', 'required', v_total);
  END IF;

  INSERT INTO public.credit_usage (user_id, action, credits_spent, reference_id)
  VALUES (v_user_id, replace(p_action_key, 'action_', ''), v_total, p_reference_id);

  RETURN jsonb_build_object('success', true, 'spent', v_total, 'remaining', v_remaining);
END;
$$;
REVOKE ALL ON FUNCTION public.consume_action_credits(text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_action_credits(text, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.consume_ai_message()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_period_start date := date_trunc('month', now())::date;
  v_tier text;
  v_seats integer := 1;
  v_limit integer;
  v_used integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT COALESCE(subscription_tier::text, 'free') INTO v_tier
  FROM public.profiles WHERE user_id = v_user_id LIMIT 1;
  v_tier := COALESCE(v_tier, 'free');

  SELECT GREATEST(COUNT(*) FILTER (WHERE role <> 'viewer'::public.workspace_role), 1)::integer
  INTO v_seats
  FROM public.workspace_memberships
  WHERE workspace_id = public.get_user_workspace_id(v_user_id);

  SELECT ai_messages_per_seat * v_seats INTO v_limit
  FROM public.pricing_settings
  WHERE setting_key = 'plan_' || v_tier AND is_active = true;
  v_limit := COALESCE(v_limit, 20);

  INSERT INTO public.ai_message_usage (user_id, period_start, messages_used)
  VALUES (v_user_id, v_period_start, 1)
  ON CONFLICT (user_id, period_start) DO UPDATE
  SET messages_used = public.ai_message_usage.messages_used + 1,
      updated_at = now()
  WHERE public.ai_message_usage.messages_used < v_limit
  RETURNING messages_used INTO v_used;

  IF v_used IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ai_message_limit', 'used', v_limit, 'limit', v_limit);
  END IF;
  RETURN jsonb_build_object('success', true, 'used', v_used, 'limit', v_limit);
END;
$$;
REVOKE ALL ON FUNCTION public.consume_ai_message() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_ai_message() TO authenticated;