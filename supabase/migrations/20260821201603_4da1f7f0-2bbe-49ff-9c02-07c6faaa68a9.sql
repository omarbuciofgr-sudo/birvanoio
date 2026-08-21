CREATE INDEX IF NOT EXISTS idx_persona_events_variant
  ON public.persona_events ((metadata->>'variant'));

CREATE OR REPLACE FUNCTION public.get_persona_experiment_analytics()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH exposure AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    metadata->>'variant' AS variant,
    created_at AS first_seen
  FROM public.persona_events
  WHERE event_type = 'recommendation_shown'
    AND metadata->>'variant' IS NOT NULL
  ORDER BY user_id, created_at
),
applied AS (
  SELECT DISTINCT user_id
  FROM public.persona_events
  WHERE event_type = 'recommendation_applied'
),
conv AS (
  SELECT e.user_id, COUNT(*)::int AS conversions
  FROM public.persona_events e
  JOIN exposure x ON x.user_id = e.user_id
  WHERE e.event_type = 'conversion'
    AND e.created_at >= x.first_seen
  GROUP BY e.user_id
),
variants AS (
  SELECT
    x.variant AS id,
    COUNT(*)::int AS users,
    COUNT(*) FILTER (WHERE a.user_id IS NOT NULL)::int AS applied_users,
    COUNT(*) FILTER (WHERE COALESCE(c.conversions, 0) > 0)::int AS converted_users,
    COALESCE(SUM(c.conversions), 0)::int AS conversions
  FROM exposure x
  LEFT JOIN applied a ON a.user_id = x.user_id
  LEFT JOIN conv c ON c.user_id = x.user_id
  GROUP BY x.variant
)
SELECT jsonb_build_object(
  'total_exposed', (SELECT COUNT(*)::int FROM exposure),
  'variants', COALESCE((SELECT jsonb_agg(to_jsonb(variants)) FROM variants), '[]'::jsonb)
);
$function$;

GRANT EXECUTE ON FUNCTION public.get_persona_experiment_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_persona_experiment_analytics() TO service_role;