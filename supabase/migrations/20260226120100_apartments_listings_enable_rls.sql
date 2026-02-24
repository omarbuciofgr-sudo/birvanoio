-- Enable RLS on apartments_listings.

ALTER TABLE public.apartments_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to apartments_listings"
  ON public.apartments_listings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read apartments_listings"
  ON public.apartments_listings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anon can read apartments_listings"
  ON public.apartments_listings FOR SELECT TO anon USING (true);
