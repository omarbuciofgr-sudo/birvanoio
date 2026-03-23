-- ============================================
-- LEAD SCRAPER + ENRICHMENT PLATFORM SCHEMA
-- ============================================

-- 1. ENUM TYPES
-- ============================================

-- Scrape job status
CREATE TYPE public.scrape_job_status AS ENUM (
  'draft', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled'
);

-- Lead validation status
CREATE TYPE public.validation_status AS ENUM (
  'unverified', 'likely_valid', 'verified', 'invalid'
);

-- Scraped page status
CREATE TYPE public.scraped_page_status AS ENUM (
  'pending', 'scraping', 'scraped', 'failed', 'blocked', 'skipped'
);

-- Enrichment provider types
CREATE TYPE public.enrichment_provider AS ENUM (
  'apollo', 'hunter', 'clearbit', 'manual'
);

-- Scraped lead status (workflow)
CREATE TYPE public.scraped_lead_status AS ENUM (
  'new', 'review', 'approved', 'assigned', 'in_progress', 'won', 'lost', 'rejected'
);

-- 2. SCHEMA TEMPLATES TABLE
-- ============================================
CREATE TABLE public.schema_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  niche TEXT NOT NULL, -- e.g., 'real_estate', 'insurance', 'b2b'
  fields JSONB NOT NULL DEFAULT '[]'::jsonb, 
  -- fields structure: [{ field_name, type, description, extraction_hints, required }]
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. CLIENT ORGANIZATIONS TABLE
-- ============================================
CREATE TABLE public.client_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. CLIENT USERS MAPPING
-- ============================================
CREATE TABLE public.client_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- 5. SCRAPE JOBS TABLE
-- ============================================
CREATE TABLE public.scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  schema_template_id UUID REFERENCES public.schema_templates(id) ON DELETE SET NULL,
  status scrape_job_status NOT NULL DEFAULT 'draft',
  
  -- Input configuration
  target_urls JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of URLs to scrape
  input_method TEXT DEFAULT 'paste', -- 'paste', 'csv', 'search'
  
  -- Crawl settings
  max_pages_per_domain INTEGER DEFAULT 50,
  respect_robots_txt BOOLEAN DEFAULT true,
  use_playwright_fallback BOOLEAN DEFAULT true,
  request_delay_ms INTEGER DEFAULT 1000,
  
  -- Progress tracking
  total_targets INTEGER DEFAULT 0,
  completed_targets INTEGER DEFAULT 0,
  failed_targets INTEGER DEFAULT 0,
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Created by admin
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. SCRAPED PAGES TABLE
-- ============================================
CREATE TABLE public.scraped_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.scrape_jobs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  page_type TEXT, -- 'homepage', 'contact', 'about', 'team', 'other'
  status scraped_page_status NOT NULL DEFAULT 'pending',
  
  -- Content
  html_content TEXT,
  markdown_content TEXT,
  extracted_signals JSONB DEFAULT '{}'::jsonb, -- Raw extraction from this page
  
  -- Metadata
  http_status INTEGER,
  error_message TEXT,
  blocked_reason TEXT,
  
  -- Timing
  scraped_at TIMESTAMPTZ,
  processing_time_ms INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. SCRAPED LEADS TABLE (main output)
