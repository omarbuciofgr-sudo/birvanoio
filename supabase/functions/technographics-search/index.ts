const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface TechSearchInput {
  technologies: string[];
  industry?: string;
  location?: string;
  employee_ranges?: string[];
  limit?: number;
}

interface CompanyResult {
  name: string;
  domain: string;
  website: string | null;
  linkedin_url: string | null;
  industry: string | null;
  employee_count: number | null;
  employee_range: string | null;
  description: string | null;
  headquarters_city: string | null;
  headquarters_state: string | null;
  headquarters_country: string | null;
  technologies: string[];
  source_provider?: string;
}

// ── Apollo ──
async function searchApollo(input: TechSearchInput, apiKey: string): Promise<CompanyResult[]> {
  try {
    const body: Record<string, unknown> = {
      page: 1,
      per_page: Math.min(input.limit || 25, 100),
      q_organization_keyword_tags: input.technologies,
    };
    if (input.industry) body.q_keywords = input.industry;
    if (input.location) body.organization_locations = [input.location];
    if (input.employee_ranges?.length) {
      body.organization_num_employees_ranges = input.employee_ranges.map(r =>
        r === '5001+' ? '10001,' : r.replace('-', ',')
      );
    }

    const resp = await fetch('https://api.apollo.io/api/v1/mixed_companies/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify(body),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.organizations || data.accounts || []).map((o: any) => ({
      name: o.name || '',
      domain: o.primary_domain || o.domain || '',
      website: o.website_url || null,
      linkedin_url: o.linkedin_url || null,
      industry: o.industry || null,
      employee_count: o.estimated_num_employees || null,
      employee_range: null,
      description: o.short_description || null,
      headquarters_city: o.city || null,
      headquarters_state: o.state || null,
      headquarters_country: o.country || null,
      technologies: input.technologies,
      source_provider: 'apollo',
    }));
  } catch (e) { console.error('[TechSearch] Apollo error:', e); return []; }
}

// ── PDL ──
async function searchPDL(input: TechSearchInput, apiKey: string): Promise<CompanyResult[]> {
  try {
    const params: Record<string, unknown> = {
      size: Math.min(input.limit || 25, 100),
      dataset: 'all',
    };
    const sqlParts: string[] = [];
    if (input.technologies.length) {
      const techList = input.technologies.map(t => `'${t.toLowerCase()}'`).join(',');
      sqlParts.push(`EXISTS (SELECT 1 FROM UNNEST(tags) AS t WHERE LOWER(t) IN (${techList}))`);
    }
    if (input.industry) sqlParts.push(`industry = '${input.industry}'`);
    if (input.location) sqlParts.push(`location.country = '${input.location}'`);
    if (sqlParts.length) params.sql = `SELECT * FROM company WHERE ${sqlParts.join(' AND ')}`;

    const resp = await fetch('https://api.peopledatalabs.com/v5/company/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify(params),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.data || []).map((c: any) => ({
      name: c.name || '',
      domain: c.website || '',
      website: c.website ? `https://${c.website}` : null,
      linkedin_url: c.linkedin_url || null,
      industry: c.industry || null,
      employee_count: c.employee_count || null,
      employee_range: c.size || null,
      description: c.summary || null,
      headquarters_city: c.location?.locality || null,
      headquarters_state: c.location?.region || null,
      headquarters_country: c.location?.country || null,
      technologies: c.tags || [],
      source_provider: 'pdl',
    }));
  } catch (e) { console.error('[TechSearch] PDL error:', e); return []; }
}

// ── RocketReach ──
async function searchRocketReach(input: TechSearchInput, apiKey: string): Promise<CompanyResult[]> {
  try {
    const query: Record<string, unknown> = {
      page_size: Math.min(input.limit || 25, 100),
      keyword: input.technologies.join(', '),
    };
    if (input.industry) query.industry = [input.industry];
    if (input.location) query.location = [input.location];

    const resp = await fetch('https://api.rocketreach.co/v2/api/search/company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Api-Key': apiKey },
      body: JSON.stringify({ query }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.companies || data.profiles || []).map((c: any) => ({
      name: c.name || '',
      domain: c.domain || '',
      website: c.website || null,
      linkedin_url: c.linkedin_url || null,
      industry: c.industry || null,
      employee_count: c.num_employees || c.employee_count || null,
      employee_range: null,
      description: c.description || null,
      headquarters_city: c.city || null,
      headquarters_state: c.state || null,
      headquarters_country: c.country || null,
      technologies: input.technologies,
      source_provider: 'rocketreach',
    }));
  } catch (e) { console.error('[TechSearch] RocketReach error:', e); return []; }
}

function normalizeKey(c: CompanyResult): string {
  if (c.domain) return c.domain.toLowerCase().replace(/^www\./, '');
  return `${c.name}`.toLowerCase().trim();
}

function mergeCompany(a: CompanyResult, b: CompanyResult): CompanyResult {
  return {
    name: a.name || b.name,
    domain: a.domain || b.domain,
    website: a.website || b.website,
    linkedin_url: a.linkedin_url || b.linkedin_url,
    industry: a.industry || b.industry,
    employee_count: a.employee_count || b.employee_count,
    employee_range: a.employee_range || b.employee_range,
    description: a.description && a.description.length > (b.description?.length || 0) ? a.description : (b.description || a.description),
    headquarters_city: a.headquarters_city || b.headquarters_city,
    headquarters_state: a.headquarters_state || b.headquarters_state,
    headquarters_country: a.headquarters_country || b.headquarters_country,
    technologies: [...new Set([...(a.technologies || []), ...(b.technologies || [])])],
    source_provider: [a.source_provider, b.source_provider].filter(Boolean).join('+'),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const input: TechSearchInput = await req.json();
    if (!input.technologies?.length) {
      return new Response(JSON.stringify({ success: false, error: 'technologies array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apolloKey = Deno.env.get('APOLLO_API_KEY');
    const pdlKey = Deno.env.get('PDL_API_KEY');
    const rrKey = Deno.env.get('ROCKETREACH_API_KEY');

    const providers: Array<{ name: string; fn: () => Promise<CompanyResult[]> }> = [];
    if (apolloKey) providers.push({ name: 'apollo', fn: () => searchApollo(input, apolloKey) });
    if (pdlKey) providers.push({ name: 'pdl', fn: () => searchPDL(input, pdlKey) });
    if (rrKey) providers.push({ name: 'rocketreach', fn: () => searchRocketReach(input, rrKey) });

    const allResults = await Promise.allSettled(providers.map(p => p.fn()));

    const mergedMap = new Map<string, CompanyResult>();
    for (const settled of allResults) {
      if (settled.status !== 'fulfilled') continue;
      for (const company of settled.value) {
        if (!company.name && !company.domain) continue;
        const key = normalizeKey(company);
        const existing = mergedMap.get(key);
        mergedMap.set(key, existing ? mergeCompany(existing, company) : company);
      }
    }

    const companies = Array.from(mergedMap.values()).slice(0, input.limit || 25);

    return new Response(JSON.stringify({
      success: true,
      companies,
      total: companies.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[TechnographicsSearch] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
