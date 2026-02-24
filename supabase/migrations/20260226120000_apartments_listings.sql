-- Apartments.com FRBO listings table (same pattern as fsbo_listings, hotpads_listings).
-- Used by Apartments_Scraper pipeline and by /api/apartments/last-result on the frontend.

CREATE TABLE IF NOT EXISTS public.apartments_listings (
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
  title TEXT,
  neighborhood TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apartments_listings_id_desc ON public.apartments_listings (id DESC);
CREATE INDEX IF NOT EXISTS idx_apartments_listings_listing_url ON public.apartments_listings (listing_url);

DROP TRIGGER IF EXISTS update_apartments_listings_updated_at ON public.apartments_listings;
CREATE TRIGGER update_apartments_listings_updated_at
  BEFORE UPDATE ON public.apartments_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.apartments_listings IS 'Scraped Apartments.com FRBO listings; populated by Apartments_Scraper and shown via /api/apartments/last-result.';