-- ============================================
CREATE TABLE public.scraped_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.scrape_jobs(id) ON DELETE SET NULL,
  
  -- Assignment
  assigned_to_org UUID REFERENCES public.client_organizations(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  status scraped_lead_status NOT NULL DEFAULT 'new',
  
  -- Source domain
  domain TEXT NOT NULL,
  source_url TEXT,
  
  -- Universal fields (always extract)
  full_name TEXT,
  best_email TEXT,
  all_emails JSONB DEFAULT '[]'::jsonb,
  best_phone TEXT,
  all_phones JSONB DEFAULT '[]'::jsonb,
  contact_form_url TEXT,
  
  -- Evidence/source URLs for universal fields
  name_source_url TEXT,
  email_source_url TEXT,
  phone_source_url TEXT,
  contact_form_source_url TEXT,
  
  -- LinkedIn search link (generated, not scraped)
  linkedin_search_url TEXT,
  
  -- Validation status
  email_validation_status validation_status DEFAULT 'unverified',
  email_validation_notes TEXT,
  phone_validation_status validation_status DEFAULT 'unverified',
  phone_line_type TEXT,
  phone_validation_notes TEXT,
  
  -- Confidence & QC
  confidence_score INTEGER DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  qc_flag TEXT, -- 'OK', 'Missing Contact', 'Blocked', 'Low Confidence', etc.
  qc_notes TEXT,
  
  -- Niche-specific fields (dynamic based on schema)
  schema_template_id UUID REFERENCES public.schema_templates(id) ON DELETE SET NULL,
  schema_data JSONB DEFAULT '{}'::jsonb, -- Stores niche-specific fields and their values
  schema_evidence JSONB DEFAULT '{}'::jsonb, -- Stores source URLs for each schema field
  
  -- Enrichment tracking
  enrichment_data JSONB DEFAULT '{}'::jsonb, -- Data from enrichment providers
  enrichment_providers_used JSONB DEFAULT '[]'::jsonb, -- List of providers used
  
  -- Timestamps
  scraped_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. ENRICHMENT PROVIDERS CONFIG
-- ============================================
CREATE TABLE public.enrichment_providers_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider enrichment_provider NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  api_key_secret_name TEXT, -- Name of the secret in vault
  is_enabled BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}'::jsonb, -- Provider-specific configuration
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. ENRICHMENT LOGS
-- ============================================
CREATE TABLE public.enrichment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.scraped_leads(id) ON DELETE CASCADE,
  provider enrichment_provider NOT NULL,
  action TEXT NOT NULL, -- 'person_lookup', 'company_lookup', 'email_discovery', 'phone_enrichment'
  request_data JSONB,
  response_data JSONB,
  fields_enriched JSONB DEFAULT '[]'::jsonb,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  credits_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. VALIDATION LOGS
-- ============================================
CREATE TABLE public.validation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.scraped_leads(id) ON DELETE CASCADE,
  validation_type TEXT NOT NULL, -- 'email', 'phone'
  provider TEXT, -- 'zerobounce', 'twilio', 'internal'
  input_value TEXT NOT NULL,
  result_status validation_status NOT NULL,
  result_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. CRAWL LOGS (per domain)
-- ============================================
CREATE TABLE public.crawl_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.scrape_jobs(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  pages_crawled_count INTEGER DEFAULT 0,
  pages_blocked_count INTEGER DEFAULT 0,
  pages_error_count INTEGER DEFAULT 0,
  blocked_detected BOOLEAN DEFAULT false,
  blocked_reason TEXT,
  errors JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, domain)
);

