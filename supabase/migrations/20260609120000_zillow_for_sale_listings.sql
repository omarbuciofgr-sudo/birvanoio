-- Zillow For Sale listings (all agent + FSBO for-sale SERP), separate from zillow_fsbo_listings.

CREATE TABLE IF NOT EXISTS public.zillow_for_sale_listings (
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
  search_city TEXT,
  search_state TEXT,
  search_location TEXT,
  source_platform TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zillow_for_sale_listings_id_desc ON public.zillow_for_sale_listings (id DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_for_sale_listings_detail_url ON public.zillow_for_sale_listings (detail_url);
CREATE INDEX IF NOT EXISTS idx_zillow_for_sale_search_city_state ON public.zillow_for_sale_listings (search_city, search_state);

DROP TRIGGER IF EXISTS update_zillow_for_sale_listings_updated_at ON public.zillow_for_sale_listings;
CREATE TRIGGER update_zillow_for_sale_listings_updated_at
  BEFORE UPDATE ON public.zillow_for_sale_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.zillow_for_sale_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to zillow_for_sale_listings" ON public.zillow_for_sale_listings;
CREATE POLICY "Service role full access to zillow_for_sale_listings"
  ON public.zillow_for_sale_listings FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read zillow_for_sale_listings" ON public.zillow_for_sale_listings;
CREATE POLICY "Authenticated users can read zillow_for_sale_listings"
  ON public.zillow_for_sale_listings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anon can read zillow_for_sale_listings" ON public.zillow_for_sale_listings;
CREATE POLICY "Anon can read zillow_for_sale_listings"
  ON public.zillow_for_sale_listings FOR SELECT TO anon USING (true);

COMMENT ON TABLE public.zillow_for_sale_listings IS 'Scraped Zillow for-sale city SERP listings; shown via /api/zillow-for-sale/last-result.';
