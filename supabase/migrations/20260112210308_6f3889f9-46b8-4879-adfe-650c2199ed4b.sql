-- FIX 1: Protect chat_messages from anonymous SELECT
-- Currently there's no SELECT policy for anonymous users, but the concern is they could
-- potentially read messages if they guess session IDs. We already removed the permissive
-- SELECT policy in the previous fix. Let's add explicit denial for all non-admin SELECT.
-- The existing "Admins can read all chat messages" policy handles admin access.
-- No action needed - already fixed.

-- FIX 2: Add INSERT policy for contact_submissions
-- The contact form needs to allow anonymous submissions via edge function (service role)
-- Regular anonymous users should not be able to insert directly via RLS
-- The edge function uses service role so it bypasses RLS anyway
-- We should add a rate-limited INSERT policy similar to chat_messages
-- But since contact form goes through the edge function with service role, 
-- we just need to ensure anonymous users can't insert directly

-- Actually, the edge function uses service role which bypasses RLS.
-- So we don't need an INSERT policy for anonymous users.
-- The current setup is secure - only admins and service role can insert.

-- FIX 3: Prevent leads.client_id modification on UPDATE
-- Create a trigger to prevent client_id modification after insert
CREATE OR REPLACE FUNCTION public.prevent_client_id_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.client_id IS DISTINCT FROM NEW.client_id THEN
    RAISE EXCEPTION 'client_id cannot be modified after creation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply trigger to leads table
DROP TRIGGER IF EXISTS prevent_leads_client_id_change ON public.leads;
CREATE TRIGGER prevent_leads_client_id_change
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_client_id_modification();

-- Apply same protection to conversation_logs
DROP TRIGGER IF EXISTS prevent_conversation_logs_client_id_change ON public.conversation_logs;
CREATE TRIGGER prevent_conversation_logs_client_id_change
  BEFORE UPDATE ON public.conversation_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_client_id_modification();

-- Apply same protection to other tables with client_id
DROP TRIGGER IF EXISTS prevent_email_campaigns_client_id_change ON public.email_campaigns;
CREATE TRIGGER prevent_email_campaigns_client_id_change
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_client_id_modification();

DROP TRIGGER IF EXISTS prevent_scheduled_messages_client_id_change ON public.scheduled_messages;
CREATE TRIGGER prevent_scheduled_messages_client_id_change
  BEFORE UPDATE ON public.scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_client_id_modification();

DROP TRIGGER IF EXISTS prevent_webhook_integrations_client_id_change ON public.webhook_integrations;
CREATE TRIGGER prevent_webhook_integrations_client_id_change
  BEFORE UPDATE ON public.webhook_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_client_id_modification();

DROP TRIGGER IF EXISTS prevent_voice_agent_calls_client_id_change ON public.voice_agent_calls;
CREATE TRIGGER prevent_voice_agent_calls_client_id_change
  BEFORE UPDATE ON public.voice_agent_calls
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_client_id_modification();

DROP TRIGGER IF EXISTS prevent_message_templates_client_id_change ON public.message_templates;
CREATE TRIGGER prevent_message_templates_client_id_change
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_client_id_modification();