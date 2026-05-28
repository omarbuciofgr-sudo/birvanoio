
-- 1. Remove user_notifications from realtime publication (PII leakage)
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_notifications;

-- 2. credit_usage: only service role writes
DROP POLICY IF EXISTS "Users can insert own credit usage" ON public.credit_usage;
DROP POLICY IF EXISTS "Users insert own notifications" ON public.user_notifications;

-- 3. contact_submissions: allow anon inserts (public contact form)
CREATE POLICY "Anyone can submit contact form"
ON public.contact_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

GRANT INSERT ON public.contact_submissions TO anon;
