import { supabase } from '@/integrations/supabase/client';

// ============================================
// Enrichment Rules API
// ============================================
export interface EnrichmentRule {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_on: string;
  min_score: number;
  enrich_email: boolean;
  enrich_phone: boolean;
  enrich_company: boolean;
  enrich_linkedin: boolean;
  max_credits_per_lead: number;
  created_at: string;
  updated_at: string;
}

export const enrichmentRulesApi = {
  async list(): Promise<EnrichmentRule[]> {
    const { data, error } = await supabase
      .from('enrichment_rules')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []) as EnrichmentRule[];
  },

  async create(input: Partial<EnrichmentRule>): Promise<EnrichmentRule> {
    const { data, error } = await supabase
      .from('enrichment_rules')
      .insert([input as any])
      .select()
      .single();
    
    if (error) throw error;
    return data as EnrichmentRule;
  },

  async update(id: string, input: Partial<EnrichmentRule>): Promise<EnrichmentRule> {
    const { data, error } = await supabase
      .from('enrichment_rules')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as EnrichmentRule;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('enrichment_rules')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};

// ============================================
// Lead Routing Rules API
// ============================================
export interface LeadRoutingRule {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  priority: number;
  criteria_industry: string[] | null;
  criteria_state: string[] | null;
  criteria_min_score: number | null;
  criteria_max_score: number | null;
  criteria_lead_type: string[] | null;
  assign_to_org: string | null;
  assign_to_user: string | null;
  auto_enrich: boolean;
  send_webhook: boolean;
  webhook_url: string | null;
  created_at: string;
  updated_at: string;
}

