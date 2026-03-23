-- Lead scoring configuration table
CREATE TABLE public.lead_scoring_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'default',
  description text,
  is_active boolean DEFAULT true,
  
  -- Contact data weights (0-100)
  weight_has_email integer DEFAULT 15,
  weight_email_verified integer DEFAULT 10,
  weight_has_phone integer DEFAULT 15,
  weight_phone_verified integer DEFAULT 10,
  weight_has_address integer DEFAULT 5,
  
  -- Engagement weights
  weight_intent_signal integer DEFAULT 8,
  weight_recent_activity integer DEFAULT 10,
  weight_website_quality integer DEFAULT 5,
  
  -- Business quality weights
  weight_company_size_match integer DEFAULT 10,
  weight_industry_match integer DEFAULT 12,
  weight_location_match integer DEFAULT 5,
  
  -- Thresholds
  threshold_hot integer DEFAULT 80,
  threshold_warm integer DEFAULT 50,
  threshold_cold integer DEFAULT 25,
  
  -- Metadata
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Digest subscription preferences
CREATE TABLE public.digest_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.client_organizations(id),
  
  -- Digest settings
  digest_frequency text NOT NULL DEFAULT 'daily' CHECK (digest_frequency IN ('daily', 'weekly', 'none')),
  digest_day_of_week integer DEFAULT 1, -- 0=Sunday, 1=Monday, etc.
  digest_hour integer DEFAULT 9, -- 9 AM
  
  -- Content preferences
  include_new_leads boolean DEFAULT true,
  include_job_summary boolean DEFAULT true,
  include_metrics boolean DEFAULT true,
  include_alerts boolean DEFAULT true,
  
  -- Contact
  email_address text NOT NULL,
  
  -- Status
  last_sent_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Notification channels (Slack, Teams, etc.)
CREATE TABLE public.notification_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  channel_type text NOT NULL CHECK (channel_type IN ('slack', 'teams', 'email', 'webhook')),
  
  -- Configuration
  webhook_url text,
  config jsonb DEFAULT '{}',
  
  -- Triggers
  notify_on_high_value_lead boolean DEFAULT true,
  notify_on_job_failure boolean DEFAULT true,
  notify_on_job_complete boolean DEFAULT false,
  notify_on_daily_summary boolean DEFAULT false,
  
  -- Thresholds
  high_value_lead_score integer DEFAULT 80,
  
  -- Status
  is_active boolean DEFAULT true,
  last_triggered_at timestamptz,
  failure_count integer DEFAULT 0,
  
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- CRM integration config
CREATE TABLE public.crm_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  crm_type text NOT NULL CHECK (crm_type IN ('salesforce', 'hubspot', 'pipedrive', 'zoho', 'custom')),
  
  -- Auth (encrypted/hashed)
  api_key_secret_name text,
  instance_url text,
  
  -- Sync settings
  auto_sync_enabled boolean DEFAULT false,
  sync_on_status text[] DEFAULT ARRAY['approved', 'assigned'],
  field_mapping jsonb DEFAULT '{}',
  
  -- Status
  is_active boolean DEFAULT true,
  last_sync_at timestamptz,
  sync_error text,
  leads_synced_count integer DEFAULT 0,
  
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Performance metrics log
CREATE TABLE public.performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  metric_type text NOT NULL,
  
  -- Values
  value_numeric numeric,
  value_json jsonb,
  
  -- Context
  endpoint text,
  operation text,
  
  -- Aggregation period
  period_start timestamptz,
  period_end timestamptz
);

-- Backup jobs
CREATE TABLE public.backup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  
  -- Schedule
  frequency text NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  day_of_week integer DEFAULT 0, -- Sunday
  hour integer DEFAULT 2, -- 2 AM
  
  -- Destination
  destination_type text NOT NULL CHECK (destination_type IN ('email', 's3', 'gcs', 'azure')),
  destination_config jsonb DEFAULT '{}',
  
  -- Content
  include_leads boolean DEFAULT true,
  include_analytics boolean DEFAULT true,
  include_audit_log boolean DEFAULT false,
  export_format text DEFAULT 'csv' CHECK (export_format IN ('csv', 'json', 'xlsx')),
  
  -- Filters
  lead_status_filter text[],
  date_range_days integer DEFAULT 30,
  
  -- Status
  is_active boolean DEFAULT true,
  last_run_at timestamptz,
  last_run_status text,
  last_run_record_count integer,
  
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_scoring_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digest_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_scoring_config
CREATE POLICY "Admins can manage scoring config"
  ON public.lead_scoring_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view active config"
  ON public.lead_scoring_config FOR SELECT
  USING (is_active = true);

-- RLS policies for digest_subscriptions
CREATE POLICY "Users can manage their own digests"
  ON public.digest_subscriptions FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all digests"
  ON public.digest_subscriptions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for notification_channels
CREATE POLICY "Admins can manage notification channels"
  ON public.notification_channels FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for crm_integrations
CREATE POLICY "Admins can manage CRM integrations"
  ON public.crm_integrations FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for performance_metrics
CREATE POLICY "Admins can view performance metrics"
  ON public.performance_metrics FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert metrics"
  ON public.performance_metrics FOR ALL
  USING (auth.role() = 'service_role');

-- RLS policies for backup_jobs
CREATE POLICY "Admins can manage backup jobs"
  ON public.backup_jobs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_digest_subscriptions_user ON public.digest_subscriptions(user_id);
CREATE INDEX idx_notification_channels_active ON public.notification_channels(is_active) WHERE is_active = true;
CREATE INDEX idx_performance_metrics_type ON public.performance_metrics(metric_type, recorded_at);
CREATE INDEX idx_backup_jobs_next_run ON public.backup_jobs(frequency, is_active);

-- Insert default scoring config
INSERT INTO public.lead_scoring_config (name, description) 
VALUES ('default', 'Default lead scoring weights and thresholds');