-- ============================================
-- 1) Evidence Context Fields
-- ============================================

-- Add evidence fields to scraped_leads
ALTER TABLE public.scraped_leads 
ADD COLUMN IF NOT EXISTS name_evidence_snippet text,
ADD COLUMN IF NOT EXISTS name_evidence_type text DEFAULT 'on_page_text',
ADD COLUMN IF NOT EXISTS email_evidence_snippet text,
ADD COLUMN IF NOT EXISTS email_evidence_type text DEFAULT 'on_page_text',
ADD COLUMN IF NOT EXISTS phone_evidence_snippet text,
ADD COLUMN IF NOT EXISTS phone_evidence_type text DEFAULT 'on_page_text',
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS address_source_url text,
ADD COLUMN IF NOT EXISTS address_evidence_snippet text,
ADD COLUMN IF NOT EXISTS address_evidence_type text DEFAULT 'on_page_text';

-- ============================================
-- 2) Lead Model + Selection
-- ============================================

-- Add lead_type and target_contact_role
ALTER TABLE public.scraped_leads 
ADD COLUMN IF NOT EXISTS lead_type text DEFAULT 'company' CHECK (lead_type IN ('person', 'company')),
ADD COLUMN IF NOT EXISTS best_contact_title text,
ADD COLUMN IF NOT EXISTS best_contact_selection_reason text;

-- Add target_contact_role to schema_templates
ALTER TABLE public.schema_templates
ADD COLUMN IF NOT EXISTS target_contact_role text DEFAULT 'decision_maker';

-- Add target_contact_role to scrape_jobs
ALTER TABLE public.scrape_jobs
ADD COLUMN IF NOT EXISTS target_contact_role text;

-- ============================================
-- 3) Manual Review + Audit
-- ============================================

-- Create audit_log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'status_change', 'assignment')),
  field_name text,
  old_value text,
  new_value text,
  reason text,
  performed_by uuid,
  performed_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit_log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for audit_log
CREATE POLICY "Admins can manage audit_log" ON public.audit_log
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role bypass audit_log" ON public.audit_log
  FOR ALL USING (auth.role() = 'service_role'::text);

-- Add reviewed_by and reviewed_at to scraped_leads
ALTER TABLE public.scraped_leads
ADD COLUMN IF NOT EXISTS reviewed_by uuid,
ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- ============================================
-- 4) Cost/Scale Guardrails
-- ============================================

-- Add budget and limit fields to scrape_jobs
ALTER TABLE public.scrape_jobs
ADD COLUMN IF NOT EXISTS max_enrichment_calls_per_domain integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS max_verification_calls_per_lead integer DEFAULT 2,
ADD COLUMN IF NOT EXISTS job_budget_usd numeric(10,2),
ADD COLUMN IF NOT EXISTS current_cost_usd numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS budget_exceeded boolean DEFAULT false;

-- Create enrichment_cache table
CREATE TABLE IF NOT EXISTS public.enrichment_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key text NOT NULL UNIQUE,
  provider text NOT NULL,
  lookup_type text NOT NULL,
  input_data jsonb NOT NULL,
  result_data jsonb,
  success boolean NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days')
);

-- Enable RLS on enrichment_cache
ALTER TABLE public.enrichment_cache ENABLE ROW LEVEL SECURITY;

-- RLS policies for enrichment_cache
CREATE POLICY "Admins can manage enrichment_cache" ON public.enrichment_cache
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role bypass enrichment_cache" ON public.enrichment_cache
  FOR ALL USING (auth.role() = 'service_role'::text);

-- Create verification_cache table
CREATE TABLE IF NOT EXISTS public.verification_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key text NOT NULL UNIQUE,
  verification_type text NOT NULL CHECK (verification_type IN ('email', 'phone')),
  input_value text NOT NULL,
  provider text,
  result_status text NOT NULL,
  result_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days')
);

-- Enable RLS on verification_cache
ALTER TABLE public.verification_cache ENABLE ROW LEVEL SECURITY;

-- RLS policies for verification_cache
CREATE POLICY "Admins can manage verification_cache" ON public.verification_cache
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role bypass verification_cache" ON public.verification_cache
  FOR ALL USING (auth.role() = 'service_role'::text);

-- ============================================
-- 5) Explicit Verification Fields
-- ============================================

