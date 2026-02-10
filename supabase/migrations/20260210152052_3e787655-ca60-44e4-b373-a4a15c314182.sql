-- Add RESTRICTIVE deny policy for anonymous access to digest_subscriptions (consistent with other sensitive tables)
CREATE POLICY "Deny anonymous access to digest_subscriptions"
ON public.digest_subscriptions
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);
