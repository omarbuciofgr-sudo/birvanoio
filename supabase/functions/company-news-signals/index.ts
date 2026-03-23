const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface NewsSignal {
  company_name: string;
  domain: string;
  signal_type: 'funding' | 'leadership_change' | 'hiring_surge' | 'acquisition' | 'product_launch' | 'expansion' | 'layoff' | 'partnership';
  headline: string;
  summary: string;
  source_url: string | null;
  detected_at: string;
  confidence: number;
}

// ── Apollo org enrichment for signals ──
async function getApolloSignals(domains: string[], apiKey: string): Promise<NewsSignal[]> {
  const signals: NewsSignal[] = [];
  for (const domain of domains.slice(0, 20)) {
    try {
      const resp = await fetch('https://api.apollo.io/api/v1/organizations/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
        body: JSON.stringify({ domain }),
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      const org = data.organization;
      if (!org) continue;

      // Detect hiring surge from job postings
      if (org.current_technologies?.length > 5 || org.estimated_num_employees > 100) {
        if (org.latest_funding_round_date) {
          const fundingDate = new Date(org.latest_funding_round_date);
          const daysSince = (Date.now() - fundingDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince < 180) {
            signals.push({
              company_name: org.name,
              domain,
              signal_type: 'funding',
              headline: `${org.name} raised ${org.latest_funding_stage || 'funding'} round`,
              summary: `${org.name} completed a ${org.latest_funding_stage || ''} funding round on ${org.latest_funding_round_date}. Amount: ${org.latest_funding_round_amount ? `$${(org.latest_funding_round_amount / 1_000_000).toFixed(1)}M` : 'undisclosed'}.`,
              source_url: org.linkedin_url || null,
              detected_at: new Date().toISOString(),
              confidence: 0.9,
            });
          }
        }
      }
    } catch (e) { console.error(`[NewsSignals] Apollo error for ${domain}:`, e); }
  }
  return signals;
}

// ── Firecrawl web search for company news ──
async function searchCompanyNews(companyName: string, domain: string, apiKey: string): Promise<NewsSignal[]> {
  const signals: NewsSignal[] = [];
  try {
    const resp = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `"${companyName}" (funding OR acquisition OR "new CEO" OR "series" OR hiring OR layoff OR partnership OR expansion) -site:${domain}`,
        limit: 5,
        tbs: 'qdr:m', // last month
      }),
    });
    if (!resp.ok) return signals;
    const data = await resp.json();
    const results = data.data || [];

    const signalPatterns: Array<{ pattern: RegExp; type: NewsSignal['signal_type'] }> = [
      { pattern: /(?:raises?|raised|secures?|secured|funding|series [a-f]|seed|round)/i, type: 'funding' },
      { pattern: /(?:new CEO|appoints?|names?|hires?).*(?:CEO|CTO|CFO|COO|president|chief)/i, type: 'leadership_change' },
      { pattern: /(?:hiring|job opening|recruit|talent|growing team)/i, type: 'hiring_surge' },
      { pattern: /(?:acquires?|acquired|acquisition|merger|buys?|bought)/i, type: 'acquisition' },
      { pattern: /(?:launch|launches|released|announces|unveil|introducing)/i, type: 'product_launch' },
      { pattern: /(?:expands?|expansion|new office|new market|opens?.*office)/i, type: 'expansion' },
      { pattern: /(?:layoff|laid off|restructur|downsiz|cut.*jobs?|reduc.*workforce)/i, type: 'layoff' },
      { pattern: /(?:partner|partnership|collaborat|teams? up|alliance|joint venture)/i, type: 'partnership' },
    ];

    for (const result of results) {
      const text = `${result.title || ''} ${result.description || ''}`;
      for (const { pattern, type } of signalPatterns) {
        if (pattern.test(text)) {
          signals.push({
            company_name: companyName,
            domain,
            signal_type: type,
            headline: result.title || '',
            summary: result.description || '',
            source_url: result.url || null,
            detected_at: new Date().toISOString(),
            confidence: 0.7,
          });
          break;
        }
      }
    }
  } catch (e) { console.error(`[NewsSignals] Search error for ${companyName}:`, e); }
  return signals;
}

// ── AI classification fallback ──
async function classifyWithAI(headlines: Array<{ title: string; description: string; url: string }>, companyName: string): Promise<NewsSignal[]> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableKey || headlines.length === 0) return [];
  try {
    const resp = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{
          role: 'user',
          content: `Classify these headlines about "${companyName}" into signal types. For each headline that's relevant, output JSON array with objects {index, signal_type, confidence}. signal_type must be one of: funding, leadership_change, hiring_surge, acquisition, product_launch, expansion, layoff, partnership. Only include clearly relevant headlines.\n\nHeadlines:\n${headlines.map((h, i) => `${i}: ${h.title} - ${h.description}`).join('\n')}`,
        }],
        temperature: 0.1,
      }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const classified = JSON.parse(jsonMatch[0]);
    return classified.map((c: any) => {
      const h = headlines[c.index];
      if (!h) return null;
      return {
        company_name: companyName,
        domain: '',
        signal_type: c.signal_type,
        headline: h.title,
        summary: h.description,
        source_url: h.url,
        detected_at: new Date().toISOString(),
        confidence: c.confidence || 0.6,
      };
    }).filter(Boolean);
  } catch { return []; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { companies, signal_types } = await req.json() as {
      companies: Array<{ name: string; domain: string }>;
      signal_types?: string[];
    };

    if (!companies?.length) {
      return new Response(JSON.stringify({ success: false, error: 'companies array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apolloKey = Deno.env.get('APOLLO_API_KEY');
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const allSignals: NewsSignal[] = [];

    // Apollo enrichment signals
    if (apolloKey) {
      const apolloSignals = await getApolloSignals(companies.map(c => c.domain), apolloKey);
      allSignals.push(...apolloSignals);
    }

    // Web search signals (limit to first 10 companies to avoid timeouts)
    if (firecrawlKey) {
      const searchPromises = companies.slice(0, 10).map(c =>
        searchCompanyNews(c.name, c.domain, firecrawlKey)
      );
      const searchResults = await Promise.allSettled(searchPromises);
      for (const result of searchResults) {
        if (result.status === 'fulfilled') allSignals.push(...result.value);
      }
    }

    // Filter by signal types if specified
    let filteredSignals = allSignals;
    if (signal_types?.length) {
      filteredSignals = allSignals.filter(s => signal_types.includes(s.signal_type));
    }

    // Dedupe by headline similarity
    const seen = new Set<string>();
    const deduped = filteredSignals.filter(s => {
      const key = `${s.company_name}:${s.signal_type}:${s.headline.slice(0, 50)}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by confidence desc
    deduped.sort((a, b) => b.confidence - a.confidence);

    return new Response(JSON.stringify({
      success: true,
      signals: deduped,
      total: deduped.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[CompanyNewsSignals] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
