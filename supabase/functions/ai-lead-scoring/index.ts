const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * AI Lead Scoring - Use Lovable AI to analyze and score prospects
 * 
 * Evaluates leads based on:
 * - Data completeness (email, phone, name)
 * - Contact quality (verified vs unverified)
 * - Decision-maker likelihood
 * - Company fit (size, industry match)
 * - Engagement potential
 */

interface LeadToScore {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  seniority_level?: string | null;
  company_name?: string | null;
  industry?: string | null;
  employee_count?: number | null;
  annual_revenue?: number | null;
  website?: string | null;
  linkedin_url?: string | null;
  email_validation_status?: string | null;
  phone_validation_status?: string | null;
  source?: string | null;
}

interface ScoringCriteria {
  target_industry?: string;
  target_titles?: string[];
  min_company_size?: number;
  max_company_size?: number;
  prefer_verified_contacts?: boolean;
}

interface ScoredLead extends LeadToScore {
  score: number;
  score_breakdown: {
    data_completeness: number;
    contact_quality: number;
    decision_maker_fit: number;
    company_fit: number;
    total: number;
  };
  ai_insights: string;
  priority: 'high' | 'medium' | 'low';
  recommended_action: string;
}

// Calculate base scores without AI
function calculateBaseScores(lead: LeadToScore, criteria: ScoringCriteria): ScoredLead['score_breakdown'] {
  let dataCompleteness = 0;
  let contactQuality = 0;
  let decisionMakerFit = 0;
  let companyFit = 0;
  
  // Data Completeness (max 25)
  if (lead.full_name) dataCompleteness += 5;
  if (lead.email) dataCompleteness += 8;
  if (lead.phone) dataCompleteness += 5;
  if (lead.job_title) dataCompleteness += 3;
  if (lead.company_name) dataCompleteness += 2;
  if (lead.linkedin_url) dataCompleteness += 2;
  
  // Contact Quality (max 25)
  if (lead.email_validation_status === 'verified') {
    contactQuality += 12;
  } else if (lead.email_validation_status === 'likely_valid') {
    contactQuality += 8;
  } else if (lead.email) {
    contactQuality += 4;
  }
  
  if (lead.phone_validation_status === 'verified') {
    contactQuality += 13;
  } else if (lead.phone_validation_status === 'likely_valid') {
    contactQuality += 9;
  } else if (lead.phone) {
    contactQuality += 5;
  }
  
  // Decision Maker Fit (max 25)
  const title = (lead.job_title || '').toLowerCase();
  const seniority = (lead.seniority_level || '').toLowerCase();
  
  const executiveTitles = ['owner', 'ceo', 'founder', 'president', 'principal', 'partner'];
  const seniorTitles = ['director', 'vp', 'vice president', 'head', 'chief'];
  const managerTitles = ['manager', 'supervisor', 'lead'];
  
  if (executiveTitles.some(t => title.includes(t)) || seniority === 'owner' || seniority === 'c_suite') {
    decisionMakerFit += 25;
  } else if (seniorTitles.some(t => title.includes(t)) || seniority === 'vp' || seniority === 'director') {
    decisionMakerFit += 18;
  } else if (managerTitles.some(t => title.includes(t)) || seniority === 'manager') {
    decisionMakerFit += 12;
  } else if (lead.job_title) {
    decisionMakerFit += 5;
  }
  
  // Check against target titles
  if (criteria.target_titles?.length && lead.job_title) {
    const matchesTarget = criteria.target_titles.some(t => 
      title.includes(t.toLowerCase())
    );
    if (matchesTarget) decisionMakerFit = Math.min(decisionMakerFit + 5, 25);
  }
  
  // Company Fit (max 25)
  if (lead.company_name) companyFit += 5;
  if (lead.website) companyFit += 3;
  
  // Industry match
  if (criteria.target_industry && lead.industry) {
    const targetInd = criteria.target_industry.toLowerCase();
    const leadInd = lead.industry.toLowerCase();
    if (leadInd.includes(targetInd) || targetInd.includes(leadInd)) {
      companyFit += 10;
    }
  } else if (lead.industry) {
    companyFit += 3;
  }
  
  // Company size match
  if (lead.employee_count) {
    const min = criteria.min_company_size || 0;
    const max = criteria.max_company_size || 10000;
    if (lead.employee_count >= min && lead.employee_count <= max) {
      companyFit += 7;
    } else {
      companyFit += 2;
    }
  }
  
  return {
    data_completeness: Math.min(dataCompleteness, 25),
    contact_quality: Math.min(contactQuality, 25),
    decision_maker_fit: Math.min(decisionMakerFit, 25),
    company_fit: Math.min(companyFit, 25),
    total: Math.min(dataCompleteness + contactQuality + decisionMakerFit + companyFit, 100),
  };
}

