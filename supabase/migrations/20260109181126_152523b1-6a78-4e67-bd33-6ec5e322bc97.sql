-- Drop the overly permissive INSERT policy on contact_submissions
-- The edge function uses service role which bypasses RLS, so this policy is not needed
-- and creates an unnecessary security risk
DROP POLICY IF EXISTS "Service role can insert contact submissions" ON public.contact_submissions;