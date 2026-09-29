CREATE TABLE public.follow_up_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('fsbo','frbo','custom')),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_up_plans TO authenticated;
GRANT ALL ON public.follow_up_plans TO service_role;
ALTER TABLE public.follow_up_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own plans" ON public.follow_up_plans FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER follow_up_plans_updated BEFORE UPDATE ON public.follow_up_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.follow_up_plan_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.follow_up_plans(id) ON DELETE CASCADE,
  day integer NOT NULL CHECK (day BETWEEN 1 AND 365),
  channel text NOT NULL CHECK (channel IN ('text','call','email')),
  instruction text,
  market_report boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_up_plan_steps TO authenticated;
GRANT ALL ON public.follow_up_plan_steps TO service_role;
ALTER TABLE public.follow_up_plan_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own plan steps" ON public.follow_up_plan_steps FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.follow_up_plans p WHERE p.id = plan_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.follow_up_plans p WHERE p.id = plan_id AND p.user_id = auth.uid()));

-- Steps are copied at start so later plan edits don't change a running plan.
CREATE TABLE public.lead_plan_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.follow_up_plans(id) ON DELETE SET NULL,
  plan_name text NOT NULL,
  steps jsonb NOT NULL,
  started_on date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','stopped')),
  stopped_reason text,
  stopped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX lead_plan_one_active ON public.lead_plan_enrollments (lead_id) WHERE status = 'active';
GRANT SELECT, INSERT, UPDATE ON public.lead_plan_enrollments TO authenticated;
GRANT ALL ON public.lead_plan_enrollments TO service_role;
ALTER TABLE public.lead_plan_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own plan runs" ON public.lead_plan_enrollments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users start plans on own leads" ON public.lead_plan_enrollments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'active' AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.client_id = auth.uid()));
CREATE POLICY "Users stop own plans" ON public.lead_plan_enrollments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.lead_follow_ups
  ADD COLUMN IF NOT EXISTS enrollment_id uuid REFERENCES public.lead_plan_enrollments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS step_index integer,
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS draft_subject text,
  ADD COLUMN IF NOT EXISTS draft_body text;
CREATE UNIQUE INDEX IF NOT EXISTS lead_follow_ups_plan_step ON public.lead_follow_ups (enrollment_id, step_index) WHERE enrollment_id IS NOT NULL;

