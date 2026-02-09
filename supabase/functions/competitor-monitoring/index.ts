import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Common job board patterns that indicate hiring
const JOB_BOARD_INDICATORS = [
  'careers', 'jobs', 'hiring', 'open positions', 'we\'re hiring',
  'join our team', 'work with us', 'openings', 'apply now',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const authSupabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userError } = await authSupabase.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid authentication' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { lead_ids } = await req.json();
    if (!lead_ids?.length) {
      return new Response(JSON.stringify({ error: 'lead_ids required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results: Array<{
      lead_id: string;
      hiring_signals: boolean;
      job_count_estimate: number;
      competitor_mentions: string[];
      signals_created: number;
    }> = [];

    for (const leadId of lead_ids.slice(0, 10)) {
      const { data: lead } = await supabase.from('scraped_leads').select('*').eq('id', leadId).single();
      if (!lead || !lead.domain || lead.domain.includes('-')) {
        results.push({ lead_id: leadId, hiring_signals: false, job_count_estimate: 0, competitor_mentions: [], signals_created: 0 });
        continue;
      }

      const domain = lead.domain;
      let hiringSignals = false;
      let jobCountEstimate = 0;
      const competitorMentions: string[] = [];
      let signalsCreated = 0;

      // 1. Check careers page for hiring signals
      if (firecrawlApiKey) {
        const careerPaths = ['/careers', '/jobs', '/hiring', '/work-with-us'];
        for (const path of careerPaths) {
          try {
            const resp = await fetch('https://api.firecrawl.dev/v1/scrape', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${firecrawlApiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: `https://${domain}${path}`, formats: ['markdown'], waitFor: 2000 }),
            });

            if (resp.ok) {
              const data = await resp.json();
              const md = data.data?.markdown || '';
              if (md.length > 200) {
                // Count job listing patterns
                const jobPatterns = md.match(/(?:apply|position|opening|role)\s/gi) || [];
                if (jobPatterns.length > 0 || JOB_BOARD_INDICATORS.some(ind => md.toLowerCase().includes(ind))) {
                  hiringSignals = true;
                  jobCountEstimate = Math.max(jobCountEstimate, jobPatterns.length);
                }
                break; // Found careers page, no need to check others
              }
            }
          } catch { /* skip */ }
        }

        // 2. Search for company mentions on competitor sites using Firecrawl search
        try {
          const companyName = (lead.enrichment_data as any)?.company_name || domain.replace(/\.[^.]+$/, '');
          const searchResp = await fetch('https://api.firecrawl.dev/v1/search', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${firecrawlApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: `"${companyName}" competitor OR alternative OR vs OR comparison`, limit: 5 }),
          });

          if (searchResp.ok) {
            const searchData = await searchResp.json();
            if (searchData.data) {
              for (const result of searchData.data.slice(0, 3)) {
                const resultDomain = new URL(result.url).hostname;
                if (resultDomain !== domain) {
                  competitorMentions.push(result.url);
                }
              }
            }
          }
        } catch (e) { console.error('[CompetitorMonitor] Search error:', e); }
      }

      // Store signals
      if (hiringSignals) {
        await supabase.from('intent_signals').insert({
          lead_id: leadId,
          signal_type: 'hiring_activity',
          signal_source: 'careers_page',
          signal_data: { job_count_estimate: jobCountEstimate, detected_at: new Date().toISOString() },
          confidence_score: 85,
        });
        signalsCreated++;
      }

      if (competitorMentions.length > 0) {
        await supabase.from('intent_signals').insert({
          lead_id: leadId,
          signal_type: 'competitor_mention',
          signal_source: 'web_search',
          signal_data: { mentions: competitorMentions, detected_at: new Date().toISOString() },
          confidence_score: 60,
        });
        signalsCreated++;
      }

      results.push({ lead_id: leadId, hiring_signals: hiringSignals, job_count_estimate: jobCountEstimate, competitor_mentions: competitorMentions, signals_created: signalsCreated });
    }

    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[CompetitorMonitor] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
