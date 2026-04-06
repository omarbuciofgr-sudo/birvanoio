
-- Team comments on leads
CREATE TABLE public.team_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.team_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view comments" ON public.team_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own comments" ON public.team_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.team_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.team_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_team_comments_updated_at BEFORE UPDATE ON public.team_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Team activity feed
CREATE TABLE public.team_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.team_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view activity" ON public.team_activity FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own activity" ON public.team_activity FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
