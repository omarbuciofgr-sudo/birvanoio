ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS booking_url text;

CREATE TABLE public.booking_integrations (
  user_id uuid PRIMARY KEY,
  provider text NOT NULL DEFAULT 'calcom',
  webhook_token text NOT NULL UNIQUE,
  signing_secret text NOT NULL,
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.booking_integrations TO authenticated;
GRANT ALL ON public.booking_integrations TO service_role;
ALTER TABLE public.booking_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own booking connection" ON public.booking_integrations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users remove their own booking connection" ON public.booking_integrations FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.booking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  external_id text NOT NULL,
  lead_id uuid,
  starts_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_id)
);
GRANT SELECT ON public.booking_events TO authenticated;
GRANT ALL ON public.booking_events TO service_role;
ALTER TABLE public.booking_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own bookings" ON public.booking_events FOR SELECT TO authenticated USING (auth.uid() = user_id);