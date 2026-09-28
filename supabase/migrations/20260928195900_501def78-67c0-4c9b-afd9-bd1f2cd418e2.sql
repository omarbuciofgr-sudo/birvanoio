CREATE TABLE public.owner_search_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  search_location text NOT NULL,
  listing_kind text,
  listing_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_search_results TO authenticated;
GRANT ALL ON public.owner_search_results TO service_role;

ALTER TABLE public.owner_search_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their saved owner results"
ON public.owner_search_results FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can save owner results"
ON public.owner_search_results FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their saved owner results"
ON public.owner_search_results FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their saved owner results"
ON public.owner_search_results FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX owner_search_results_user_location_idx
ON public.owner_search_results (user_id, search_location, updated_at DESC);

CREATE TRIGGER update_owner_search_results_updated_at
BEFORE UPDATE ON public.owner_search_results
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();