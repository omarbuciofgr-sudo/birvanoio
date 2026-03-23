import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const routingRequestSchema = z.object({
  lead_id: z.string().uuid().optional(),
  lead_ids: z.array(z.string().uuid()).max(100).optional(),
  dry_run: z.boolean().optional().default(false),
}).refine(
  data => data.lead_id || (data.lead_ids && data.lead_ids.length > 0),
  { message: 'Either lead_id or lead_ids must be provided' }
);

interface RoutingRule {
  id: string;
  name: string;
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
}

interface Lead {
  id: string;
  lead_score: number | null;
  lead_type: string | null;
  schema_data: Record<string, unknown> | null;
  enrichment_data: Record<string, unknown> | null;
}

function leadMatchesRule(lead: Lead, rule: RoutingRule): boolean {
  // Check score criteria
  if (rule.criteria_min_score !== null && (lead.lead_score || 0) < rule.criteria_min_score) {
    return false;
  }
  if (rule.criteria_max_score !== null && (lead.lead_score || 0) > rule.criteria_max_score) {
    return false;
  }

  // Check lead type
  if (rule.criteria_lead_type && rule.criteria_lead_type.length > 0) {
    if (!lead.lead_type || !rule.criteria_lead_type.includes(lead.lead_type)) {
      return false;
    }
  }

  // Check industry
  if (rule.criteria_industry && rule.criteria_industry.length > 0) {
    const leadIndustry = (lead.enrichment_data?.industry as string) || 
                         (lead.schema_data?.industry as string) || '';
    const matchesIndustry = rule.criteria_industry.some(ind => 
      leadIndustry.toLowerCase().includes(ind.toLowerCase())
    );
    if (!matchesIndustry) {
      return false;
    }
  }

  // Check state
  if (rule.criteria_state && rule.criteria_state.length > 0) {
    const leadState = (lead.schema_data?.state as string) || 
                      (lead.enrichment_data?.headquarters_state as string) || '';
    const matchesState = rule.criteria_state.some(state => 
      leadState.toLowerCase() === state.toLowerCase() ||
      leadState.toUpperCase() === state.toUpperCase()
    );
    if (!matchesState) {
      return false;
    }
  }

  return true;
}

async function sendWebhook(webhookUrl: string, lead: Lead, rule: RoutingRule): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'lead_routed',
        timestamp: new Date().toISOString(),
        rule_name: rule.name,
        lead: {
          id: lead.id,
          score: lead.lead_score,
          type: lead.lead_type,
          data: lead.schema_data,
        },
      }),
    });
    return response.ok;
  } catch (error) {
    console.error('Webhook failed:', error);
    return false;
  }
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
    // Parse and validate input
    const body = await req.json().catch(() => ({}));
    const parseResult = routingRequestSchema.safeParse(body);
    
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid request format',
          validation_errors: parseResult.error.errors.map(e => e.message)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { lead_id, lead_ids, dry_run } = parseResult.data;
    const idsToProcess = lead_ids || (lead_id ? [lead_id] : []);

    // Fetch active routing rules ordered by priority
    const { data: rules, error: rulesError } = await supabase
      .from('lead_routing_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (rulesError) throw rulesError;

    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active routing rules', routed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Applying ${rules.length} routing rules to ${idsToProcess.length} leads`);

    const results: { lead_id: string; matched_rule: string | null; actions: string[] }[] = [];
    let routedCount = 0;

    for (const leadId of idsToProcess) {
      // Fetch lead
      const { data: lead, error: fetchError } = await supabase
        .from('scraped_leads')
        .select('id, lead_score, lead_type, schema_data, enrichment_data')
        .eq('id', leadId)
        .single();

      if (fetchError || !lead) {
        results.push({ lead_id: leadId, matched_rule: null, actions: ['lead_not_found'] });
        continue;
      }

      // Find first matching rule
      let matchedRule: RoutingRule | null = null;
      for (const rule of rules as RoutingRule[]) {
        if (leadMatchesRule(lead as Lead, rule)) {
          matchedRule = rule;
          break;
        }
      }

      if (!matchedRule) {
        results.push({ lead_id: leadId, matched_rule: null, actions: ['no_match'] });
        continue;
      }

      const actions: string[] = [];

      if (!dry_run) {
        // Apply assignment
        if (matchedRule.assign_to_org) {
          await supabase
            .from('scraped_leads')
            .update({
              assigned_to_org: matchedRule.assign_to_org,
              assigned_by: user.id,
              assigned_at: new Date().toISOString(),
              status: 'assigned',
            })
            .eq('id', leadId);
          actions.push('assigned_to_org');
          routedCount++;
        }

        // Trigger auto-enrichment
        if (matchedRule.auto_enrich) {
          await supabase.functions.invoke('enrich-lead', {
            body: { lead_id: leadId },
          });
          actions.push('auto_enriched');
        }

        // Send webhook
        if (matchedRule.send_webhook && matchedRule.webhook_url) {
          const webhookSuccess = await sendWebhook(matchedRule.webhook_url, lead as Lead, matchedRule);
          actions.push(webhookSuccess ? 'webhook_sent' : 'webhook_failed');
        }
      } else {
        if (matchedRule.assign_to_org) actions.push('would_assign_to_org');
        if (matchedRule.auto_enrich) actions.push('would_auto_enrich');
        if (matchedRule.send_webhook) actions.push('would_send_webhook');
      }

      results.push({
        lead_id: leadId,
        matched_rule: matchedRule.name,
        actions,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        total_processed: idsToProcess.length,
        routed: routedCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in apply-routing-rules:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to process routing rules. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
