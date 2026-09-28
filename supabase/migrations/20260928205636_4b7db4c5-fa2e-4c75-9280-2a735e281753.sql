ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS communication_compliance_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS mailing_address text;

ALTER TABLE public.workspace_settings
  ADD COLUMN IF NOT EXISTS mailing_address text;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS do_not_contact boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS do_not_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS do_not_contact_reason text,
  ADD COLUMN IF NOT EXISTS voice_consent_at timestamptz;

CREATE INDEX IF NOT EXISTS leads_client_phone_idx ON public.leads (client_id, phone);
CREATE INDEX IF NOT EXISTS contact_suppression_type_value_idx ON public.contact_suppression (value_type, value_normalized);

CREATE TABLE public.email_unsubscribe_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  email_normalized text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz
);
GRANT ALL ON public.email_unsubscribe_tokens TO service_role;
ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.accept_communication_compliance()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  accepted_at timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.profiles
  SET communication_compliance_accepted_at = accepted_at,
      updated_at = accepted_at
  WHERE user_id = auth.uid();

  RETURN accepted_at;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_communication_compliance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_communication_compliance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_communication_compliance() TO service_role;