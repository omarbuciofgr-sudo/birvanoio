-- ============================================
-- Enrichment Rules (Auto-Enrich based on criteria)
-- ============================================
CREATE TABLE public.enrichment_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  trigger_on TEXT NOT NULL DEFAULT 'score_above', -- score_above, new_lead, manual
  min_score INTEGER DEFAULT 70,
  enrich_email BOOLEAN DEFAULT true,
  enrich_phone BOOLEAN DEFAULT true,
  enrich_company BOOLEAN DEFAULT true,
  enrich_linkedin BOOLEAN DEFAULT true,
  max_credits_per_lead NUMERIC(10,2) DEFAULT 0.50,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.enrichment_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage enrichment rules" ON public.enrichment_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- Lead Routing Rules (Auto-assign to team/org)
-- ============================================
CREATE TABLE public.lead_routing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Higher = check first
  -- Criteria
  criteria_industry TEXT[], -- Match any of these industries
  criteria_state TEXT[], -- Match any of these states
  criteria_min_score INTEGER,
  criteria_max_score INTEGER,
  criteria_lead_type TEXT[], -- e.g., fsbo, b2b
  -- Assignment
  assign_to_org UUID REFERENCES public.client_organizations(id),
  assign_to_user UUID REFERENCES auth.users(id),
  -- Actions
  auto_enrich BOOLEAN DEFAULT false,
  send_webhook BOOLEAN DEFAULT false,
  webhook_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage routing rules" ON public.lead_routing_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- Scheduled Jobs (Cron-like job scheduling)
-- ============================================
CREATE TABLE public.scheduled_scrape_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  -- Schedule (simplified cron-like)
  schedule_type TEXT NOT NULL DEFAULT 'daily', -- hourly, daily, weekly, monthly
  schedule_hour INTEGER DEFAULT 9, -- 0-23
  schedule_day_of_week INTEGER, -- 0-6 for weekly (0=Sunday)
  schedule_day_of_month INTEGER, -- 1-31 for monthly
  -- Job configuration (copy from scrape_jobs)
  target_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  schema_template_id UUID REFERENCES public.schema_templates(id),
  input_method TEXT DEFAULT 'url_list',
  search_query TEXT, -- For Google Places based jobs
  search_location TEXT,
  max_results INTEGER DEFAULT 50,
  -- Execution tracking
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  last_run_job_id UUID REFERENCES public.scrape_jobs(id),
  run_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_scrape_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage scheduled jobs" ON public.scheduled_scrape_jobs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- Intent Signals (Track buying signals)
-- ============================================
CREATE TABLE public.intent_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.scraped_leads(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL, -- hiring, funding, technology_change, expansion, leadership_change
  signal_source TEXT, -- linkedin, news, job_boards, crunchbase
  signal_data JSONB,
  confidence_score INTEGER DEFAULT 50, -- 0-100
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE, -- Some signals are time-sensitive
  is_processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.intent_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view intent signals" ON public.intent_signals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Clients can view their org intent signals" ON public.intent_signals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.scraped_leads sl
      JOIN public.client_users cu ON cu.organization_id = sl.assigned_to_org
      WHERE sl.id = intent_signals.lead_id AND cu.user_id = auth.uid()
    )
  );

-- ============================================
-- Source Analytics (Track source performance)
-- ============================================
CREATE TABLE public.source_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type TEXT NOT NULL, -- google_places, firecrawl, csv_import, manual, apollo
  source_identifier TEXT, -- e.g., search query, job_id
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  -- Metrics
  leads_generated INTEGER DEFAULT 0,
  leads_enriched INTEGER DEFAULT 0,
  leads_verified INTEGER DEFAULT 0,
  leads_assigned INTEGER DEFAULT 0,
  leads_converted INTEGER DEFAULT 0,
  avg_confidence_score NUMERIC(5,2),
  avg_lead_score NUMERIC(5,2),
  -- Costs
  total_cost_usd NUMERIC(10,2) DEFAULT 0,
  cost_per_lead NUMERIC(10,2),
  cost_per_conversion NUMERIC(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(source_type, source_identifier, period_start)
);

ALTER TABLE public.source_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view source analytics" ON public.source_analytics
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- Conversion Events (Track lead conversions)
-- ============================================
CREATE TABLE public.conversion_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.scraped_leads(id) ON DELETE CASCADE,
  client_lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE, -- For client-side leads
  event_type TEXT NOT NULL, -- contacted, qualified, proposal_sent, won, lost
  event_data JSONB,
  value_usd NUMERIC(12,2), -- Deal value if applicable
  recorded_by UUID REFERENCES auth.users(id),
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.conversion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage conversion events" ON public.conversion_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Clients can add conversion events for their leads" ON public.conversion_events
  FOR INSERT WITH CHECK (
    recorded_by = auth.uid() AND (
      client_lead_id IS NOT NULL OR
      EXISTS (
        SELECT 1 FROM public.scraped_leads sl
        JOIN public.client_users cu ON cu.organization_id = sl.assigned_to_org
        WHERE sl.id = conversion_events.lead_id AND cu.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Clients can view their conversion events" ON public.conversion_events
  FOR SELECT USING (
    recorded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.scraped_leads sl
      JOIN public.client_users cu ON cu.organization_id = sl.assigned_to_org
      WHERE sl.id = conversion_events.lead_id AND cu.user_id = auth.uid()
    )
  );

-- ============================================
-- Enrichment Cost Tracking (Add to existing enrichment_logs)
-- ============================================
ALTER TABLE public.enrichment_logs ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(8,4);

-- ============================================
-- Add scoring fields to scraped_leads
-- ============================================
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS lead_score INTEGER;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS score_breakdown JSONB;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS ai_insights TEXT;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS recommended_action TEXT;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'scrape';

-- ============================================
-- Add intent signals summary to scraped_leads
-- ============================================
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS intent_signals_count INTEGER DEFAULT 0;
ALTER TABLE public.scraped_leads ADD COLUMN IF NOT EXISTS latest_intent_signal TEXT;

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_intent_signals_lead_id ON public.intent_signals(lead_id);
CREATE INDEX IF NOT EXISTS idx_intent_signals_signal_type ON public.intent_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_conversion_events_lead_id ON public.conversion_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_client_lead_id ON public.conversion_events(client_lead_id);
CREATE INDEX IF NOT EXISTS idx_source_analytics_source_type ON public.source_analytics(source_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_scrape_jobs_next_run ON public.scheduled_scrape_jobs(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scraped_leads_priority ON public.scraped_leads(priority);
CREATE INDEX IF NOT EXISTS idx_scraped_leads_lead_score ON public.scraped_leads(lead_score);

-- ============================================
-- Function to update lead intent signals count
-- ============================================
CREATE OR REPLACE FUNCTION update_lead_intent_signals_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.scraped_leads
  SET 
    intent_signals_count = (
      SELECT COUNT(*) FROM public.intent_signals WHERE lead_id = NEW.lead_id
    ),
    latest_intent_signal = NEW.signal_type
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_update_intent_signals_count
AFTER INSERT ON public.intent_signals
FOR EACH ROW
EXECUTE FUNCTION update_lead_intent_signals_count();