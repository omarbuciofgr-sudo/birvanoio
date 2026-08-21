ALTER TABLE public.realtor_deals
  ADD COLUMN IF NOT EXISTS commission_pct numeric,
  ADD COLUMN IF NOT EXISTS commission_flat numeric,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS lease_end_date date,
  ADD COLUMN IF NOT EXISTS tour_at timestamptz,
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS referral_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.realtor_deal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  deal_id uuid NOT NULL REFERENCES public.realtor_deals(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'task',
  title text NOT NULL,
  scheduled_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.realtor_deal_events TO authenticated;
GRANT ALL ON public.realtor_deal_events TO service_role;
ALTER TABLE public.realtor_deal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own deal events"
ON public.realtor_deal_events FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS realtor_deal_events_deal_idx ON public.realtor_deal_events(deal_id);
CREATE INDEX IF NOT EXISTS realtor_deal_events_user_sched_idx ON public.realtor_deal_events(user_id, scheduled_at);

CREATE TRIGGER update_realtor_deal_events_updated_at
BEFORE UPDATE ON public.realtor_deal_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();