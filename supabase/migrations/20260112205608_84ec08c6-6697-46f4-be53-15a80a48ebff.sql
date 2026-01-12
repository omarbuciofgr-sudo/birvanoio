-- Drop the vulnerable tautological SELECT policy that exposes all chat messages
-- The chat widget doesn't need SELECT access via RLS - it INSERTs messages and
-- receives responses through the ai-chat edge function which uses service role
DROP POLICY IF EXISTS "Visitors can read their own session messages" ON public.chat_messages;