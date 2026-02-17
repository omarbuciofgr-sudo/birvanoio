-- ============================================
-- Create scraped_leads table (standalone script)
-- Run this in Supabase Dashboard → SQL Editor if the table is missing
-- (e.g. when the app uses a project where birvanoio migrations were not run)
-- ============================================

-- 1. Enums (idempotent)
DO $$ BEGIN
  CREATE TYPE public.scrape_job_status AS ENUM (
    'draft', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.validation_status AS ENUM (
    'unverified', 'likely_valid', 'verified', 'invalid'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.scraped_lead_status AS ENUM (
    'new', 'review', 'approved', 'assigned', 'in_progress', 'won', 'lost', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Helper function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. Dependency tables (minimal, IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.schema_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  niche TEXT NOT NULL DEFAULT 'general',
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  schema_template_id UUID REFERENCES public.schema_templates(id) ON DELETE SET NULL,
  status public.scrape_job_status NOT NULL DEFAULT 'draft',
  target_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  input_method TEXT DEFAULT 'paste',
  max_pages_per_domain INTEGER DEFAULT 50,
  respect_robots_txt BOOLEAN DEFAULT true,
  use_playwright_fallback BOOLEAN DEFAULT true,
  request_delay_ms INTEGER DEFAULT 1000,
  total_targets INTEGER DEFAULT 0,
  completed_targets INTEGER DEFAULT 0,
  failed_targets INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. scraped_leads table
CREATE TABLE IF NOT EXISTS public.scraped_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.scrape_jobs(id) ON DELETE SET NULL,
  assigned_to_org UUID REFERENCES public.client_organizations(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  status public.scraped_lead_status NOT NULL DEFAULT 'new',
  domain TEXT NOT NULL,
  source_url TEXT,
  full_name TEXT,
  best_email TEXT,
  all_emails JSONB DEFAULT '[]'::jsonb,
  best_phone TEXT,
  all_phones JSONB DEFAULT '[]'::jsonb,
  contact_form_url TEXT,
  name_source_url TEXT,
  email_source_url TEXT,
  phone_source_url TEXT,
  contact_form_source_url TEXT,
  linkedin_search_url TEXT,
  email_validation_status public.validation_status DEFAULT 'unverified',
  email_validation_notes TEXT,
  phone_validation_status public.validation_status DEFAULT 'unverified',
  phone_line_type TEXT,
  phone_validation_notes TEXT,
  confidence_score INTEGER DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  qc_flag TEXT,
  qc_notes TEXT,
  schema_template_id UUID REFERENCES public.schema_templates(id) ON DELETE SET NULL,
  schema_data JSONB DEFAULT '{}'::jsonb,
  schema_evidence JSONB DEFAULT '{}'::jsonb,
  enrichment_data JSONB DEFAULT '{}'::jsonb,
  enrichment_providers_used JSONB DEFAULT '[]'::jsonb,
  scraped_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Add columns that may be added by later migrations (idempotent)
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS lead_type TEXT DEFAULT 'company';
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'scrape';
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS name_evidence_snippet TEXT;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS name_evidence_type TEXT DEFAULT 'on_page_text';
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS email_evidence_snippet TEXT;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS email_evidence_type TEXT DEFAULT 'on_page_text';
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS phone_evidence_snippet TEXT;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS phone_evidence_type TEXT DEFAULT 'on_page_text';
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS address_source_url TEXT;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS address_evidence_snippet TEXT;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS address_evidence_type TEXT DEFAULT 'on_page_text';
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS best_contact_title TEXT;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS best_contact_selection_reason TEXT;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS reviewed_by UUID;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS email_verification_method TEXT;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS email_verification_result JSONB;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS phone_verification_method TEXT;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS phone_verification_result JSONB;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS is_suppressed BOOLEAN DEFAULT false;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS suppression_reason TEXT;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS lead_score INTEGER;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS score_breakdown JSONB;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS ai_insights TEXT;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS recommended_action TEXT;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS intent_signals_count INTEGER DEFAULT 0;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS latest_intent_signal TEXT;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_scraped_leads_job_id ON public.scraped_leads(job_id);
CREATE INDEX IF NOT EXISTS idx_scraped_leads_assigned_to_org ON public.scraped_leads(assigned_to_org);
CREATE INDEX IF NOT EXISTS idx_scraped_leads_status ON public.scraped_leads(status);
CREATE INDEX IF NOT EXISTS idx_scraped_leads_domain ON public.scraped_leads(domain);
CREATE INDEX IF NOT EXISTS idx_scraped_leads_best_email ON public.scraped_leads(best_email);
CREATE INDEX IF NOT EXISTS idx_scraped_leads_best_phone ON public.scraped_leads(best_phone);
CREATE INDEX IF NOT EXISTS idx_scraped_leads_tags ON public.scraped_leads USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_scraped_leads_priority ON public.scraped_leads(priority);
CREATE INDEX IF NOT EXISTS idx_scraped_leads_lead_score ON public.scraped_leads(lead_score);

-- 7. RLS: allow authenticated users to manage scraped_leads (so "Save to Database" works)
ALTER TABLE public.scraped_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated full access scraped_leads" ON public.scraped_leads;
CREATE POLICY "Allow authenticated full access scraped_leads" ON public.scraped_leads
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- If you use admin/client roles and prefer strict policies, run the birvanoio migrations instead
-- and drop the policy above; the migration policies will apply.

-- 8. Trigger for updated_at
DROP TRIGGER IF EXISTS update_scraped_leads_updated_at ON public.scraped_leads;
CREATE TRIGGER update_scraped_leads_updated_at
  BEFORE UPDATE ON public.scraped_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. field_evidence table (used by Lead detail sheet / FieldEvidencePanel)
DO $$ BEGIN
  CREATE TYPE public.evidence_type AS ENUM ('on_page_text', 'structured_data', 'pdf', 'enrichment_provider');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.field_evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.scraped_leads(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_value TEXT NOT NULL,
  source_url TEXT,
  evidence_snippet TEXT,
  evidence_type public.evidence_type NOT NULL,
  provider_reference TEXT,
  provider_label TEXT DEFAULT 'Third-party provider',
  verification_method TEXT,
  verification_result TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.field_evidence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read field_evidence" ON public.field_evidence;
CREATE POLICY "Allow authenticated read field_evidence" ON public.field_evidence
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_field_evidence_lead ON public.field_evidence (lead_id, field_name);
CREATE INDEX IF NOT EXISTS idx_field_evidence_type ON public.field_evidence (evidence_type);
