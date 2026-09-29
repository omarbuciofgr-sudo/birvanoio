CREATE TABLE public.assistant_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New chat',
  automation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.assistant_threads TO authenticated;
GRANT ALL ON public.assistant_threads TO service_role;
ALTER TABLE public.assistant_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own threads read" ON public.assistant_threads FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own threads rename" ON public.assistant_threads FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own threads delete" ON public.assistant_threads FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX assistant_threads_user_idx ON public.assistant_threads(user_id, updated_at DESC);
CREATE TRIGGER assistant_threads_updated BEFORE UPDATE ON public.assistant_threads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Messages are written only by the server (content = Claude blocks + UI cards).
CREATE TABLE public.assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.assistant_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content jsonb NOT NULL,
  ui jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assistant_messages TO authenticated;
GRANT ALL ON public.assistant_messages TO service_role;
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own messages read" ON public.assistant_messages FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX assistant_messages_thread_idx ON public.assistant_messages(thread_id, created_at);

CREATE TABLE public.assistant_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.assistant_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_use_id text NOT NULL,
  tool text NOT NULL,
  args jsonb NOT NULL,
  summary text NOT NULL,
  credit_cost integer NOT NULL DEFAULT 0,
  other_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','done','failed')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '1 day',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assistant_pending_actions TO authenticated;
GRANT ALL ON public.assistant_pending_actions TO service_role;
ALTER TABLE public.assistant_pending_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own pending read" ON public.assistant_pending_actions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  instructions text NOT NULL CHECK (char_length(instructions) BETWEEN 1 AND 2000),
  days smallint[] NOT NULL DEFAULT '{1,2,3,4,5}',
  run_time time NOT NULL DEFAULT '08:00',
  timezone text NOT NULL DEFAULT 'America/Chicago',
  credit_cap integer NOT NULL DEFAULT 10 CHECK (credit_cap BETWEEN 0 AND 1000),
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automations TO authenticated;
GRANT ALL ON public.automations TO service_role;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own automations" ON public.automations FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER automations_updated BEFORE UPDATE ON public.automations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_date date NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','failed')),
  credits_spent integer NOT NULL DEFAULT 0,
  summary text,
  thread_id uuid REFERENCES public.assistant_threads(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (automation_id, run_date)
);
GRANT SELECT ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own runs read" ON public.automation_runs FOR SELECT TO authenticated USING (user_id = auth.uid());