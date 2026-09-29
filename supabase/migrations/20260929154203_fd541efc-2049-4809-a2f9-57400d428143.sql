ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS brokerage text, ADD COLUMN IF NOT EXISTS agent_photo_path text;
ALTER TABLE public.property_estimates ADD COLUMN IF NOT EXISTS comparables jsonb;

INSERT INTO public.pricing_settings (setting_key, setting_type, label, credits, is_active)
VALUES ('action_market_report', 'action', 'Owner market report', 3, true)
ON CONFLICT (setting_key) DO NOTHING;

CREATE TABLE public.market_reports (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.market_reports TO authenticated;
GRANT ALL ON public.market_reports TO service_role;
ALTER TABLE public.market_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own reports" ON public.market_reports FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Agents read own photo" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'agent-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Agents upload own photo" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'agent-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Agents update own photo" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'agent-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Agents delete own photo" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'agent-photos' AND (storage.foldername(name))[1] = auth.uid()::text);