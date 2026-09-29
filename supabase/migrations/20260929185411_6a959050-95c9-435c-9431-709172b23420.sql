ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS latitude double precision, ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS map_view jsonb;

CREATE TABLE public.geocode_cache (
  address_key text PRIMARY KEY,
  latitude double precision,
  longitude double precision,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.geocode_cache TO authenticated;
GRANT ALL ON public.geocode_cache TO service_role;
ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read map positions" ON public.geocode_cache FOR SELECT TO authenticated USING (true);