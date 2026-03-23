-- Fix PUBLIC_DATA_EXPOSURE: Drop overly permissive SELECT policy on chat_messages
-- The current policy uses USING(true) which allows anyone to read ALL messages

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can read messages by session" ON public.chat_messages;

-- Create a policy that only allows admins to read all messages
-- This is appropriate since the chat widget is for support staff to monitor
CREATE POLICY "Admins can read all chat messages"
ON public.chat_messages
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));