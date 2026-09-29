ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_market text;

CREATE TABLE public.free_search_grants (
  user_id uuid PRIMARY KEY,
  used_at timestamptz NOT NULL DEFAULT now(),
  search_location text
);
GRANT SELECT ON public.free_search_grants TO authenticated;
GRANT ALL ON public.free_search_grants TO service_role;
ALTER TABLE public.free_search_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own free search grant" ON public.free_search_grants FOR SELECT TO authenticated
  USING (auth.uid() = user_id);