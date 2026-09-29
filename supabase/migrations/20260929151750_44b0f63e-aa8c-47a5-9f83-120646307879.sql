CREATE TABLE public.property_estimates (
  address_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('sale','rental')),
  estimate numeric,
  range_low numeric,
  range_high numeric,
  listed_date date,
  days_on_market integer,
  price_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (address_key, kind)
);
GRANT ALL ON public.property_estimates TO service_role;
ALTER TABLE public.property_estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No client access" ON public.property_estimates FOR ALL TO authenticated USING (false) WITH CHECK (false);