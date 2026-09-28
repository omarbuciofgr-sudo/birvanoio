CREATE UNIQUE INDEX IF NOT EXISTS email_unsubscribe_tokens_user_lead_key
ON public.email_unsubscribe_tokens (user_id, lead_id);

CREATE OR REPLACE FUNCTION public.enforce_campaign_mailing_address()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_address boolean;
BEGIN
  IF NEW.is_active IS TRUE AND (OLD.is_active IS DISTINCT FROM TRUE) THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = NEW.client_id
        AND nullif(btrim(p.mailing_address), '') IS NOT NULL
    ) OR EXISTS (
      SELECT 1
      FROM public.workspace_memberships wm
      JOIN public.workspace_settings ws ON ws.workspace_id = wm.workspace_id
      WHERE wm.user_id = NEW.client_id
        AND nullif(btrim(ws.mailing_address), '') IS NOT NULL
    ) INTO has_address;

    IF NOT has_address THEN
      RAISE EXCEPTION 'Add your business mailing address before sending. It''s required by law in every marketing email.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_campaign_mailing_address() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_campaign_mailing_address() TO service_role;

DROP TRIGGER IF EXISTS enforce_campaign_mailing_address_trigger ON public.email_campaigns;
CREATE TRIGGER enforce_campaign_mailing_address_trigger
BEFORE UPDATE OF is_active ON public.email_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.enforce_campaign_mailing_address();