-- Creates every due step task (catches up missed days). Safe to run any number of times.
CREATE OR REPLACE FUNCTION public.materialize_plan_steps(p_enrollment uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; s record; today date; n integer := 0; total integer; created integer;
BEGIN
  FOR e IN SELECT en.*, coalesce(p.timezone, 'America/Chicago') AS tz
           FROM lead_plan_enrollments en LEFT JOIN profiles p ON p.user_id = en.user_id
           WHERE en.status = 'active' AND (p_enrollment IS NULL OR en.id = p_enrollment) LOOP
    BEGIN today := (now() AT TIME ZONE e.tz)::date; EXCEPTION WHEN others THEN today := (now() AT TIME ZONE 'America/Chicago')::date; END;
    FOR s IN SELECT (x.ord - 1)::int AS idx, x.step FROM jsonb_array_elements(e.steps) WITH ORDINALITY AS x(step, ord) LOOP
      IF e.started_on + ((s.step->>'day')::int - 1) <= today THEN
        INSERT INTO lead_follow_ups (user_id, lead_id, due_date, note, enrollment_id, step_index, channel)
        VALUES (e.user_id, e.lead_id, e.started_on + ((s.step->>'day')::int - 1),
                left(format('%s · Day %s %s%s', e.plan_name, s.step->>'day', s.step->>'channel',
                  CASE WHEN (s.step->>'market_report')::boolean THEN ' with market report' ELSE '' END), 1000),
                e.id, s.idx, s.step->>'channel')
        ON CONFLICT (enrollment_id, step_index) WHERE enrollment_id IS NOT NULL DO NOTHING;
        IF FOUND THEN n := n + 1; END IF;
      END IF;
    END LOOP;
    total := jsonb_array_length(e.steps);
    SELECT count(*) INTO created FROM lead_follow_ups WHERE enrollment_id = e.id;
    IF created >= total THEN UPDATE lead_plan_enrollments SET status = 'completed' WHERE id = e.id AND status = 'active'; END IF;
  END LOOP;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.materialize_plan_steps(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.on_plan_enrollment_created() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.materialize_plan_steps(NEW.id); RETURN NEW; END $$;
REVOKE EXECUTE ON FUNCTION public.on_plan_enrollment_created() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER lead_plan_enrollment_created AFTER INSERT ON public.lead_plan_enrollments FOR EACH ROW EXECUTE FUNCTION public.on_plan_enrollment_created();

CREATE OR REPLACE FUNCTION public.stop_lead_plans(p_lead uuid, p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM lead_follow_ups f USING lead_plan_enrollments e
   WHERE f.enrollment_id = e.id AND e.lead_id = p_lead AND e.status = 'active' AND f.done_at IS NULL;
  UPDATE lead_plan_enrollments SET status = 'stopped', stopped_reason = p_reason, stopped_at = now()
   WHERE lead_id = p_lead AND status = 'active';
END $$;
REVOKE EXECUTE ON FUNCTION public.stop_lead_plans(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.on_lead_change_stop_plans() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.do_not_contact AND NOT coalesce(OLD.do_not_contact, false) THEN
    PERFORM public.stop_lead_plans(NEW.id, 'Marked do not contact');
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status::text IN ('appointment_set','listing_signed','lost') THEN
    PERFORM public.stop_lead_plans(NEW.id, CASE NEW.status::text WHEN 'appointment_set' THEN 'Appointment set' WHEN 'listing_signed' THEN 'Listing signed' ELSE 'Lost' END);
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.on_lead_change_stop_plans() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER leads_stop_plans AFTER UPDATE OF status, do_not_contact ON public.leads FOR EACH ROW EXECUTE FUNCTION public.on_lead_change_stop_plans();

CREATE OR REPLACE FUNCTION public.on_reply_stop_plans() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL AND NEW.direction = 'inbound' AND NEW.type IN ('sms','email','call') THEN
    PERFORM public.stop_lead_plans(NEW.lead_id, 'Owner replied');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.on_reply_stop_plans() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER conversation_logs_stop_plans AFTER INSERT ON public.conversation_logs FOR EACH ROW EXECUTE FUNCTION public.on_reply_stop_plans();

-- Adds the two starter plans for the signed-in user if they have none yet.
CREATE OR REPLACE FUNCTION public.ensure_default_follow_up_plans() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); pid uuid;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('plans:' || uid::text));
  IF NOT EXISTS (SELECT 1 FROM follow_up_plans WHERE user_id = uid AND kind = 'fsbo') THEN
    INSERT INTO follow_up_plans (user_id, kind, name) VALUES (uid, 'fsbo', 'FSBO 45-day plan') RETURNING id INTO pid;
    INSERT INTO follow_up_plan_steps (plan_id, day, channel, instruction, market_report) VALUES
      (pid, 1, 'text', 'Introduce yourself and offer help with their sale', false),
      (pid, 3, 'call', 'Check in and ask how showings are going', false),
      (pid, 7, 'email', 'Share a free market report for their home', true),
      (pid, 14, 'call', 'Follow up on the market report', false),
      (pid, 21, 'text', 'Friendly check-in', false),
      (pid, 30, 'email', 'Offer a no-pressure conversation about pricing and exposure', false),
      (pid, 45, 'call', 'Final check-in', false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM follow_up_plans WHERE user_id = uid AND kind = 'frbo') THEN
    INSERT INTO follow_up_plans (user_id, kind, name) VALUES (uid, 'frbo', 'FRBO 30-day plan') RETURNING id INTO pid;
    INSERT INTO follow_up_plan_steps (plan_id, day, channel, instruction, market_report) VALUES
      (pid, 1, 'text', 'Introduce yourself and offer help finding a tenant', false),
      (pid, 4, 'call', 'Ask how the rental search is going', false),
      (pid, 10, 'email', 'Explain how you can help with screening and leasing', false),
      (pid, 20, 'text', 'Friendly check-in', false),
      (pid, 30, 'call', 'Final check-in', false);
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.ensure_default_follow_up_plans() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_default_follow_up_plans() TO authenticated;