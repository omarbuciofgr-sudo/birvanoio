CREATE TABLE IF NOT EXISTS public.persona_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  persona_role TEXT,
  persona_goals TEXT[] NOT NULL DEFAULT '{}',
  event_type TEXT NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_persona_events_user ON public.persona_events(user_id);
CREATE INDEX IF NOT EXISTS idx_persona_events_role ON public.persona_events(persona_role);
CREATE INDEX IF NOT EXISTS idx_persona_events_type ON public.persona_events(event_type);

GRANT SELECT, INSERT ON public.persona_events TO authenticated;
GRANT ALL ON public.persona_events TO service_role;

ALTER TABLE public.persona_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own persona events"
  ON public.persona_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read their own persona events"
  ON public.persona_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all persona events"
  ON public.persona_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_persona_analytics()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH users AS (
  SELECT
    p.user_id,
    p.persona_role,
    COALESCE(p.persona_goals, '{}')::text[] AS persona_goals,
    COALESCE((SELECT COUNT(*) FROM public.persona_events e
              WHERE e.user_id = p.user_id AND e.event_type = 'activation'), 0) AS activations,
    COALESCE((SELECT COUNT(*) FROM public.persona_events e
              WHERE e.user_id = p.user_id AND e.event_type = 'conversion'), 0) AS conversions
  FROM public.profiles p
  WHERE p.persona_role IS NOT NULL
),
roles AS (
  SELECT persona_role AS id,
         COUNT(*)::int AS users,
         COUNT(*) FILTER (WHERE activations > 0)::int AS activated_users,
         COUNT(*) FILTER (WHERE conversions > 0)::int AS converted_users,
         COALESCE(SUM(conversions), 0)::int AS conversions
  FROM users GROUP BY persona_role
),
goals AS (
  SELECT g AS id,
         u.persona_role AS role,
         COUNT(*)::int AS users,
         COUNT(*) FILTER (WHERE u.activations > 0)::int AS activated_users,
         COUNT(*) FILTER (WHERE u.conversions > 0)::int AS converted_users,
         COALESCE(SUM(u.conversions), 0)::int AS conversions
  FROM users u, unnest(u.persona_goals) AS g
  GROUP BY g, u.persona_role
)
SELECT jsonb_build_object(
  'total_users', (SELECT COUNT(*)::int FROM users),
  'roles', COALESCE((SELECT jsonb_agg(to_jsonb(roles)) FROM roles), '[]'::jsonb),
  'goals', COALESCE((SELECT jsonb_agg(to_jsonb(goals)) FROM goals), '[]'::jsonb)
);
$$;

REVOKE ALL ON FUNCTION public.get_persona_analytics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_persona_analytics() TO authenticated, service_role;