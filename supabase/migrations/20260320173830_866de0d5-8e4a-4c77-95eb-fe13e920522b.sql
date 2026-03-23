
-- Dynamic prospect lists with auto-refresh
CREATE TABLE public.dynamic_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  search_type TEXT NOT NULL DEFAULT 'company' CHECK (search_type IN ('company', 'people', 'jobs', 'technology', 'lookalike')),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  auto_refresh BOOLEAN NOT NULL DEFAULT false,
  refresh_frequency TEXT DEFAULT 'weekly' CHECK (refresh_frequency IN ('daily', 'weekly', 'monthly')),
  last_refreshed_at TIMESTAMPTZ,
  result_count INTEGER DEFAULT 0,
  cached_results JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dynamic_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own dynamic lists"
  ON public.dynamic_lists
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_dynamic_lists_updated_at
  BEFORE UPDATE ON public.dynamic_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
