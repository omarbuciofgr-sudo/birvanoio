import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadWebhookPayload {
  event: string;
  timestamp: string;
  lead: {
    id: string;
    domain: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    score: number | null;
    priority: string | null;
    source: string | null;
    company_data: Record<string, unknown>;
    intent_signals: Array<{ type: string; data: unknown }>;
  };
  trigger_reason: string;
}

async function sendWebhook(
  url: string,
  payload: LeadWebhookPayload,
  secret?: string
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add HMAC signature if secret provided
    if (secret) {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(payload));
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', key, data);
      const signatureHex = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      headers['X-Webhook-Signature'] = `sha256=${signatureHex}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    return {
      success: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
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
    const body = await req.json().catch(() => ({}));
    const { 
      lead_id, 
      lead_ids,
      event_type = 'high_priority_lead',
      trigger_reason = 'manual',
      webhook_url, // Optional: override to send to specific URL
    } = body;

    const idsToProcess = lead_ids || (lead_id ? [lead_id] : []);

    if (idsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No lead IDs provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get configured webhooks if no override URL
    let webhooks: Array<{ id: string; webhook_url: string; secret_hash: string | null }> = [];
    
    if (webhook_url) {
      webhooks = [{ id: 'manual', webhook_url, secret_hash: null }];
    } else {
      const { data: configuredWebhooks } = await supabase
        .from('client_webhooks')
        .select('id, webhook_url, secret_hash')
        .eq('is_active', true);
      
      webhooks = configuredWebhooks || [];
    }

    if (webhooks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No webhooks configured', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Triggering ${webhooks.length} webhook(s) for ${idsToProcess.length} lead(s)`);

    const results: { lead_id: string; webhooks_triggered: number; details: unknown[] }[] = [];

    for (const leadId of idsToProcess) {
      // Fetch lead with intent signals
      const { data: lead, error: fetchError } = await supabase
        .from('scraped_leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (fetchError || !lead) {
        results.push({ lead_id: leadId, webhooks_triggered: 0, details: ['lead_not_found'] });
        continue;
      }

      // Fetch intent signals
      const { data: intentSignals } = await supabase
        .from('intent_signals')
        .select('signal_type, signal_data')
        .eq('lead_id', leadId)
        .order('detected_at', { ascending: false })
        .limit(5);

      const payload: LeadWebhookPayload = {
        event: event_type,
        timestamp: new Date().toISOString(),
        lead: {
          id: lead.id,
          domain: lead.domain,
          full_name: lead.full_name,
          email: lead.best_email,
          phone: lead.best_phone,
          score: lead.lead_score,
          priority: lead.priority,
          source: lead.source_type,
          company_data: (lead.enrichment_data || {}) as Record<string, unknown>,
          intent_signals: (intentSignals || []).map(s => ({
            type: s.signal_type,
            data: s.signal_data,
          })),
        },
        trigger_reason,
      };

      const webhookResults: unknown[] = [];
      let triggeredCount = 0;

      for (const webhook of webhooks) {
        const result = await sendWebhook(
          webhook.webhook_url,
          payload,
          webhook.secret_hash || undefined
        );

        webhookResults.push({
          webhook_id: webhook.id,
          ...result,
        });

        // Log the delivery
        await supabase.from('webhook_delivery_log').insert({
          webhook_id: webhook.id === 'manual' ? null : webhook.id,
          event_type,
          payload,
          success: result.success,
          response_status: result.status,
          error_message: result.error,
        });

        if (result.success) triggeredCount++;
      }

      results.push({
        lead_id: leadId,
        webhooks_triggered: triggeredCount,
        details: webhookResults,
      });
    }

    const totalTriggered = results.reduce((sum, r) => sum + r.webhooks_triggered, 0);

    return new Response(
      JSON.stringify({
        success: true,
        total_webhooks_triggered: totalTriggered,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // Log detailed error server-side, return generic message to client
    console.error('Error in trigger-lead-webhook:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