-- 12. JOB QUEUE TABLE (for background processing)
-- ============================================
CREATE TABLE public.job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL, -- 'scrape', 'enrich', 'validate', 'dedupe'
  reference_id UUID NOT NULL, -- scrape_job_id, lead_id, etc.
  priority INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
  payload JSONB DEFAULT '{}'::jsonb,
  result JSONB,
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_attempt_at TIMESTAMPTZ DEFAULT now(),
  locked_by TEXT, -- Worker ID that's processing this
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 13. DUPLICATE TRACKING
-- ============================================
CREATE TABLE public.lead_duplicates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_lead_id UUID NOT NULL REFERENCES public.scraped_leads(id) ON DELETE CASCADE,
  duplicate_lead_id UUID NOT NULL REFERENCES public.scraped_leads(id) ON DELETE CASCADE,
  match_reason TEXT NOT NULL, -- 'email', 'phone', 'domain_name', 'company_city_contact'
  merged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(primary_lead_id, duplicate_lead_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_scraped_leads_job_id ON public.scraped_leads(job_id);
CREATE INDEX idx_scraped_leads_assigned_to_org ON public.scraped_leads(assigned_to_org);
CREATE INDEX idx_scraped_leads_status ON public.scraped_leads(status);
CREATE INDEX idx_scraped_leads_domain ON public.scraped_leads(domain);
CREATE INDEX idx_scraped_leads_best_email ON public.scraped_leads(best_email);
CREATE INDEX idx_scraped_leads_best_phone ON public.scraped_leads(best_phone);

CREATE INDEX idx_scraped_pages_job_id ON public.scraped_pages(job_id);
CREATE INDEX idx_scraped_pages_domain ON public.scraped_pages(domain);
CREATE INDEX idx_scraped_pages_status ON public.scraped_pages(status);

CREATE INDEX idx_scrape_jobs_status ON public.scrape_jobs(status);
CREATE INDEX idx_scrape_jobs_created_by ON public.scrape_jobs(created_by);

CREATE INDEX idx_job_queue_status ON public.job_queue(status);
CREATE INDEX idx_job_queue_next_attempt ON public.job_queue(next_attempt_at) WHERE status = 'pending';

CREATE INDEX idx_client_users_user_id ON public.client_users(user_id);
CREATE INDEX idx_client_users_org_id ON public.client_users(organization_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.schema_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraped_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraped_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrichment_providers_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrichment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawl_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_duplicates ENABLE ROW LEVEL SECURITY;

-- Schema Templates: Admin full access, clients read-only
CREATE POLICY "Admins can manage schema templates" ON public.schema_templates
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can view schema templates" ON public.schema_templates
  FOR SELECT TO authenticated USING (true);

-- Client Organizations: Admin only
CREATE POLICY "Admins can manage client organizations" ON public.client_organizations
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Client Users: Admin can manage, users can view own
CREATE POLICY "Admins can manage client users" ON public.client_users
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own client mapping" ON public.client_users
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Scrape Jobs: Admin only
CREATE POLICY "Admins can manage scrape jobs" ON public.scrape_jobs
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Scraped Pages: Admin only
CREATE POLICY "Admins can manage scraped pages" ON public.scraped_pages
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Scraped Leads: Admin full, clients see assigned only
CREATE POLICY "Admins can manage scraped leads" ON public.scraped_leads
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can view assigned leads" ON public.scraped_leads
  FOR SELECT TO authenticated 
  USING (
    assigned_to_org IN (
      SELECT organization_id FROM public.client_users WHERE user_id = auth.uid()
    )
  );

-- Enrichment Providers Config: Admin only
CREATE POLICY "Admins can manage enrichment config" ON public.enrichment_providers_config
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Enrichment Logs: Admin only
CREATE POLICY "Admins can view enrichment logs" ON public.enrichment_logs
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Validation Logs: Admin only
CREATE POLICY "Admins can view validation logs" ON public.validation_logs
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Crawl Logs: Admin only
CREATE POLICY "Admins can view crawl logs" ON public.crawl_logs
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Job Queue: Admin only
CREATE POLICY "Admins can manage job queue" ON public.job_queue
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Lead Duplicates: Admin only
CREATE POLICY "Admins can manage duplicates" ON public.lead_duplicates
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_schema_templates_updated_at
  BEFORE UPDATE ON public.schema_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_organizations_updated_at
  BEFORE UPDATE ON public.client_organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scrape_jobs_updated_at
  BEFORE UPDATE ON public.scrape_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scraped_leads_updated_at
  BEFORE UPDATE ON public.scraped_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_enrichment_providers_config_updated_at
  BEFORE UPDATE ON public.enrichment_providers_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get user's organization
CREATE OR REPLACE FUNCTION public.get_user_organization(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id 
  FROM public.client_users 
  WHERE user_id = p_user_id 
  LIMIT 1
$$;

-- Function to normalize email for deduplication
CREATE OR REPLACE FUNCTION public.normalize_email(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_email IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN lower(trim(p_email));
END;
$$;

-- Function to normalize phone for deduplication
CREATE OR REPLACE FUNCTION public.normalize_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  cleaned TEXT;
BEGIN
  IF p_phone IS NULL THEN
    RETURN NULL;
  END IF;
  -- Remove all non-digit characters
  cleaned := regexp_replace(p_phone, '[^0-9]', '', 'g');
  -- If starts with 1 and is 11 digits, remove the 1
  IF length(cleaned) = 11 AND substring(cleaned, 1, 1) = '1' THEN
    cleaned := substring(cleaned, 2);
  END IF;
  RETURN cleaned;
END;
$$;

-- ============================================
-- SEED DEFAULT SCHEMA TEMPLATES
-- ============================================

INSERT INTO public.schema_templates (name, niche, description, fields, is_default) VALUES
(
  'Real Estate Agents',
  'real_estate',
  'Schema for scraping real estate agent leads',
  '[
    {"field_name": "mailing_address", "type": "string", "description": "Business or office mailing address", "extraction_hints": "Look for office address, location, physical address", "required": false},
    {"field_name": "license_number", "type": "string", "description": "Real estate license number", "extraction_hints": "DRE#, License#, RE License", "required": false},
    {"field_name": "brokerage", "type": "string", "description": "Brokerage or company name", "extraction_hints": "Brokerage, affiliated with, team at", "required": false},
    {"field_name": "specialties", "type": "array", "description": "Areas of specialization", "extraction_hints": "Specialties, focus areas, expertise in", "required": false}
  ]'::jsonb,
  true
),
(
  'Insurance Agents',
  'insurance',
  'Schema for scraping insurance agent leads',
  '[
    {"field_name": "mailing_address", "type": "string", "description": "Office mailing address", "extraction_hints": "Office address, location", "required": false},
    {"field_name": "license_number", "type": "string", "description": "Insurance license number", "extraction_hints": "License#, NPN, producer number", "required": false},
    {"field_name": "insurance_types", "type": "array", "description": "Types of insurance offered", "extraction_hints": "Auto, home, life, health, commercial", "required": false},
    {"field_name": "agency_name", "type": "string", "description": "Agency or company name", "extraction_hints": "Agency, affiliated with", "required": false}
  ]'::jsonb,
  true
),
(
  'B2B Contacts',
  'b2b',
  'Schema for B2B lead generation',
  '[
    {"field_name": "company_name", "type": "string", "description": "Company or organization name", "extraction_hints": "Company, organization, business name", "required": true},
    {"field_name": "job_title", "type": "string", "description": "Job title or position", "extraction_hints": "Title, position, role", "required": false},
    {"field_name": "department", "type": "string", "description": "Department within company", "extraction_hints": "Department, division, team", "required": false},
    {"field_name": "company_size", "type": "string", "description": "Number of employees", "extraction_hints": "Employees, team size, company size", "required": false},
    {"field_name": "industry", "type": "string", "description": "Industry or sector", "extraction_hints": "Industry, sector, vertical", "required": false},
    {"field_name": "headquarters_location", "type": "string", "description": "HQ location", "extraction_hints": "Headquarters, based in, located in", "required": false}
  ]'::jsonb,
  true
),
(
  'General Business',
  'general',
  'Generic schema for any business type',
  '[
    {"field_name": "business_type", "type": "string", "description": "Type of business", "extraction_hints": "Type, category, classification", "required": false},
    {"field_name": "services", "type": "array", "description": "Services offered", "extraction_hints": "Services, what we do, offerings", "required": false},
    {"field_name": "address", "type": "string", "description": "Business address", "extraction_hints": "Address, location, find us", "required": false}
  ]'::jsonb,
  true
);

-- Insert default enrichment provider configs
INSERT INTO public.enrichment_providers_config (provider, display_name, is_enabled) VALUES
('apollo', 'Apollo.io', false),
('hunter', 'Hunter.io', false),
('clearbit', 'Clearbit', false),
('manual', 'Manual Entry', true);