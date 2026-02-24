-- FSBO.com listings table: stores scraped ForSaleByOwner.com listings (same pattern as zillow_fsbo_listings, hotpads_listings).
-- Used by FSBO_Scraper (Selenium) and by /api/fsbo/last-result to show listings on the frontend.

CREATE TABLE IF NOT EXISTS public.fsbo_listings (
  id BIGSERIAL PRIMARY KEY,
  listing_url TEXT UNIQUE NOT NULL,
  address TEXT,
  price TEXT,
  bedrooms TEXT,
  bathrooms TEXT,
  square_feet TEXT,
  owner_name TEXT,
  owner_email TEXT,
  owner_phone TEXT,
  time_of_post TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fsbo_listings_id_desc ON public.fsbo_listings (id DESC);
CREATE INDEX IF NOT EXISTS idx_fsbo_listings_listing_url ON public.fsbo_listings (listing_url);

DROP TRIGGER IF EXISTS update_fsbo_listings_updated_at ON public.fsbo_listings;
CREATE TRIGGER update_fsbo_listings_updated_at
  BEFORE UPDATE ON public.fsbo_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.fsbo_listings IS 'Scraped FSBO.com listings; populated by FSBO_Scraper and shown via /api/fsbo/last-result.';
