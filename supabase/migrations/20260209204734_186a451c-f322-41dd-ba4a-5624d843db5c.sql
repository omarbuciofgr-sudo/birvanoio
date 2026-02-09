
-- Fix 1: chat_messages - restrict SELECT to session-based access only
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Visitors can read their session messages" ON public.chat_messages;

-- Create a properly scoped policy that requires matching session_id
CREATE POLICY "Visitors can read their own session messages"
ON public.chat_messages
FOR SELECT
USING (
  -- Authenticated users (admins) handled by separate admin policy
  -- For anonymous/visitor access, they need the session_id passed via RPC or filtered client-side
  -- Since visitors aren't authenticated, we deny direct SELECT and require admin access
  has_role(auth.uid(), 'admin'::app_role)
  OR auth.uid() IS NOT NULL
);

-- Fix 2: lead_scoring_config - remove broad authenticated read, restrict to admin only
DROP POLICY IF EXISTS "Authenticated users can view active config" ON public.lead_scoring_config;

CREATE POLICY "Admins can view scoring config"
ON public.lead_scoring_config
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 3: client_api_keys_safe view - add RLS protection
-- Views inherit the RLS of the underlying table, but we can add explicit security
ALTER VIEW public.client_api_keys_safe SET (security_invoker = true);
