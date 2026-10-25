ALTER TABLE public.conversation_logs ADD COLUMN IF NOT EXISTS call_date date, ADD COLUMN IF NOT EXISTS next_step text, ADD COLUMN IF NOT EXISTS follow_up_date date;
CREATE INDEX IF NOT EXISTS conversation_logs_user_calls ON public.conversation_logs (client_id, type, created_at DESC);
CREATE OR REPLACE FUNCTION public.log_tracked_call(p_lead_id uuid, p_outcome text, p_call_date date DEFAULT NULL, p_note text DEFAULT NULL, p_next_step text DEFAULT NULL, p_follow_up_date date DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); tz text; today date; record_id uuid; blocked boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Please sign in.'; END IF;
  SELECT timezone INTO tz FROM public.profiles WHERE user_id = uid;
  today := (now() AT TIME ZONE COALESCE(NULLIF(tz, ''), 'America/Chicago'))::date;
  IF p_outcome NOT IN ('no_answer','voicemail','conversation','not_interested','appointment_set','do_not_call') OR p_outcome IS NULL THEN RAISE EXCEPTION 'Choose a call outcome.'; END IF;
  IF COALESCE(p_call_date, today) > today THEN RAISE EXCEPTION 'Call date cannot be in the future.'; END IF;
  SELECT do_not_contact INTO blocked FROM public.leads WHERE id = p_lead_id AND client_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not available.'; END IF;
  IF p_follow_up_date IS NOT NULL AND p_follow_up_date < COALESCE(p_call_date, today) THEN RAISE EXCEPTION 'Follow-up cannot be before the call.'; END IF;
  INSERT INTO public.conversation_logs (client_id, lead_id, type, direction, outcome, content, call_date, next_step, follow_up_date)
  VALUES (uid, p_lead_id, 'call', 'outbound', p_outcome, NULLIF(left(trim(p_note),500),''), COALESCE(p_call_date,today), CASE WHEN p_outcome = 'do_not_call' THEN 'Do not contact' ELSE NULLIF(left(trim(p_next_step),1000),'') END, CASE WHEN p_outcome = 'do_not_call' OR blocked THEN NULL ELSE p_follow_up_date END)
  RETURNING id INTO record_id;
  IF p_outcome = 'do_not_call' THEN
    UPDATE public.leads SET do_not_contact = true, do_not_contact_at = now(), do_not_contact_reason = 'Asked not to be called' WHERE id = p_lead_id AND client_id = uid;
  ELSIF p_outcome = 'appointment_set' THEN
    UPDATE public.leads SET status = 'appointment_set' WHERE id = p_lead_id AND client_id = uid;
  END IF;
  IF p_follow_up_date IS NOT NULL AND p_outcome <> 'do_not_call' AND NOT COALESCE(blocked,false) THEN
    INSERT INTO public.lead_follow_ups (user_id, lead_id, due_date, note, channel)
    VALUES (uid, p_lead_id, p_follow_up_date, COALESCE(NULLIF(left(trim(p_next_step),1000),''), NULLIF(left(trim(p_note),500),''), replace(p_outcome,'_',' ')), 'call');
  END IF;
  RETURN record_id;
END $$;
REVOKE ALL ON FUNCTION public.log_tracked_call(uuid,text,date,text,text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_tracked_call(uuid,text,date,text,text,date) TO authenticated;
CREATE OR REPLACE FUNCTION public.goal_day_counts(p_user_id uuid, p_tz text, p_days integer)
RETURNS TABLE(day date, contacted integer, followups integer) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE tz text := COALESCE(NULLIF(p_tz, ''), 'America/Chicago');
BEGIN
  BEGIN PERFORM now() AT TIME ZONE tz; EXCEPTION WHEN others THEN tz := 'America/Chicago'; END;
  RETURN QUERY
  WITH days AS (
    SELECT generate_series((now() AT TIME ZONE tz)::date - (LEAST(GREATEST(p_days,1),120) - 1), (now() AT TIME ZONE tz)::date, interval '1 day')::date AS d
  ), c AS (
    SELECT COALESCE(cl.call_date, (cl.created_at AT TIME ZONE tz)::date) AS d, count(DISTINCT cl.lead_id)::int AS n
    FROM public.conversation_logs cl WHERE cl.client_id = p_user_id AND COALESCE(cl.direction,'outbound') = 'outbound'
    AND COALESCE(cl.call_date,(cl.created_at AT TIME ZONE tz)::date) >= (now() AT TIME ZONE tz)::date - LEAST(GREATEST(p_days,1),120)
    GROUP BY 1
  ), f AS (
    SELECT (fu.done_at AT TIME ZONE tz)::date AS d, count(*)::int AS n FROM public.lead_follow_ups fu
    WHERE fu.user_id = p_user_id AND fu.done_at IS NOT NULL AND fu.done_at >= now() - make_interval(days => LEAST(GREATEST(p_days,1),120) + 1) GROUP BY 1
  ) SELECT days.d, COALESCE(c.n,0), COALESCE(f.n,0) FROM days LEFT JOIN c ON c.d = days.d LEFT JOIN f ON f.d = days.d ORDER BY days.d;
END $$;