ALTER TABLE public.scraped_leads
ADD COLUMN IF NOT EXISTS email_verification_method text,
ADD COLUMN IF NOT EXISTS email_verification_result jsonb,
ADD COLUMN IF NOT EXISTS email_verified_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS phone_verification_method text,
ADD COLUMN IF NOT EXISTS phone_verification_result jsonb,
ADD COLUMN IF NOT EXISTS phone_verified_at timestamp with time zone;

-- ============================================
-- 6) Suppression Lists
-- ============================================

-- Create global suppression list
CREATE TABLE IF NOT EXISTS public.suppression_list_global (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  suppression_type text NOT NULL CHECK (suppression_type IN ('email', 'phone', 'domain')),
  value text NOT NULL,
  reason text,
  added_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(suppression_type, value)
);

-- Enable RLS on suppression_list_global
ALTER TABLE public.suppression_list_global ENABLE ROW LEVEL SECURITY;

-- RLS policies for suppression_list_global
CREATE POLICY "Admins can manage global suppression" ON public.suppression_list_global
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Create per-client suppression list
CREATE TABLE IF NOT EXISTS public.suppression_list_client (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  suppression_type text NOT NULL CHECK (suppression_type IN ('email', 'phone', 'domain')),
  value text NOT NULL,
  reason text,
  added_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, suppression_type, value)
);

-- Enable RLS on suppression_list_client
ALTER TABLE public.suppression_list_client ENABLE ROW LEVEL SECURITY;

-- RLS policies for suppression_list_client
CREATE POLICY "Admins can manage client suppression" ON public.suppression_list_client
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients can view their suppression list" ON public.suppression_list_client
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM public.client_users WHERE user_id = auth.uid()
  ));

-- Add is_suppressed flag to scraped_leads
ALTER TABLE public.scraped_leads
ADD COLUMN IF NOT EXISTS is_suppressed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS suppression_reason text;

-- ============================================
-- 7) Client Webhooks/API Access
-- ============================================

-- Create client_api_keys table
CREATE TABLE IF NOT EXISTS public.client_api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  key_name text NOT NULL,
  api_key_hash text NOT NULL,
  api_key_prefix text NOT NULL,
  permissions jsonb DEFAULT '["read_leads"]'::jsonb,
  rate_limit_per_minute integer DEFAULT 60,
  is_active boolean DEFAULT true,
  last_used_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone
);

-- Enable RLS on client_api_keys
ALTER TABLE public.client_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS policies for client_api_keys
CREATE POLICY "Admins can manage API keys" ON public.client_api_keys
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients can view their API keys" ON public.client_api_keys
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM public.client_users WHERE user_id = auth.uid()
  ));

-- Create client_webhooks table
CREATE TABLE IF NOT EXISTS public.client_webhooks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  webhook_url text NOT NULL,
  secret_hash text,
  events jsonb DEFAULT '["lead_assigned"]'::jsonb,
  is_active boolean DEFAULT true,
  last_triggered_at timestamp with time zone,
  failure_count integer DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on client_webhooks
ALTER TABLE public.client_webhooks ENABLE ROW LEVEL SECURITY;

-- RLS policies for client_webhooks
CREATE POLICY "Admins can manage client webhooks" ON public.client_webhooks
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients can manage their webhooks" ON public.client_webhooks
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM public.client_users WHERE user_id = auth.uid()
  ));

-- Create webhook_delivery_log table
CREATE TABLE IF NOT EXISTS public.webhook_delivery_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id uuid NOT NULL REFERENCES public.client_webhooks(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  response_status integer,
  response_body text,
  success boolean NOT NULL,
  error_message text,
  delivered_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on webhook_delivery_log
ALTER TABLE public.webhook_delivery_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for webhook_delivery_log
CREATE POLICY "Admins can view webhook logs" ON public.webhook_delivery_log
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients can view their webhook logs" ON public.webhook_delivery_log
  FOR SELECT USING (webhook_id IN (
    SELECT id FROM public.client_webhooks WHERE organization_id IN (
      SELECT organization_id FROM public.client_users WHERE user_id = auth.uid()
    )
  ));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_log_record ON public.audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_performed_at ON public.audit_log(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_cache_key ON public.enrichment_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_enrichment_cache_expires ON public.enrichment_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_cache_key ON public.verification_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_verification_cache_expires ON public.verification_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_suppression_global_value ON public.suppression_list_global(suppression_type, value);
CREATE INDEX IF NOT EXISTS idx_suppression_client_value ON public.suppression_list_client(organization_id, suppression_type, value);
CREATE INDEX IF NOT EXISTS idx_scraped_leads_suppressed ON public.scraped_leads(is_suppressed) WHERE is_suppressed = true;