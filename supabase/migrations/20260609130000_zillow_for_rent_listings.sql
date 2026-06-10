-- Zillow For Rent listings (all rental SERP), separate from zillow_frbo_listings.

CREATE TABLE IF NOT EXISTS public.zillow_for_rent_listings (
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
  description TEXT,
  search_city TEXT,
  search_state TEXT,
  search_location TEXT,
  source_platform TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zillow_for_rent_listings_id_desc ON public.zillow_for_rent_listings (id DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_for_rent_listings_url ON public.zillow_for_rent_listings (url);
CREATE INDEX IF NOT EXISTS idx_zillow_for_rent_search_city_state ON public.zillow_for_rent_listings (search_city, search_state);

DROP TRIGGER IF EXISTS update_zillow_for_rent_listings_updated_at ON public.zillow_for_rent_listings;
CREATE TRIGGER update_zillow_for_rent_listings_updated_at
  BEFORE UPDATE ON public.zillow_for_rent_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.zillow_for_rent_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to zillow_for_rent_listings" ON public.zillow_for_rent_listings;
CREATE POLICY "Service role full access to zillow_for_rent_listings"
  ON public.zillow_for_rent_listings FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read zillow_for_rent_listings" ON public.zillow_for_rent_listings;
CREATE POLICY "Authenticated users can read zillow_for_rent_listings"
  ON public.zillow_for_rent_listings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anon can read zillow_for_rent_listings" ON public.zillow_for_rent_listings;
CREATE POLICY "Anon can read zillow_for_rent_listings"
  ON public.zillow_for_rent_listings FOR SELECT TO anon USING (true);

COMMENT ON TABLE public.zillow_for_rent_listings IS 'Scraped Zillow for-rent city SERP listings; shown via /api/zillow-for-rent/last-result.';