export const leadRoutingRulesApi = {
  async list(): Promise<LeadRoutingRule[]> {
    const { data, error } = await supabase
      .from('lead_routing_rules')
      .select('*')
      .order('priority', { ascending: false });
    
    if (error) throw error;
    return (data || []) as LeadRoutingRule[];
  },

  async create(input: Partial<LeadRoutingRule>): Promise<LeadRoutingRule> {
    const { data, error } = await supabase
      .from('lead_routing_rules')
      .insert([input as any])
      .select()
      .single();
    
    if (error) throw error;
    return data as LeadRoutingRule;
  },

  async update(id: string, input: Partial<LeadRoutingRule>): Promise<LeadRoutingRule> {
    const { data, error } = await supabase
      .from('lead_routing_rules')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as LeadRoutingRule;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('lead_routing_rules')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async applyToLeads(leadIds: string[], dryRun = false): Promise<{
    success: boolean;
    routed: number;
    results: Array<{ lead_id: string; matched_rule: string | null; actions: string[] }>;
  }> {
    const { data, error } = await supabase.functions.invoke('apply-routing-rules', {
      body: { lead_ids: leadIds, dry_run: dryRun },
    });
    
    if (error) throw error;
    return data;
  },
};

// ============================================
// Scheduled Jobs API
// ============================================
export interface ScheduledScrapeJob {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  schedule_type: string;
  schedule_hour: number;
  schedule_day_of_week: number | null;
  schedule_day_of_month: number | null;
  target_urls: string[];
  schema_template_id: string | null;
  input_method: string;
  search_query: string | null;
  search_location: string | null;
  max_results: number;
  last_run_at: string | null;
  next_run_at: string | null;
  last_run_job_id: string | null;
  run_count: number;
  created_at: string;
  updated_at: string;
}

export const scheduledJobsApi = {
  async list(): Promise<ScheduledScrapeJob[]> {
    const { data, error } = await supabase
      .from('scheduled_scrape_jobs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []) as unknown as ScheduledScrapeJob[];
  },

  async create(input: Partial<ScheduledScrapeJob>): Promise<ScheduledScrapeJob> {
    const { data, error } = await supabase
      .from('scheduled_scrape_jobs')
      .insert([input as any])
      .select()
      .single();
    
    if (error) throw error;
    return data as unknown as ScheduledScrapeJob;
  },

  async update(id: string, input: Partial<ScheduledScrapeJob>): Promise<ScheduledScrapeJob> {
    const { data, error } = await supabase
      .from('scheduled_scrape_jobs')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as unknown as ScheduledScrapeJob;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('scheduled_scrape_jobs')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async runNow(id: string): Promise<{ success: boolean; scrape_job_id?: string }> {
    const { data, error } = await supabase.functions.invoke('run-scheduled-jobs', {
      body: { job_id: id },
    });
    
    if (error) throw error;
    return data?.results?.[0] || { success: false };
  },
};

// ============================================
// Intent Signals API
// ============================================
export interface IntentSignal {
  id: string;
  lead_id: string;
  signal_type: string;
  signal_source: string | null;
  signal_data: Record<string, unknown>;
  confidence_score: number;
  detected_at: string;
  expires_at: string | null;
  is_processed: boolean;
}

export const intentSignalsApi = {
  async getForLead(leadId: string): Promise<IntentSignal[]> {
    const { data, error } = await supabase
      .from('intent_signals')
      .select('*')
      .eq('lead_id', leadId)
      .order('detected_at', { ascending: false });
    
    if (error) throw error;
    return (data || []) as IntentSignal[];
  },

  async detectSignals(leadIds: string[]): Promise<{
    success: boolean;
    total_signals_detected: number;
    results: Array<{ lead_id: string; signals_detected: number }>;
  }> {
    const { data, error } = await supabase.functions.invoke('detect-intent-signals', {
      body: { lead_ids: leadIds },
    });
    
    if (error) throw error;
    return data;
  },
};

// ============================================
// Webhook Triggers API
// ============================================
export const webhookTriggersApi = {
  async triggerForLeads(
    leadIds: string[],
    eventType = 'high_priority_lead',
    triggerReason = 'manual'
  ): Promise<{
    success: boolean;
    total_webhooks_triggered: number;
  }> {
    const { data, error } = await supabase.functions.invoke('trigger-lead-webhook', {
      body: { 
        lead_ids: leadIds, 
        event_type: eventType,
        trigger_reason: triggerReason,
      },
    });
    
    if (error) throw error;
    return data;
  },
};

// ============================================
// Analytics API
// ============================================
export interface SourceMetrics {
  source_type: string;
  leads_generated: number;
  leads_enriched: number;
  leads_verified: number;
  leads_assigned: number;
  leads_converted: number;
  avg_confidence_score: number;
  avg_lead_score: number;
  total_cost_usd: number;
  cost_per_lead: number;
  conversion_rate: number;
}

export interface OverallMetrics {
  total_leads: number;
  total_enriched: number;
  total_verified: number;
  total_assigned: number;
  total_converted: number;
  total_cost: number;
  avg_lead_score: number;
  conversion_rate: number;
  top_source: string;
  best_converting_source: string;
}

export const scraperAnalyticsApi = {
  async getAnalytics(startDate?: string, endDate?: string): Promise<{
    success: boolean;
    period: { start: string; end: string };
    overall: OverallMetrics;
    by_source: SourceMetrics[];
  }> {
    const { data, error } = await supabase.functions.invoke('scraper-analytics', {
      body: { start_date: startDate, end_date: endDate },
    });
    
    if (error) throw error;
    return data;
  },
};

// ============================================
// Conversion Events API
// ============================================
export interface ConversionEvent {
  id: string;
  lead_id: string | null;
  client_lead_id: string | null;
  event_type: string;
  event_data: Record<string, unknown> | null;
  value_usd: number | null;
  recorded_by: string | null;
  recorded_at: string;
}

export const conversionEventsApi = {
  async recordConversion(input: {
    lead_id?: string;
    client_lead_id?: string;
    event_type: string;
    event_data?: Record<string, unknown>;
    value_usd?: number;
  }): Promise<ConversionEvent> {
    const { data: userData } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('conversion_events')
      .insert([{
        ...input,
        recorded_by: userData.user?.id,
      } as any])
      .select()
      .single();
    
    if (error) throw error;
    return data as ConversionEvent;
  },

  async getForLead(leadId: string): Promise<ConversionEvent[]> {
    const { data, error } = await supabase
      .from('conversion_events')
      .select('*')
      .eq('lead_id', leadId)
      .order('recorded_at', { ascending: false });
    
    if (error) throw error;
    return (data || []) as ConversionEvent[];
  },
};

// ============================================
// Validation API (Enhanced)
// ============================================
export const validationApi = {
  async validateLeads(leadIds: string[], validateEmail = true, validatePhone = true): Promise<{
    success: boolean;
    results: Array<{
      lead_id: string;
      email_result?: { status: string; notes: string };
      phone_result?: { status: string; lineType: string | null; notes: string };
    }>;
  }> {
    const { data, error } = await supabase.functions.invoke('validate-lead', {
      body: { lead_ids: leadIds, validate_email: validateEmail, validate_phone: validatePhone },
    });
    
    if (error) throw error;
    return data;
  },
};

// ============================================
// Deduplication API
// ============================================
export const deduplicationApi = {
  async findDuplicates(options: {
    job_id?: string;
    lead_ids?: string[];
    auto_merge?: boolean;
  }): Promise<{
    success: boolean;
    duplicates_found: number;
    merged_count: number;
    duplicate_pairs: Array<{
      primary_id: string;
      duplicate_id: string;
      match_reason: string;
    }>;
  }> {
    const { data, error } = await supabase.functions.invoke('dedupe-leads', {
      body: options,
    });
    
    if (error) throw error;
    return data;
  },
};

// ============================================
// Export Utilities
// ============================================
export const exportUtils = {
  exportToCSV(
    leads: Array<Record<string, unknown>>,
    includeScoring = true,
    includeIntentSignals = true
  ): string {
    if (leads.length === 0) return '';

    const baseColumns = [
      'id', 'domain', 'full_name', 'best_email', 'best_phone',
      'status', 'priority', 'confidence_score', 'created_at'
    ];

    const scoringColumns = includeScoring ? [
      'lead_score', 'ai_insights', 'recommended_action'
    ] : [];

    const intentColumns = includeIntentSignals ? [
      'intent_signals_count', 'latest_intent_signal'
    ] : [];

    const enrichmentColumns = [
      'company_name', 'job_title', 'employee_count', 'industry'
    ];

    const allColumns = [...baseColumns, ...scoringColumns, ...intentColumns, ...enrichmentColumns];

    const rows: string[] = [];
    rows.push(allColumns.join(','));

    for (const lead of leads) {
      const row = allColumns.map(col => {
        let value: unknown;
        
        if (col.startsWith('company_') || col === 'job_title' || col === 'employee_count' || col === 'industry') {
          const enrichmentData = lead.enrichment_data as Record<string, unknown> || {};
          value = enrichmentData[col] || '';
        } else {
          value = lead[col];
        }
        
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      });
      rows.push(row.join(','));
    }

    return rows.join('\n');
  },

  downloadCSV(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};
