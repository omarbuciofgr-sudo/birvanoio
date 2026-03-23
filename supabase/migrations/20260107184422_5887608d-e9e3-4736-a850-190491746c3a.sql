-- Add explicit deny policies for anonymous users on all tables
-- This makes the security intent clear and future-proofs against accidental access

-- Explicit deny for anonymous users on profiles
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- Explicit deny for anonymous users on leads  
CREATE POLICY "Deny anonymous access to leads"
ON public.leads
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- Explicit deny for anonymous users on user_roles
CREATE POLICY "Deny anonymous access to user_roles"
ON public.user_roles
AS RESTRICTIVE  
FOR ALL
TO anon
USING (false);