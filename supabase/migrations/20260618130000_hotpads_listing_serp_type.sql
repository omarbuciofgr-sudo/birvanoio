-- Hotpads scrape source: /for-rent-by-owner SERP vs full-city rentals SERP.
-- By-owner fetch prefers scrape_serp_type = 'frbo' rows (matches Hotpads FRBO card count).

ALTER TABLE public.hotpads_listings
  ADD COLUMN IF NOT EXISTS scrape_serp_type TEXT;

COMMENT ON COLUMN public.hotpads_listings.scrape_serp_type IS
  'frbo = /for-rent-by-owner SERP; full_city = general city rentals SERP.';

CREATE INDEX IF NOT EXISTS idx_hotpads_scrape_serp_type
  ON public.hotpads_listings (scrape_serp_type)
  WHERE scrape_serp_type IS NOT NULL;
