-- Trulia scrape source: fsbo_lt SERP vs full-city /ST/City/ SERP.
-- By-owner fetch prefers scrape_serp_type = 'fsbo' rows (matches Trulia FSBO card count).

ALTER TABLE public.trulia_listings
  ADD COLUMN IF NOT EXISTS scrape_serp_type TEXT;

COMMENT ON COLUMN public.trulia_listings.scrape_serp_type IS
  'fsbo = /for_sale/{City},{ST}/fsbo_lt/ SERP; full_city = /{ST}/{City}/ general for-sale SERP.';

CREATE INDEX IF NOT EXISTS idx_trulia_scrape_serp_type
  ON public.trulia_listings (scrape_serp_type)
  WHERE scrape_serp_type IS NOT NULL;
