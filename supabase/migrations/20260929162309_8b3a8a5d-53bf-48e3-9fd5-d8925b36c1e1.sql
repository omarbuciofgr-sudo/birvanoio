ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_contact_goal integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS daily_followup_goal integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS streak_counts_weekends boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS timezone text;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_daily_goals_range
  CHECK (daily_contact_goal BETWEEN 1 AND 500 AND daily_followup_goal BETWEEN 1 AND 500);

CREATE OR REPLACE FUNCTION public.goal_day_counts(p_user_id uuid, p_tz text, p_days integer)
RETURNS TABLE(day date, contacted integer, followups integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE tz text := COALESCE(NULLIF(p_tz, ''), 'America/Chicago');
BEGIN
  BEGIN PERFORM now() AT TIME ZONE tz; EXCEPTION WHEN others THEN tz := 'America/Chicago'; END;
  RETURN QUERY
  WITH days AS (
    SELECT generate_series((now() AT TIME ZONE tz)::date - (LEAST(GREATEST(p_days,1),120) - 1), (now() AT TIME ZONE tz)::date, interval '1 day')::date AS d
  ), c AS (
    SELECT (cl.created_at AT TIME ZONE tz)::date AS d, count(DISTINCT cl.lead_id)::int AS n
    FROM conversation_logs cl
    WHERE cl.client_id = p_user_id AND COALESCE(cl.direction, 'outbound') = 'outbound'
      AND cl.created_at >= now() - make_interval(days => LEAST(GREATEST(p_days,1),120) + 1)
    GROUP BY 1
  ), f AS (
    SELECT (fu.done_at AT TIME ZONE tz)::date AS d, count(*)::int AS n
    FROM lead_follow_ups fu
    WHERE fu.user_id = p_user_id AND fu.done_at IS NOT NULL
      AND fu.done_at >= now() - make_interval(days => LEAST(GREATEST(p_days,1),120) + 1)
    GROUP BY 1
  )
  SELECT days.d, COALESCE(c.n, 0), COALESCE(f.n, 0)
  FROM days LEFT JOIN c ON c.d = days.d LEFT JOIN f ON f.d = days.d
  ORDER BY days.d;
END $$;

REVOKE EXECUTE ON FUNCTION public.goal_day_counts(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.goal_day_counts(uuid, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.my_goal_day_counts(p_tz text, p_days integer)
RETURNS TABLE(day date, contacted integer, followups integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM public.goal_day_counts(auth.uid(), p_tz, p_days) WHERE auth.uid() IS NOT NULL $$;

REVOKE EXECUTE ON FUNCTION public.my_goal_day_counts(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_goal_day_counts(text, integer) TO authenticated;