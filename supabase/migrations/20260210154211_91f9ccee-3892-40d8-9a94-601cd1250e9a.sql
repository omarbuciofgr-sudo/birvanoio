
-- Fix 1: Restrict chat_messages SELECT policies
DROP POLICY IF EXISTS "Anyone can read messages by session" ON public.chat_messages;
DROP POLICY IF EXISTS "Visitors can read their own session messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Admins can read all chat messages" ON public.chat_messages;

CREATE POLICY "Visitors can read their own session messages"
ON public.chat_messages
FOR SELECT
TO anon
USING (false);

CREATE POLICY "Admins can read all chat messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Fix 2: Add input validation constraints on chat_messages
ALTER TABLE public.chat_messages
ADD CONSTRAINT check_message_length
CHECK (char_length(message) <= 2000);

ALTER TABLE public.chat_messages
ADD CONSTRAINT check_sender_type_values
CHECK (sender_type IN ('visitor', 'support'));

ALTER TABLE public.chat_messages
ADD CONSTRAINT check_email_format
CHECK (visitor_email IS NULL OR visitor_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