// Get AI insights for a batch of leads
async function getAIInsights(
  leads: LeadToScore[],
  criteria: ScoringCriteria,
  lovableApiKey: string
): Promise<Map<number, { insights: string; recommended_action: string }>> {
  const insightsMap = new Map<number, { insights: string; recommended_action: string }>();
  
  try {
    const leadsContext = leads.map((lead, i) => ({
      index: i,
      name: lead.full_name || 'Unknown',
      title: lead.job_title || 'Unknown',
      company: lead.company_name || 'Unknown',
      industry: lead.industry || 'Unknown',
      hasEmail: !!lead.email,
      hasPhone: !!lead.phone,
      emailVerified: lead.email_validation_status === 'verified',
      phoneVerified: lead.phone_validation_status === 'verified',
    }));
    
    const systemPrompt = `You are a sales intelligence AI analyzing leads for outreach prioritization.
    
Target criteria:
- Industry: ${criteria.target_industry || 'Any'}
- Target titles: ${criteria.target_titles?.join(', ') || 'Decision makers'}
- Company size: ${criteria.min_company_size || 1} - ${criteria.max_company_size || 'Any'} employees

For each lead, provide:
1. A brief insight (1-2 sentences) about why they're a good/bad fit
2. A recommended action: "Call immediately", "Email first", "Research more", "Low priority"`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Analyze these ${leads.length} leads and provide insights in JSON format:

${JSON.stringify(leadsContext, null, 2)}

Return a JSON array with objects containing: index, insight, recommended_action`
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'provide_lead_insights',
              description: 'Provide insights and recommendations for leads',
              parameters: {
                type: 'object',
                properties: {
                  lead_insights: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        index: { type: 'number' },
                        insight: { type: 'string' },
                        recommended_action: { 
                          type: 'string',
                          enum: ['Call immediately', 'Email first', 'Research more', 'Low priority']
                        }
                      },
                      required: ['index', 'insight', 'recommended_action']
                    }
                  }
                },
                required: ['lead_insights']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'provide_lead_insights' } },
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        for (const item of (parsed.lead_insights || [])) {
          insightsMap.set(item.index, {
            insights: item.insight,
            recommended_action: item.recommended_action,
          });
        }
      }
    }
  } catch (error) {
    console.error('AI insights error:', error);
  }
  
  return insightsMap;
}

// Determine priority based on score
function getPriority(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

// Default action based on score
function getDefaultAction(score: number, lead: LeadToScore): string {
  if (score >= 80 && lead.phone) return 'Call immediately';
  if (score >= 60) return 'Email first';
  if (score >= 40) return 'Research more';
  return 'Low priority';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const body = await req.json();
    const { leads, criteria = {}, use_ai = true }: {
      leads: LeadToScore[];
      criteria?: ScoringCriteria;
      use_ai?: boolean;
    } = body;
    
    if (!leads?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'No leads provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Scoring ${leads.length} leads`);
    
    // Calculate base scores for all leads
    const scoredLeads: ScoredLead[] = leads.map(lead => {
      const breakdown = calculateBaseScores(lead, criteria);
      return {
        ...lead,
        score: breakdown.total,
        score_breakdown: breakdown,
        ai_insights: '',
        priority: getPriority(breakdown.total),
        recommended_action: getDefaultAction(breakdown.total, lead),
      };
    });
    
    // Get AI insights if available and requested
    if (use_ai && lovableApiKey && leads.length <= 20) {
      console.log('Getting AI insights...');
      const aiInsights = await getAIInsights(leads, criteria, lovableApiKey);
      
      for (let i = 0; i < scoredLeads.length; i++) {
        const insight = aiInsights.get(i);
        if (insight) {
          scoredLeads[i].ai_insights = insight.insights;
          scoredLeads[i].recommended_action = insight.recommended_action;
        }
      }
    }
    
    // Sort by score descending
    scoredLeads.sort((a, b) => b.score - a.score);
    
    // Summary stats
    const summary = {
      total_leads: scoredLeads.length,
      high_priority: scoredLeads.filter(l => l.priority === 'high').length,
      medium_priority: scoredLeads.filter(l => l.priority === 'medium').length,
      low_priority: scoredLeads.filter(l => l.priority === 'low').length,
      average_score: Math.round(scoredLeads.reduce((sum, l) => sum + l.score, 0) / scoredLeads.length),
      with_verified_email: scoredLeads.filter(l => l.email_validation_status === 'verified').length,
      with_verified_phone: scoredLeads.filter(l => l.phone_validation_status === 'verified').length,
    };
    
    console.log('Scoring complete:', summary);
    
    return new Response(
      JSON.stringify({
        success: true,
        data: scoredLeads,
        summary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Lead scoring error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Scoring failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
