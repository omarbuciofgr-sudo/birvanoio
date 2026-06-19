-- Apartments.com listing identity: owner vs PM/managed + scrape source SERP type.
-- Enables fetch by ac_strict_signal instead of re-running PM heuristics on every load.

ALTER TABLE public.apartments_listings
  ADD COLUMN IF NOT EXISTS ac_strict_signal TEXT,
  ADD COLUMN IF NOT EXISTS scrape_serp_type TEXT;

COMMENT ON COLUMN public.apartments_listings.ac_strict_signal IS
  'owner | managed | unknown — set at scrape save time (Apartments.com FRBO vs full-city SERP).';

COMMENT ON COLUMN public.apartments_listings.scrape_serp_type IS
  'frbo = /for-rent-by-owner/ SERP; full_city = general city rentals SERP.';

CREATE INDEX IF NOT EXISTS idx_apartments_ac_strict_signal
  ON public.apartments_listings (ac_strict_signal)
  WHERE ac_strict_signal IS NOT NULL;
