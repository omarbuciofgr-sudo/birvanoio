-- Enable RLS on zillow_fsbo_listings (same pattern as zillow_frbo_listings, redfin_listings).
-- Run this if you created the table manually with the schema (id, detail_url, address, bedrooms, bathrooms, price, home_type, year_build, hoa, days_on_zillow, page_view_count, favorite_count, phone_number, owner_name, created_at, updated_at).

ALTER TABLE public.zillow_fsbo_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to zillow_fsbo_listings" ON public.zillow_fsbo_listings;
CREATE POLICY "Service role full access to zillow_fsbo_listings"
  ON public.zillow_fsbo_listings FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read zillow_fsbo_listings" ON public.zillow_fsbo_listings;
CREATE POLICY "Authenticated users can read zillow_fsbo_listings"
  ON public.zillow_fsbo_listings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anon can read zillow_fsbo_listings" ON public.zillow_fsbo_listings;
CREATE POLICY "Anon can read zillow_fsbo_listings"
  ON public.zillow_fsbo_listings FOR SELECT TO anon USING (true);
