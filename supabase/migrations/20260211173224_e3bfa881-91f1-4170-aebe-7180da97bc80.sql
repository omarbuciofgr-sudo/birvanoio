
-- Normalized evidence table for per-field provenance
CREATE TYPE public.evidence_type AS ENUM ('on_page_text', 'structured_data', 'pdf', 'enrichment_provider');

CREATE TABLE public.field_evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.scraped_leads(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,           -- e.g. 'email', 'phone', 'name', 'title', 'company', 'address'
  field_value TEXT NOT NULL,
  source_url TEXT,                    -- public web URL if applicable
  evidence_snippet TEXT,              -- 20-200 chars around the value
  evidence_type public.evidence_type NOT NULL,
  -- Enrichment provider fields (when evidence_type = 'enrichment_provider')
  provider_reference TEXT,            -- transaction/record ID
  provider_label TEXT DEFAULT 'Third-party provider',
  verification_method TEXT,           -- e.g. 'smtp_check', 'hlr_lookup'
  verification_result TEXT,           -- e.g. 'valid', 'invalid', 'catch_all'
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.field_evidence ENABLE ROW LEVEL SECURITY;

-- Admins can see all evidence
CREATE POLICY "Admins can view all evidence"
  ON public.field_evidence FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Client org users can see evidence for leads assigned to their org
CREATE POLICY "Client users can view assigned lead evidence"
  ON public.field_evidence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.scraped_leads sl
      JOIN public.client_users cu ON cu.organization_id = sl.assigned_to_org
      WHERE sl.id = field_evidence.lead_id
        AND cu.user_id = auth.uid()
    )
  );

-- Service role inserts only (edge functions)
CREATE POLICY "Service role insert evidence"
  ON public.field_evidence FOR INSERT
  WITH CHECK (false);

-- Indexes
CREATE INDEX idx_field_evidence_lead ON public.field_evidence (lead_id, field_name);
CREATE INDEX idx_field_evidence_type ON public.field_evidence (evidence_type);
