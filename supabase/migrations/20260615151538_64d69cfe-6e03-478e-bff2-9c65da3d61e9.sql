
-- 1. Revoke sensitive column access from authenticated users
REVOKE SELECT (secret_hash) ON public.client_webhooks FROM authenticated, anon;
REVOKE SELECT (smtp_password_encrypted) ON public.user_email_accounts FROM authenticated, anon;

-- Ensure service_role retains full access
GRANT ALL ON public.client_webhooks TO service_role;
GRANT ALL ON public.user_email_accounts TO service_role;

-- 2. Drop misleading WITH CHECK (false) INSERT policies (service_role bypasses RLS anyway)
DROP POLICY IF EXISTS "Service role insert evidence" ON public.field_evidence;
DROP POLICY IF EXISTS "Service role can insert spend alerts" ON public.spend_alerts;

-- 3. Document is_shared flags as personal-use only (no cross-user policy exists)
COMMENT ON COLUMN public.custom_reports.is_shared IS 'Personal UI flag only. No RLS policy grants cross-user access to shared rows. Do not add such a policy without scoping by workspace_id.';
COMMENT ON COLUMN public.message_templates.is_shared IS 'Personal UI flag only. No RLS policy grants cross-user access to shared rows. Do not add such a policy without scoping by workspace_id/organization.';
