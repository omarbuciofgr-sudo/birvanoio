-- Enable RLS on fsbo_listings (table created in previous migration).

ALTER TABLE public.fsbo_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to fsbo_listings"
  ON public.fsbo_listings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read fsbo_listings"
  ON public.fsbo_listings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anon can read fsbo_listings"
  ON public.fsbo_listings FOR SELECT TO anon USING (true);
