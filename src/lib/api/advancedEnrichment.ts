import { supabase } from '@/integrations/supabase/client';

// ============================================
// Technographics & Revenue Estimation API
// ============================================
export const technographicsApi = {
  async enrich(leadIds: string[]): Promise<{
    success: boolean;
    results: Array<{
      lead_id: string;
      technologies: string[];
      revenue_estimate: string | null;
      social_profiles: Record<string, string>;
    }>;
  }> {
    const { data, error } = await supabase.functions.invoke('technographics-enrichment', {
      body: { lead_ids: leadIds },
    });
    if (error) throw error;
    return data;
  },
};

// ============================================
// Review Sentiment Analysis API
// ============================================
export const reviewSentimentApi = {
  async analyze(leadIds: string[]): Promise<{
    success: boolean;
    results: Array<{
      lead_id: string;
      analysis: {
        overall_sentiment: string;
        sentiment_score: number;
        pain_points: string[];
        strengths: string[];
        outreach_hooks: string[];
        review_count: number;
        avg_rating: number | null;
      } | null;
    }>;
  }> {
    const { data, error } = await supabase.functions.invoke('review-sentiment-analysis', {
      body: { lead_ids: leadIds },
    });
    if (error) throw error;
    return data;
  },
};

// ============================================
// Contact Page Deep Extraction API
// ============================================
export const contactPageApi = {
  async extract(leadIds: string[]): Promise<{
    success: boolean;
    results: Array<{
      lead_id: string;
      people_found: number;
      pages_scraped: string[];
    }>;
  }> {
    const { data, error } = await supabase.functions.invoke('contact-page-extractor', {
      body: { lead_ids: leadIds },
    });
    if (error) throw error;
    return data;
  },
};

// ============================================
// Auto-Nurture & Hot Lead Alerts API
// ============================================
export const autoNurtureApi = {
  async trigger(mode: 'auto' | 'alerts_only' | 'nurture_only' = 'auto'): Promise<{
    success: boolean;
    hot_lead_alerts: number;
    nurture_enrolled: number;
    webhooks_fired: number;
  }> {
    const { data, error } = await supabase.functions.invoke('auto-nurture-alerts', {
      body: { mode },
    });
    if (error) throw error;
    return data;
  },
};

// ============================================
// Re-Enrichment (Stale Leads) API
// ============================================
export const reEnrichApi = {
  async reEnrichStale(options?: {
    threshold_days?: number;
    max_leads?: number;
    lead_ids?: string[];
  }): Promise<{
    success: boolean;
    re_enriched: number;
    total_stale: number;
    errors?: string[];
  }> {
    const { data, error } = await supabase.functions.invoke('re-enrich-stale', {
      body: options || {},
    });
    if (error) throw error;
    return data;
  },
};

// ============================================
// Bounce Tracking API
// ============================================
export const bounceTrackingApi = {
  async reportBounce(email: string, bounceType = 'hard_bounce'): Promise<{
    success: boolean;
    email: string;
    leads_updated: number;
    suppressed: boolean;
  }> {
    const { data, error } = await supabase.functions.invoke('bounce-tracking', {
      body: { type: 'manual_bounce', data: { email, bounce_type: bounceType } },
    });
    if (error) throw error;
    return data;
  },
};

// ============================================
// Competitor Monitoring API
// ============================================
export const competitorMonitoringApi = {
  async scan(leadIds: string[]): Promise<{
    success: boolean;
    results: Array<{
      lead_id: string;
      hiring_signals: boolean;
      job_count_estimate: number;
      competitor_mentions: string[];
      signals_created: number;
    }>;
  }> {
    const { data, error } = await supabase.functions.invoke('competitor-monitoring', {
      body: { lead_ids: leadIds },
    });
    if (error) throw error;
    return data;
  },
};
