import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IntentSignal {
  signal_type: string;
  signal_source: string;
  signal_data: Record<string, unknown>;
  confidence_score: number;
}

// Detect hiring signals from job postings or LinkedIn
async function detectHiringSignals(
  domain: string,
  companyName?: string
): Promise<IntentSignal[]> {
  const signals: IntentSignal[] = [];
  
  // Check for recent job postings (simplified - would integrate with job boards API)
  const hiringKeywords = ['hiring', 'we\'re growing', 'join our team', 'open positions'];
  
  // This would normally call LinkedIn Jobs API or Indeed API
  // For now, we'll simulate based on company data from enrichment
  
  return signals;
}

// Detect technology changes
async function detectTechnologySignals(
  domain: string,
  currentTech: string[],
  previousTech?: string[]
): Promise<IntentSignal[]> {
  const signals: IntentSignal[] = [];
  
  if (previousTech && currentTech) {
    const newTech = currentTech.filter(t => !previousTech.includes(t));
    const removedTech = previousTech.filter(t => !currentTech.includes(t));
    
    if (newTech.length > 0) {
      signals.push({
        signal_type: 'technology_adoption',
        signal_source: 'tech_stack_change',
        signal_data: { new_technologies: newTech },
        confidence_score: 70,
      });
    }
    
    if (removedTech.length > 0) {
      signals.push({
        signal_type: 'technology_change',
        signal_source: 'tech_stack_change',
        signal_data: { removed_technologies: removedTech },
        confidence_score: 60,
      });
    }
  }
  
  return signals;
}

// Detect funding signals
async function detectFundingSignals(
  enrichmentData: Record<string, unknown>
): Promise<IntentSignal[]> {
  const signals: IntentSignal[] = [];
  
  const fundingStage = enrichmentData.funding_stage as string;
  const fundingTotal = enrichmentData.funding_total as number;
  
  if (fundingStage && ['Series A', 'Series B', 'Series C', 'Series D'].includes(fundingStage)) {
    signals.push({
      signal_type: 'recent_funding',
      signal_source: 'enrichment_data',
      signal_data: { 
        stage: fundingStage, 
        total: fundingTotal,
      },
      confidence_score: 90,
    });
  }
  
  return signals;
}

// Detect expansion signals
async function detectExpansionSignals(
  enrichmentData: Record<string, unknown>,
  previousData?: Record<string, unknown>
): Promise<IntentSignal[]> {
  const signals: IntentSignal[] = [];
  
  const currentEmployees = enrichmentData.employee_count as number;
  const previousEmployees = previousData?.employee_count as number;
  
  if (currentEmployees && previousEmployees) {
    const growthRate = ((currentEmployees - previousEmployees) / previousEmployees) * 100;
    
    if (growthRate > 20) {
      signals.push({
        signal_type: 'rapid_growth',
        signal_source: 'employee_growth',
        signal_data: { 
          growth_rate: Math.round(growthRate),
          current_employees: currentEmployees,
          previous_employees: previousEmployees,
        },
        confidence_score: 80,
      });
    }
  }
  
  return signals;
}

// Detect leadership changes
async function detectLeadershipSignals(
  enrichmentData: Record<string, unknown>
): Promise<IntentSignal[]> {
  const signals: IntentSignal[] = [];
  
  // Would normally compare against previous enrichment data
  const title = enrichmentData.job_title as string;
  const seniorityLevel = enrichmentData.seniority_level as string;
  
  if (seniorityLevel === 'c_suite' || title?.toLowerCase().includes('new')) {
    signals.push({
      signal_type: 'leadership_change',
      signal_source: 'enrichment_data',
      signal_data: { 
        title,
        seniority: seniorityLevel,
      },
      confidence_score: 65,
    });
  }
  
  return signals;
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
    const { lead_id, lead_ids } = body;

    const idsToProcess = lead_ids || (lead_id ? [lead_id] : []);

    if (idsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No lead IDs provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Detecting intent signals for ${idsToProcess.length} lead(s)`);

    const results: { lead_id: string; signals_detected: number; signals: IntentSignal[] }[] = [];

    for (const leadId of idsToProcess) {
      // Fetch lead with enrichment data
      const { data: lead, error: fetchError } = await supabase
        .from('scraped_leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (fetchError || !lead) {
        results.push({ lead_id: leadId, signals_detected: 0, signals: [] });
        continue;
      }

      const enrichmentData = (lead.enrichment_data || {}) as Record<string, unknown>;
      const allSignals: IntentSignal[] = [];

      // Detect various signals
      const fundingSignals = await detectFundingSignals(enrichmentData);
      allSignals.push(...fundingSignals);

      const techSignals = await detectTechnologySignals(
        lead.domain,
        (enrichmentData.technologies || []) as string[]
      );
      allSignals.push(...techSignals);

      const expansionSignals = await detectExpansionSignals(enrichmentData);
      allSignals.push(...expansionSignals);

      const leadershipSignals = await detectLeadershipSignals(enrichmentData);
      allSignals.push(...leadershipSignals);

      // Store signals in database
      for (const signal of allSignals) {
        await supabase.from('intent_signals').insert({
          lead_id: leadId,
          signal_type: signal.signal_type,
          signal_source: signal.signal_source,
          signal_data: signal.signal_data,
          confidence_score: signal.confidence_score,
        });
      }

      results.push({
        lead_id: leadId,
        signals_detected: allSignals.length,
        signals: allSignals,
      });
    }

    const totalSignals = results.reduce((sum, r) => sum + r.signals_detected, 0);

    return new Response(
      JSON.stringify({ 
        success: true, 
        total_signals_detected: totalSignals,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in detect-intent-signals:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
