-- Trulia listings table: stores scraped Trulia FSBO listings (same pattern as hotpads_listings).
-- Used by Trulia_Scraper pipeline and by /api/trulia/last-result to show listings on the frontend.

CREATE TABLE IF NOT EXISTS public.trulia_listings (
  id BIGSERIAL PRIMARY KEY,
  listing_link TEXT UNIQUE NOT NULL,
  address TEXT,
  price TEXT,
  beds INTEGER,
  baths DOUBLE PRECISION,
  owner_name TEXT,
  phones TEXT,
  emails TEXT,
  mailing_address TEXT,
  square_feet INTEGER,
  property_type TEXT,
  lot_size TEXT,
  description TEXT,
  scrape_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for ordering by newest (backend last-result uses order by id desc)
CREATE INDEX IF NOT EXISTS idx_trulia_listings_id_desc ON public.trulia_listings (id DESC);

-- Trigger to auto-update updated_at (drop first so migration is re-runnable)
DROP TRIGGER IF EXISTS update_trulia_listings_updated_at ON public.trulia_listings;
CREATE TRIGGER update_trulia_listings_updated_at
  BEFORE UPDATE ON public.trulia_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: enable so policies apply (service_role bypasses RLS)
ALTER TABLE public.trulia_listings ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (backend scraper and API use service key)
CREATE POLICY "Service role full access to trulia_listings"
  ON public.trulia_listings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow authenticated users (e.g. admin) to read Trulia listings for frontend
CREATE POLICY "Authenticated users can read trulia_listings"
  ON public.trulia_listings FOR SELECT TO authenticated USING (true);

-- Allow anon read if your frontend uses anon key for public listing display
CREATE POLICY "Anon can read trulia_listings"
  ON public.trulia_listings FOR SELECT TO anon USING (true);

COMMENT ON TABLE public.trulia_listings IS 'Scraped Trulia FSBO listings; populated by Trulia_Scraper and shown via /api/trulia/last-result.';
