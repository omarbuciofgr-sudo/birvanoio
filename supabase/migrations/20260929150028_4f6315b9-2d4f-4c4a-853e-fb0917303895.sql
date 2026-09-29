CREATE TABLE public.ai_settings (
  setting_key text PRIMARY KEY,
  setting_value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_settings TO authenticated;
GRANT ALL ON public.ai_settings TO service_role;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage AI settings" ON public.ai_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.ai_settings (setting_key, setting_value) VALUES ('claude_model', 'claude-sonnet-4-5')
ON CONFLICT (setting_key) DO NOTHING;

CREATE TABLE public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task text NOT NULL,
  model text,
  lead_id uuid,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  success boolean NOT NULL DEFAULT true,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_logs_user_created_idx ON public.ai_usage_logs (user_id, created_at DESC);
GRANT SELECT ON public.ai_usage_logs TO authenticated;
GRANT ALL ON public.ai_usage_logs TO service_role;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own AI logs" ON public.ai_usage_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

UPDATE public.pricing_settings SET ai_messages_per_seat = 20 WHERE setting_key = 'plan_free';
UPDATE public.pricing_settings SET ai_messages_per_seat = 300 WHERE setting_key = 'plan_starter';
UPDATE public.pricing_settings SET ai_messages_per_seat = 1000 WHERE setting_key = 'plan_growth';
UPDATE public.pricing_settings SET ai_messages_per_seat = 3000 WHERE setting_key IN ('plan_scale','plan_enterprise');