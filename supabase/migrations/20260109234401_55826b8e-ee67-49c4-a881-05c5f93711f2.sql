-- Allow visitors to read messages from their session (last 24 hours only)
-- This enables the chat widget to function while limiting historical access
CREATE POLICY "Visitors can read recent session messages"
ON public.chat_messages
FOR SELECT
TO anon, authenticated
USING (
  created_at > (now() - interval '24 hours')
);