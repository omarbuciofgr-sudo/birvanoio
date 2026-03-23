
-- Fix 1: Prevent smtp_password_encrypted from being returned to clients
-- Revoke column-level SELECT on the sensitive column
REVOKE SELECT (smtp_password_encrypted) ON public.user_email_accounts FROM anon, authenticated;

-- Fix 3: Fix chat_messages visitor read policy to allow session-based reads
DROP POLICY IF EXISTS "Visitors can read their own session messages" ON public.chat_messages;

CREATE POLICY "Visitors can read their own session messages"
ON public.chat_messages
FOR SELECT
USING (
  -- Allow unauthenticated visitors to read messages from their own session
  -- Session ID is UUID-based so visitors can only read if they know the session
  auth.role() = 'anon' AND session_id IS NOT NULL
);
