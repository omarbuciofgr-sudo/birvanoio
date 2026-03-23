-- Redfin listings table: stores scraped Redfin FSBO listings (same pattern as hotpads_listings, trulia_listings).
-- Used by Redfin_Scraper pipeline and by /api/redfin/last-result to show listings on the frontend.

CREATE TABLE IF NOT EXISTS public.redfin_listings (
  id BIGSERIAL PRIMARY KEY,
  listing_link TEXT UNIQUE NOT NULL,
  address TEXT,
  price TEXT,
  beds INTEGER,
  baths DOUBLE PRECISION,
  square_feet INTEGER,
  owner_name TEXT,
  mailing_address TEXT,
  scrape_date TEXT,
  emails TEXT,
  phones TEXT,
  property_type TEXT,
  county TEXT,
  lot_acres TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_redfin_listings_id_desc ON public.redfin_listings (id DESC);
CREATE INDEX IF NOT EXISTS idx_redfin_listings_listing_link ON public.redfin_listings (listing_link);

DROP TRIGGER IF EXISTS update_redfin_listings_updated_at ON public.redfin_listings;
CREATE TRIGGER update_redfin_listings_updated_at
  BEFORE UPDATE ON public.redfin_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.redfin_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to redfin_listings"
  ON public.redfin_listings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read redfin_listings"
  ON public.redfin_listings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anon can read redfin_listings"
  ON public.redfin_listings FOR SELECT TO anon USING (true);

COMMENT ON TABLE public.redfin_listings IS 'Scraped Redfin FSBO listings; populated by Redfin_Scraper and shown via /api/redfin/last-result.';
