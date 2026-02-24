-- Zillow FSBO listings table: stores scraped Zillow For Sale By Owner listings (same pattern as hotpads_listings, zillow_frbo_listings).
-- Used by Zillow_FSBO_Scraper pipeline and by /api/zillow-fsbo/last-result to show listings on the frontend.

CREATE TABLE IF NOT EXISTS public.zillow_fsbo_listings (
  id BIGSERIAL PRIMARY KEY,
  detail_url TEXT UNIQUE NOT NULL,
  address TEXT,
  bedrooms TEXT,
  bathrooms TEXT,
  price TEXT,
  home_type TEXT,
  year_build TEXT,
  hoa TEXT,
  days_on_zillow TEXT,
  page_view_count TEXT,
  favorite_count TEXT,
  phone_number TEXT,
  owner_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zillow_fsbo_listings_id_desc ON public.zillow_fsbo_listings (id DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_fsbo_listings_detail_url ON public.zillow_fsbo_listings (detail_url);

DROP TRIGGER IF EXISTS update_zillow_fsbo_listings_updated_at ON public.zillow_fsbo_listings;
CREATE TRIGGER update_zillow_fsbo_listings_updated_at
  BEFORE UPDATE ON public.zillow_fsbo_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.zillow_fsbo_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to zillow_fsbo_listings"
  ON public.zillow_fsbo_listings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read zillow_fsbo_listings"
  ON public.zillow_fsbo_listings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anon can read zillow_fsbo_listings"
  ON public.zillow_fsbo_listings FOR SELECT TO anon USING (true);

COMMENT ON TABLE public.zillow_fsbo_listings IS 'Scraped Zillow FSBO listings; populated by Zillow_FSBO_Scraper and shown via /api/zillow-fsbo/last-result.';
