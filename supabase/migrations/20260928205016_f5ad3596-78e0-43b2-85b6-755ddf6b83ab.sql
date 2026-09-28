REVOKE EXECUTE ON FUNCTION public.consume_action_credits(text, integer, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_action_credits(text, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_action_credits(text, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_ai_message() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_ai_message() FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_ai_message() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.consume_action_credits_for_user(
  p_user_id uuid,
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
  v_unit_cost integer;
  v_total integer;
  v_workspace_id uuid;
  v_period_start date := date_trunc('month', now())::date;
  v_period_end date := (date_trunc('month', now()) + interval '1 month - 1 day')::date;
  v_remaining integer;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'User required'; END IF;
  IF p_units < 1 OR p_units > 10000 THEN RAISE EXCEPTION 'Invalid unit count'; END IF;
  SELECT credits INTO v_unit_cost FROM public.pricing_settings
  WHERE setting_key = p_action_key AND setting_type = 'action' AND is_active = true;
  IF v_unit_cost IS NULL THEN RAISE EXCEPTION 'Unknown credit action'; END IF;
  v_total := v_unit_cost * p_units;
  IF v_total = 0 THEN RETURN jsonb_build_object('success', true, 'spent', 0); END IF;
  v_workspace_id := public.get_user_workspace_id(p_user_id);
  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'Workspace required'; END IF;
  INSERT INTO public.user_monthly_credits
    (user_id, workspace_id, period_start, period_end, monthly_allowance, credits_used, topup_credits)
  VALUES
    (p_user_id, v_workspace_id, v_period_start, v_period_end,
     COALESCE((SELECT monthly_credits_per_seat FROM public.pricing_settings WHERE setting_key = 'plan_free'), 50), 0, 0)
  ON CONFLICT (user_id, period_start) DO NOTHING;
  UPDATE public.user_monthly_credits
  SET credits_used = credits_used + v_total, updated_at = now()
  WHERE user_id = p_user_id AND period_start <= CURRENT_DATE AND period_end >= CURRENT_DATE
    AND credits_used + v_total <= monthly_allowance + topup_credits
  RETURNING monthly_allowance + topup_credits - credits_used INTO v_remaining;
  IF v_remaining IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits', 'required', v_total);
  END IF;
  INSERT INTO public.credit_usage (user_id, action, credits_spent, reference_id)
  VALUES (p_user_id, replace(p_action_key, 'action_', ''), v_total, p_reference_id);
  RETURN jsonb_build_object('success', true, 'spent', v_total, 'remaining', v_remaining);
END;
$$;
REVOKE ALL ON FUNCTION public.consume_action_credits_for_user(uuid, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_action_credits_for_user(uuid, text, integer, text) TO service_role;

CREATE OR REPLACE FUNCTION public.consume_ai_message_for_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start date := date_trunc('month', now())::date;
  v_tier text;
  v_seats integer := 1;
  v_limit integer;
  v_used integer;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'User required'; END IF;
  SELECT COALESCE(subscription_tier::text, 'free') INTO v_tier FROM public.profiles WHERE user_id = p_user_id LIMIT 1;
  v_tier := COALESCE(v_tier, 'free');
  SELECT GREATEST(COUNT(*) FILTER (WHERE role <> 'viewer'::public.workspace_role), 1)::integer INTO v_seats
  FROM public.workspace_memberships WHERE workspace_id = public.get_user_workspace_id(p_user_id);
  SELECT ai_messages_per_seat * v_seats INTO v_limit FROM public.pricing_settings
  WHERE setting_key = 'plan_' || v_tier AND is_active = true;
  v_limit := COALESCE(v_limit, 20);
  INSERT INTO public.ai_message_usage (user_id, period_start, messages_used)
  VALUES (p_user_id, v_period_start, 1)
  ON CONFLICT (user_id, period_start) DO UPDATE
  SET messages_used = public.ai_message_usage.messages_used + 1, updated_at = now()
  WHERE public.ai_message_usage.messages_used < v_limit
  RETURNING messages_used INTO v_used;
  IF v_used IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ai_message_limit', 'used', v_limit, 'limit', v_limit);
  END IF;
  RETURN jsonb_build_object('success', true, 'used', v_used, 'limit', v_limit);
END;
$$;
REVOKE ALL ON FUNCTION public.consume_ai_message_for_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_message_for_user(uuid) TO service_role;