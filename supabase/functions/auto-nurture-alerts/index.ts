import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Hot lead score threshold
const HOT_LEAD_THRESHOLD = 80;
const WARM_LEAD_THRESHOLD = 60;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const cronSecret = Deno.env.get('CRON_SECRET');

  // Auth: accept cron secret or service role key
  const authHeader = req.headers.get('Authorization');
  const cronSecretHeader = req.headers.get('X-Cron-Secret');
  let isAuthorized = false;
  if (cronSecret && cronSecretHeader === cronSecret) isAuthorized = true;
  if (!isAuthorized && authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (token === supabaseServiceKey) isAuthorized = true;
    // Also allow user auth for manual triggers
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
    const { mode = 'auto' } = body; // 'auto' = both alerts + nurture, 'alerts_only', 'nurture_only'

    const results: { hot_lead_alerts: number; nurture_enrolled: number; webhooks_fired: number } = {
      hot_lead_alerts: 0, nurture_enrolled: 0, webhooks_fired: 0,
    };

    // ========== HOT LEAD ALERTS ==========
    if (mode === 'auto' || mode === 'alerts_only') {
      // Find high-scoring leads that haven't been alerted yet
      const { data: hotLeads } = await supabase
        .from('scraped_leads')
        .select('id, domain, full_name, best_email, best_phone, lead_score, confidence_score, enrichment_data')
        .gte('lead_score', HOT_LEAD_THRESHOLD)
        .eq('status', 'new')
        .is('assigned_to_org', null)
        .order('lead_score', { ascending: false })
        .limit(50);

      if (hotLeads && hotLeads.length > 0) {
        console.log(`[AutoNurture] Found ${hotLeads.length} hot leads to alert`);

        // Get all active notification channels
        const { data: channels } = await supabase
          .from('notification_channels')
          .select('*')
          .eq('is_active', true)
          .eq('notify_on_high_value_lead', true);

        for (const lead of hotLeads) {
          // Fire webhooks for each active channel
          if (channels) {
            for (const channel of channels) {
              if (channel.webhook_url) {
                try {
                  const payload = {
                    event: 'hot_lead_detected',
                    timestamp: new Date().toISOString(),
                    lead: {
                      id: lead.id,
                      domain: lead.domain,
                      name: lead.full_name,
                      email: lead.best_email,
                      phone: lead.best_phone,
                      score: lead.lead_score,
                      confidence: lead.confidence_score,
                    },
                  };

                  const resp = await fetch(channel.webhook_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                  });

                  if (resp.ok) results.webhooks_fired++;

                  // Update channel last triggered
                  await supabase.from('notification_channels').update({
                    last_triggered_at: new Date().toISOString(),
                  }).eq('id', channel.id);
                } catch (e) {
                  console.error(`[AutoNurture] Webhook failed for channel ${channel.name}:`, e);
                  // Increment failure count
                  await supabase.from('notification_channels').update({
                    failure_count: (channel.failure_count || 0) + 1,
                  }).eq('id', channel.id);
                }
              }
            }
          }

          // Create an intent signal for the hot lead alert
          await supabase.from('intent_signals').insert({
            lead_id: lead.id,
            signal_type: 'hot_lead_alert',
            signal_source: 'auto_nurture_system',
            signal_data: { score: lead.lead_score, confidence: lead.confidence_score, alerted_at: new Date().toISOString() },
            confidence_score: 95,
          });

          results.hot_lead_alerts++;
        }
      }
    }

    // ========== AUTO-NURTURE ENROLLMENT ==========
    if (mode === 'auto' || mode === 'nurture_only') {
      // Find leads that should be auto-enrolled in drip campaigns
      const { data: warmLeads } = await supabase
        .from('scraped_leads')
        .select('id, domain, full_name, best_email, lead_score')
        .gte('lead_score', WARM_LEAD_THRESHOLD)
        .not('best_email', 'is', null)
        .eq('status', 'new')
        .order('lead_score', { ascending: false })
        .limit(100);

      if (warmLeads && warmLeads.length > 0) {
        // Get active email campaigns
        const { data: campaigns } = await supabase
          .from('email_campaigns')
          .select('id, name')
          .eq('is_active', true)
          .limit(1);

        if (campaigns && campaigns.length > 0) {
          const campaign = campaigns[0];

          for (const lead of warmLeads) {
            // Check if already enrolled
            const { data: existing } = await supabase
              .from('lead_campaign_enrollments')
              .select('id')
              .eq('lead_id', lead.id)
              .eq('campaign_id', campaign.id)
              .maybeSingle();

            // Find corresponding CRM lead
            const { data: crmLead } = await supabase
              .from('leads')
              .select('id')
              .eq('email', lead.best_email)
              .maybeSingle();

            if (!existing && crmLead) {
              await supabase.from('lead_campaign_enrollments').insert({
                lead_id: crmLead.id,
                campaign_id: campaign.id,
                status: 'active',
                next_send_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Start in 24h
              });
              results.nurture_enrolled++;
            }
          }
        }
      }
    }

    console.log(`[AutoNurture] Results: ${results.hot_lead_alerts} alerts, ${results.nurture_enrolled} enrolled, ${results.webhooks_fired} webhooks`);

    return new Response(JSON.stringify({ success: true, ...results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[AutoNurture] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
