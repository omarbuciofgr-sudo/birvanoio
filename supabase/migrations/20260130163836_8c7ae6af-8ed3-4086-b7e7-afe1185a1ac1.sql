-- Fix Security Issues - Corrected migration

-- 1. Fix chat_messages: Replace overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can read messages by session" ON public.chat_messages;
DROP POLICY IF EXISTS "Visitors can read their session messages" ON public.chat_messages;

CREATE POLICY "Visitors can read their session messages"
ON public.chat_messages
FOR SELECT
TO anon, authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- 2. Fix profiles table: Restrict access to own profile only
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are publicly accessible" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3. Fix client_api_keys: Don't expose api_key_hash to clients
DROP POLICY IF EXISTS "Clients can view their org API keys via safe view" ON public.client_api_keys;
DROP POLICY IF EXISTS "Only admins can directly query API keys" ON public.client_api_keys;

CREATE POLICY "Only admins can directly query API keys"
ON public.client_api_keys
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Strengthen conversation_logs with lead ownership check
DROP POLICY IF EXISTS "Clients can view their own conversation logs" ON public.conversation_logs;
DROP POLICY IF EXISTS "Clients can insert their own conversation logs" ON public.conversation_logs;
DROP POLICY IF EXISTS "Clients can update their own conversation logs" ON public.conversation_logs;
DROP POLICY IF EXISTS "Clients can delete their own conversation logs" ON public.conversation_logs;

CREATE POLICY "Clients can view their own conversation logs"
ON public.conversation_logs
FOR SELECT
TO authenticated
USING (
  auth.uid() = client_id 
  AND EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = conversation_logs.lead_id 
    AND leads.client_id = auth.uid()
  )
);

CREATE POLICY "Clients can insert their own conversation logs"
ON public.conversation_logs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = client_id 
  AND EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = conversation_logs.lead_id 
    AND leads.client_id = auth.uid()
  )
);

CREATE POLICY "Clients can update their own conversation logs"
ON public.conversation_logs
FOR UPDATE
TO authenticated
USING (
  auth.uid() = client_id 
  AND EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = conversation_logs.lead_id 
    AND leads.client_id = auth.uid()
  )
);

CREATE POLICY "Clients can delete their own conversation logs"
ON public.conversation_logs
FOR DELETE
TO authenticated
USING (
  auth.uid() = client_id 
  AND EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = conversation_logs.lead_id 
    AND leads.client_id = auth.uid()
  )
);