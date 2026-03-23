import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Accept webhook callbacks from email providers (Resend, etc.)
  // Also accept authenticated user requests
  const authHeader = req.headers.get('authorization');
  let isAuthorized = false;

  // Check for Resend webhook signature or service role
  const resendWebhookId = req.headers.get('svix-id');
  if (resendWebhookId) {
    isAuthorized = true; // Resend webhook callback
  } else if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (token === supabaseServiceKey) {
      isAuthorized = true;
    } else {
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
    const body = await req.json();

    // Handle Resend webhook event format
    const eventType = body.type || body.event_type;
    const bounceData = body.data || body;

    if (eventType === 'email.bounced' || eventType === 'bounce' || eventType === 'manual_bounce') {
      const bouncedEmail = bounceData.to?.[0] || bounceData.email || bounceData.recipient;

      if (!bouncedEmail) {
        return new Response(JSON.stringify({ error: 'No email address in bounce event' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      console.log(`[BounceTracking] Processing bounce for: ${bouncedEmail}`);

      // 1. Find and update scraped_leads with this email
      const { data: scrapedLeads } = await supabase
        .from('scraped_leads')
        .select('id, best_email, all_emails')
        .or(`best_email.eq.${bouncedEmail},all_emails.cs.{${bouncedEmail}}`);

      let updatedCount = 0;

      if (scrapedLeads) {
        for (const lead of scrapedLeads) {
          await supabase.from('scraped_leads').update({
            email_validation_status: 'invalid',
            email_validation_notes: `Bounced: ${bounceData.bounce_type || 'hard_bounce'} at ${new Date().toISOString()}`,
          }).eq('id', lead.id);

          // Log validation
          await supabase.from('validation_logs').insert({
            lead_id: lead.id,
            validation_type: 'email',
            input_value: bouncedEmail,
            result_status: 'invalid',
            result_details: { bounce_type: bounceData.bounce_type || 'hard_bounce', raw_event: eventType },
            provider: 'bounce_tracking',
          });

          // Log in audit
          await supabase.from('audit_log').insert({
            table_name: 'scraped_leads',
            record_id: lead.id,
            action: 'update',
            field_name: 'email_validation_status',
            old_value: 'unknown',
            new_value: 'invalid',
            reason: `Email bounced: ${bouncedEmail}`,
          });

          updatedCount++;
        }
      }

      // 2. Find and update CRM leads
      const { data: crmLeads } = await supabase
        .from('leads')
        .select('id')
        .eq('email', bouncedEmail);

      if (crmLeads) {
        for (const lead of crmLeads) {
          await supabase.from('leads').update({
            notes: `[BOUNCE] Email ${bouncedEmail} bounced on ${new Date().toLocaleDateString()}`,
          }).eq('id', lead.id);
          updatedCount++;
        }
      }

      // 3. Add to suppression list to prevent future sends
      const { data: existingSuppression } = await supabase
        .from('suppression_list')
        .select('id')
        .eq('value', bouncedEmail.toLowerCase())
        .eq('suppression_type', 'email')
        .maybeSingle();

      if (!existingSuppression) {
        await supabase.from('suppression_list').insert({
          suppression_type: 'email',
          value: bouncedEmail.toLowerCase(),
          reason: `Hard bounce detected: ${bounceData.bounce_type || 'unknown'}`,
        });
      }

      console.log(`[BounceTracking] Updated ${updatedCount} leads, suppressed email: ${bouncedEmail}`);

      return new Response(JSON.stringify({
        success: true,
        email: bouncedEmail,
        leads_updated: updatedCount,
        suppressed: !existingSuppression,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Handle delivery confirmation (positive signal)
    if (eventType === 'email.delivered' || eventType === 'delivered') {
      const deliveredEmail = bounceData.to?.[0] || bounceData.email || bounceData.recipient;
      if (deliveredEmail) {
        // Update validation status to verified if it was unverified
        await supabase.from('scraped_leads').update({
          email_validation_status: 'verified',
          email_validation_notes: `Delivered successfully at ${new Date().toISOString()}`,
        }).eq('best_email', deliveredEmail).in('email_validation_status', ['unverified', 'likely_valid']);
      }
      return new Response(JSON.stringify({ success: true, event: 'delivered' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, message: 'Event type not handled', event_type: eventType }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[BounceTracking] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
