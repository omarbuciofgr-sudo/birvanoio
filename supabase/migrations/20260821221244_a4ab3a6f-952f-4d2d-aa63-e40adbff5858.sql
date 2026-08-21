ALTER TABLE public.realtor_deal_events
  ADD COLUMN IF NOT EXISTS signal_key text,
  ADD COLUMN IF NOT EXISTS calendar_event_id text,
  ADD COLUMN IF NOT EXISTS calendar_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS outcome_at timestamptz,
  ADD COLUMN IF NOT EXISTS body text;

CREATE INDEX IF NOT EXISTS realtor_deal_events_signal_key_idx ON public.realtor_deal_events (user_id, signal_key);