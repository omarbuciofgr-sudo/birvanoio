-- Zillow FRBO listings table: stores scraped Zillow For Rent By Owner listings (same pattern as hotpads_listings, trulia_listings).
-- Used by Zillow_FRBO_Scraper pipeline and by /api/zillow-frbo/last-result to show listings on the frontend.

CREATE TABLE IF NOT EXISTS public.zillow_frbo_listings (
  id BIGSERIAL PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  zpid TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zipcode TEXT,
  asking_price TEXT,
  beds_baths TEXT,
  year_built TEXT,
  name TEXT,
  phone_number TEXT,
  agent_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zillow_frbo_listings_id_desc ON public.zillow_frbo_listings (id DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_frbo_listings_url ON public.zillow_frbo_listings (url);

DROP TRIGGER IF EXISTS update_zillow_frbo_listings_updated_at ON public.zillow_frbo_listings;
CREATE TRIGGER update_zillow_frbo_listings_updated_at
  BEFORE UPDATE ON public.zillow_frbo_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.zillow_frbo_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to zillow_frbo_listings"
  ON public.zillow_frbo_listings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read zillow_frbo_listings"
  ON public.zillow_frbo_listings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anon can read zillow_frbo_listings"
  ON public.zillow_frbo_listings FOR SELECT TO anon USING (true);

COMMENT ON TABLE public.zillow_frbo_listings IS 'Scraped Zillow FRBO listings; populated by Zillow_FRBO_Scraper and shown via /api/zillow-frbo/last-result.';
