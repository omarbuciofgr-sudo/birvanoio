DROP FUNCTION IF EXISTS public.accept_communication_compliance();

CREATE POLICY "No direct client access to unsubscribe tokens"
ON public.email_unsubscribe_tokens
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);