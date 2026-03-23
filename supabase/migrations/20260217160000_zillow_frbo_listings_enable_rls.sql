-- Enable RLS on zillow_frbo_listings (same pattern as redfin_listings, trulia_listings, hotpads_listings).
-- Run this if you created the table manually without RLS.

ALTER TABLE public.zillow_frbo_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to zillow_frbo_listings" ON public.zillow_frbo_listings;
CREATE POLICY "Service role full access to zillow_frbo_listings"
  ON public.zillow_frbo_listings FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read zillow_frbo_listings" ON public.zillow_frbo_listings;
CREATE POLICY "Authenticated users can read zillow_frbo_listings"
  ON public.zillow_frbo_listings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anon can read zillow_frbo_listings" ON public.zillow_frbo_listings;
CREATE POLICY "Anon can read zillow_frbo_listings"
  ON public.zillow_frbo_listings FOR SELECT TO anon USING (true);
