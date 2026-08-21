CREATE TABLE IF NOT EXISTS public.gmail_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  thread_id text NOT NULL,
  message_id text NOT NULL,
  contact_email text NOT NULL,
  contact_name text,
  subject text,
  deal_id uuid REFERENCES public.realtor_deals(id) ON DELETE SET NULL,
  lead_id uuid,
  calendar_event_id text,
  follow_up_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, thread_id)
);

GRANT SELECT ON public.gmail_followups TO authenticated;
GRANT ALL ON public.gmail_followups TO service_role;

ALTER TABLE public.gmail_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their gmail followups"
ON public.gmail_followups
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);