
-- 1. custom_reports: remove broad "shared" SELECT exposure
DROP POLICY IF EXISTS "Users can view shared reports" ON public.custom_reports;

-- 2. message_templates: remove shared cross-user SELECT exposure
DROP POLICY IF EXISTS "Users can view their own templates or shared ones" ON public.message_templates;
CREATE POLICY "Users can view their own templates"
  ON public.message_templates FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

-- 3. workspaces: hide stripe/billing identifiers from Data API.
-- Revoke broad SELECT and re-grant only non-billing columns to authenticated.
-- service_role keeps full access for edge functions / admin flows.
REVOKE SELECT ON public.workspaces FROM authenticated;
GRANT SELECT (
  id, name, plan_tier, seats_purchased, created_by,
  created_at, updated_at, billing_status,
  current_period_start, current_period_end
) ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;

-- 4. chat_messages: harden rate limiter so client-supplied session_id rotation
-- cannot bypass the cap. Add a global per-window ceiling.
CREATE OR REPLACE FUNCTION public.check_chat_rate_limit(session_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  session_count INTEGER;
  global_count  INTEGER;
BEGIN
  SELECT COUNT(*) INTO session_count
  FROM public.chat_messages
  WHERE session_id = session_uuid
    AND created_at > (now() - INTERVAL '5 minutes');

  SELECT COUNT(*) INTO global_count
  FROM public.chat_messages
  WHERE created_at > (now() - INTERVAL '1 minute')
    AND sender_type = 'visitor';

  -- Per-session: <10 / 5min. Global anti-flood: <60 visitor messages / minute.
  RETURN session_count < 10 AND global_count < 60;
END;
$$;
