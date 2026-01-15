import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SourceMetrics {
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

interface OverallMetrics {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Authentication check
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: userError } = await authSupabase.auth.getUser();
  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid authentication' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { 
      start_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end_date = new Date().toISOString().split('T')[0],
      source_type,
    } = body;

    console.log(`Generating analytics from ${start_date} to ${end_date}`);

    // Get leads grouped by source type
    let leadsQuery = supabase
      .from('scraped_leads')
      .select('id, source_type, status, confidence_score, lead_score, created_at, enrichment_providers_used, email_validation_status, phone_validation_status, assigned_to_org')
      .gte('created_at', `${start_date}T00:00:00Z`)
      .lte('created_at', `${end_date}T23:59:59Z`);

    if (source_type) {
      leadsQuery = leadsQuery.eq('source_type', source_type);
    }

    const { data: leads, error: leadsError } = await leadsQuery;
    if (leadsError) throw leadsError;

    // Get enrichment costs
    const { data: enrichmentLogs } = await supabase
      .from('enrichment_logs')
      .select('lead_id, credits_used, cost_usd')
      .gte('created_at', `${start_date}T00:00:00Z`)
      .lte('created_at', `${end_date}T23:59:59Z`);

    // Get conversion events
    const { data: conversions } = await supabase
      .from('conversion_events')
      .select('lead_id, event_type, value_usd')
      .eq('event_type', 'won')
      .gte('recorded_at', `${start_date}T00:00:00Z`)
      .lte('recorded_at', `${end_date}T23:59:59Z`);

    // Build cost map
    const costByLead = new Map<string, number>();
    for (const log of enrichmentLogs || []) {
      const current = costByLead.get(log.lead_id) || 0;
      costByLead.set(log.lead_id, current + (log.cost_usd || 0));
    }

    // Build conversion set
    const convertedLeads = new Set((conversions || []).map(c => c.lead_id));

    // Group by source type
    const sourceMetricsMap = new Map<string, {
      leads_generated: number;
      leads_enriched: number;
      leads_verified: number;
      leads_assigned: number;
      leads_converted: number;
      total_confidence_score: number;
      total_lead_score: number;
      score_count: number;
      total_cost: number;
    }>();

    for (const lead of leads || []) {
      const source = lead.source_type || 'unknown';
      
      if (!sourceMetricsMap.has(source)) {
        sourceMetricsMap.set(source, {
          leads_generated: 0,
          leads_enriched: 0,
          leads_verified: 0,
          leads_assigned: 0,
          leads_converted: 0,
          total_confidence_score: 0,
          total_lead_score: 0,
          score_count: 0,
          total_cost: 0,
        });
      }

      const metrics = sourceMetricsMap.get(source)!;
      metrics.leads_generated++;

      if (lead.enrichment_providers_used && (lead.enrichment_providers_used as string[]).length > 0) {
        metrics.leads_enriched++;
      }

      if (lead.email_validation_status === 'verified' || lead.phone_validation_status === 'verified') {
        metrics.leads_verified++;
      }

      if (lead.assigned_to_org) {
        metrics.leads_assigned++;
      }

      if (convertedLeads.has(lead.id)) {
        metrics.leads_converted++;
      }

      if (lead.confidence_score) {
        metrics.total_confidence_score += lead.confidence_score;
        metrics.score_count++;
      }

      if (lead.lead_score) {
        metrics.total_lead_score += lead.lead_score;
      }

      metrics.total_cost += costByLead.get(lead.id) || 0;
    }

    // Convert to array
    const sourceMetrics: SourceMetrics[] = [];
    for (const [source, metrics] of sourceMetricsMap) {
      sourceMetrics.push({
        source_type: source,
        leads_generated: metrics.leads_generated,
        leads_enriched: metrics.leads_enriched,
        leads_verified: metrics.leads_verified,
        leads_assigned: metrics.leads_assigned,
        leads_converted: metrics.leads_converted,
        avg_confidence_score: metrics.score_count > 0 
          ? Math.round(metrics.total_confidence_score / metrics.score_count) 
          : 0,
        avg_lead_score: metrics.leads_generated > 0 
          ? Math.round(metrics.total_lead_score / metrics.leads_generated) 
          : 0,
        total_cost_usd: Math.round(metrics.total_cost * 100) / 100,
        cost_per_lead: metrics.leads_generated > 0 
          ? Math.round((metrics.total_cost / metrics.leads_generated) * 100) / 100 
          : 0,
        conversion_rate: metrics.leads_generated > 0 
          ? Math.round((metrics.leads_converted / metrics.leads_generated) * 10000) / 100 
          : 0,
      });
    }

    // Sort by leads generated
    sourceMetrics.sort((a, b) => b.leads_generated - a.leads_generated);

    // Calculate overall metrics
    const totalLeads = sourceMetrics.reduce((sum, s) => sum + s.leads_generated, 0);
    const totalEnriched = sourceMetrics.reduce((sum, s) => sum + s.leads_enriched, 0);
    const totalVerified = sourceMetrics.reduce((sum, s) => sum + s.leads_verified, 0);
    const totalAssigned = sourceMetrics.reduce((sum, s) => sum + s.leads_assigned, 0);
    const totalConverted = sourceMetrics.reduce((sum, s) => sum + s.leads_converted, 0);
    const totalCost = sourceMetrics.reduce((sum, s) => sum + s.total_cost_usd, 0);
    const avgScore = sourceMetrics.reduce((sum, s) => sum + s.avg_lead_score * s.leads_generated, 0) / (totalLeads || 1);

    const topSource = sourceMetrics[0]?.source_type || 'none';
    const bestConverting = [...sourceMetrics]
      .filter(s => s.leads_generated >= 5)
      .sort((a, b) => b.conversion_rate - a.conversion_rate)[0]?.source_type || 'none';

    const overallMetrics: OverallMetrics = {
      total_leads: totalLeads,
      total_enriched: totalEnriched,
      total_verified: totalVerified,
      total_assigned: totalAssigned,
      total_converted: totalConverted,
      total_cost: Math.round(totalCost * 100) / 100,
      avg_lead_score: Math.round(avgScore),
      conversion_rate: totalLeads > 0 ? Math.round((totalConverted / totalLeads) * 10000) / 100 : 0,
      top_source: topSource,
      best_converting_source: bestConverting,
    };

    // Store analytics for historical tracking
    for (const metrics of sourceMetrics) {
      await supabase
        .from('source_analytics')
        .upsert({
          source_type: metrics.source_type,
          source_identifier: 'all',
          period_start: start_date,
          period_end: end_date,
          leads_generated: metrics.leads_generated,
          leads_enriched: metrics.leads_enriched,
          leads_verified: metrics.leads_verified,
          leads_assigned: metrics.leads_assigned,
          leads_converted: metrics.leads_converted,
          avg_confidence_score: metrics.avg_confidence_score,
          avg_lead_score: metrics.avg_lead_score,
          total_cost_usd: metrics.total_cost_usd,
          cost_per_lead: metrics.cost_per_lead,
          cost_per_conversion: metrics.leads_converted > 0 
            ? metrics.total_cost_usd / metrics.leads_converted 
            : null,
        }, {
          onConflict: 'source_type,source_identifier,period_start',
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        period: { start: start_date, end: end_date },
        overall: overallMetrics,
        by_source: sourceMetrics,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in scraper-analytics:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
