import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const STALE_THRESHOLD_DAYS = 30;
const MAX_LEADS_PER_RUN = 25;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const cronSecret = Deno.env.get('CRON_SECRET');

  // Auth: accept cron secret, service role, or user token
  const authHeader = req.headers.get('Authorization');
  const cronSecretHeader = req.headers.get('X-Cron-Secret');
  let isAuthorized = false;
  if (cronSecret && cronSecretHeader === cronSecret) isAuthorized = true;
  if (!isAuthorized && authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (token === supabaseServiceKey) isAuthorized = true;
    if (!isAuthorized) {
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const authSupabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await authSupabase.auth.getUser();
      if (user) isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { threshold_days = STALE_THRESHOLD_DAYS, max_leads = MAX_LEADS_PER_RUN, lead_ids } = body;

    const staleDate = new Date(Date.now() - threshold_days * 24 * 60 * 60 * 1000).toISOString();

    let staleLeads: any[] = [];

    if (lead_ids?.length) {
      // Re-enrich specific leads
      const { data } = await supabase.from('scraped_leads').select('id, domain, enrichment_data').in('id', lead_ids);
      staleLeads = data || [];
    } else {
      // Find stale leads: enriched more than N days ago, still active
      const { data } = await supabase
        .from('scraped_leads')
        .select('id, domain, enrichment_data, updated_at')
        .lt('updated_at', staleDate)
        .in('status', ['new', 'review', 'approved', 'assigned', 'in_progress'])
        .not('enrichment_providers_used', 'is', null)
        .order('updated_at', { ascending: true })
        .limit(max_leads);

      staleLeads = data || [];
    }

    if (staleLeads.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No stale leads found', re_enriched: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[ReEnrich] Processing ${staleLeads.length} stale leads`);

    let reEnrichedCount = 0;
    const errors: string[] = [];

    // Trigger enrichment for each stale lead
    for (const lead of staleLeads) {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/enrich-lead`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_id: lead.id, enrich_company: true }),
        });

        if (resp.ok) {
          reEnrichedCount++;
          // Log the re-enrichment in audit log
          await supabase.from('audit_log').insert({
            table_name: 'scraped_leads',
            record_id: lead.id,
            action: 'update',
            field_name: 'enrichment_data',
            old_value: 'stale',
            new_value: 're-enriched',
            reason: `Auto re-enrichment (data was ${threshold_days}+ days old)`,
          });
        } else {
          const errText = await resp.text();
          errors.push(`Lead ${lead.id}: ${errText}`);
        }
      } catch (e) {
        errors.push(`Lead ${lead.id}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    console.log(`[ReEnrich] Completed: ${reEnrichedCount}/${staleLeads.length} re-enriched`);

    return new Response(JSON.stringify({
      success: true,
      re_enriched: reEnrichedCount,
      total_stale: staleLeads.length,
      errors: errors.length > 0 ? errors : undefined,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[ReEnrich] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
