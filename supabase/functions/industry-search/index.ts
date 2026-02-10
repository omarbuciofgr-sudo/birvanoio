import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

interface CompanySearchInput {
  industry?: string;
  industries_exclude?: string[];
  employee_count_min?: number;
  employee_count_max?: number;
  location?: string;
  locations_exclude?: string[];
  keywords?: string;
  keywords_exclude?: string[];
  revenue_range?: string;
  funding_range?: string;
  company_types?: string[];
  technologies?: string[];
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
  annual_revenue: number | null;
  founded_year: number | null;
  description: string | null;
  headquarters_city: string | null;
  headquarters_state: string | null;
  headquarters_country: string | null;
  technologies: string[];
  keywords: string[];
  source_provider?: string;
}

// ── Provider 1: Apollo ──────────────────────────────────────────────
async function searchApollo(input: CompanySearchInput, apiKey: string): Promise<CompanyResult[] | null> {
  const { industry, employee_count_min, employee_count_max, location, keywords, limit = 25 } = input;

  const searchParams: Record<string, unknown> = {
    page: 1,
    per_page: Math.min(limit, 100),
  };

  if (industry) {
    // Use keyword-based matching — industry_tag_ids expects Apollo-specific numeric IDs
    searchParams.q_organization_keyword_tags = industry.split(',').map((s: string) => s.trim()).filter(Boolean);
  }

  if (employee_count_min || employee_count_max) {
    const ranges: string[] = [];
    const min = employee_count_min || 0;
    const max = employee_count_max || 999999;
    if (min < 10) ranges.push('1-10');
    if (min <= 50 && max >= 11) ranges.push('11-50');
    if (min <= 200 && max >= 51) ranges.push('51-200');
    if (min <= 500 && max >= 201) ranges.push('201-500');
    if (min <= 1000 && max >= 501) ranges.push('501-1000');
    if (min <= 5000 && max >= 1001) ranges.push('1001-5000');
    if (min <= 10000 && max >= 5001) ranges.push('5001-10000');
    if (max >= 10001) ranges.push('10001+');
    if (ranges.length > 0) searchParams.organization_num_employees_ranges = ranges;
  }

  if (location) {
    const parts = location.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      searchParams.organization_locations = [location];
    } else {
      searchParams.q_organization_locations = location;
    }
  }

  // Exclude locations
  if (input.locations_exclude?.length) {
    searchParams.organization_not_locations = input.locations_exclude;
  }

  if (keywords) {
    searchParams.q_organization_name = keywords;
  }

  // Exclude keywords
  if (input.keywords_exclude?.length) {
    searchParams.q_organization_not_keyword_tags = input.keywords_exclude;
  }

  // Revenue range mapping
  if (input.revenue_range) {
    const revenueMap: Record<string, string[]> = {
      '0-1M': ['0-1M'],
      '1M-5M': ['1M-10M'],
      '5M-10M': ['1M-10M'],
      '10M-50M': ['10M-50M'],
      '50M-100M': ['50M-100M'],
      '100M-500M': ['100M-500M'],
      '500M-1B': ['500M-1B'],
      '1B+': ['1B+'],
    };
    const mapped = revenueMap[input.revenue_range];
    if (mapped) searchParams.organization_revenue_ranges = mapped;
  }

  // Funding range
  if (input.funding_range) {
    const fundingMap: Record<string, string[]> = {
      '0-1M': ['0-1M'],
      '1M-5M': ['1M-10M'],
      '5M-10M': ['1M-10M'],
      '10M-50M': ['10M-50M'],
      '50M-100M': ['50M-100M'],
      '100M-500M': ['100M-500M'],
      '500M-1B': ['500M-1B'],
      '1B+': ['1B+'],
    };
    const mapped = fundingMap[input.funding_range];
    if (mapped) searchParams.organization_latest_funding_stage_cd = mapped;
  }

  // Company types
  if (input.company_types?.length) {
    searchParams.organization_types = input.company_types;
  }

  // Technologies
  if (input.technologies?.length) {
    searchParams.currently_using_any_of_technology_uids = input.technologies;
  }

  console.log('[Apollo] Searching with params:', JSON.stringify(searchParams));

  try {
    const response = await fetch('https://api.apollo.io/v1/mixed_companies/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify(searchParams),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[Apollo] API error ${response.status}:`, data?.error || data);
      return null; // Signal to try next provider
    }

    const orgs = data.organizations || data.accounts || [];
    console.log(`[Apollo] Found ${orgs.length} companies`);

    if (orgs.length === 0) return null;

    return orgs.map((org: any) => ({
      name: org.name || '',
      domain: org.primary_domain || org.domain || '',
      website: org.website_url || (org.primary_domain ? `https://${org.primary_domain}` : null),
      linkedin_url: org.linkedin_url || null,
      industry: org.industry || null,
      employee_count: org.estimated_num_employees || null,
      employee_range: org.employee_count_range || null,
      annual_revenue: org.annual_revenue || null,
      founded_year: org.founded_year || null,
      description: org.short_description || null,
      headquarters_city: org.city || null,
      headquarters_state: org.state || null,
      headquarters_country: org.country || null,
      technologies: org.technologies?.slice(0, 20) || [],
      keywords: org.keywords?.slice(0, 10) || [],
      source_provider: 'apollo',
    }));
  } catch (e) {
    console.error('[Apollo] Exception:', e);
    return null;
  }
}

// ── Provider 2: People Data Labs (Company Search) ───────────────────
async function searchPDL(input: CompanySearchInput, apiKey: string): Promise<CompanyResult[] | null> {
  const { industry, employee_count_min, employee_count_max, location, keywords, limit = 25 } = input;

  // Build PDL SQL-like query
  const clauses: string[] = [];

  if (industry) {
    clauses.push(`industry='${industry}'`);
  }
  if (employee_count_min) {
    clauses.push(`employee_count>=${employee_count_min}`);
  }
  if (employee_count_max && employee_count_max < 999999) {
    clauses.push(`employee_count<=${employee_count_max}`);
  }
  if (location) {
    // PDL uses location.locality or location.region
    clauses.push(`location.region='${location}' OR location.locality='${location}'`);
  }
  if (keywords) {
    clauses.push(`name='${keywords}'`);
  }

  if (clauses.length === 0) {
    console.log('[PDL] No filters to search with');
    return null;
  }

  const sqlQuery = clauses.join(' AND ');
  console.log(`[PDL] Searching: ${sqlQuery}`);

  try {
    const params = new URLSearchParams({
      sql: `SELECT * FROM company WHERE ${sqlQuery}`,
      size: String(Math.min(limit, 100)),
      dataset: 'all',
    });

    const response = await fetch(`https://api.peopledatalabs.com/v5/company/search?${params}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[PDL] API error ${response.status}:`, data?.error?.message || data);
      return null;
    }

    const companies = data.data || [];
    console.log(`[PDL] Found ${companies.length} companies`);

    if (companies.length === 0) return null;

    return companies.map((c: any) => ({
      name: c.name || c.display_name || '',
      domain: c.website?.replace(/^https?:\/\//, '').replace(/\/$/, '') || '',
      website: c.website || null,
      linkedin_url: c.linkedin_url || null,
      industry: c.industry || null,
      employee_count: c.employee_count || null,
      employee_range: c.size || null,
      annual_revenue: c.estimated_annual_revenue ? parseFloat(c.estimated_annual_revenue) : null,
      founded_year: c.founded || null,
      description: c.summary || null,
      headquarters_city: c.location?.locality || null,
      headquarters_state: c.location?.region || null,
      headquarters_country: c.location?.country || null,
      technologies: c.tags?.slice(0, 20) || [],
      keywords: c.keywords?.slice(0, 10) || [],
      source_provider: 'pdl',
    }));
  } catch (e) {
    console.error('[PDL] Exception:', e);
    return null;
  }
}

// ── Provider 3: Hunter.io (Domain Search) ───────────────────────────
async function searchHunter(input: CompanySearchInput, apiKey: string): Promise<CompanyResult[] | null> {
  const { industry, location, keywords, limit = 25 } = input;

  // Hunter's company search is more limited — use domain-search if we have keywords
  // or use email-finder with company name
  if (!keywords && !industry) {
    console.log('[Hunter] No keywords or industry to search');
    return null;
  }

  const query = keywords || industry || '';
  console.log(`[Hunter] Searching for companies matching: ${query}`);

  try {
    // Use Hunter's company-search (undocumented but works) or domain-search
    const params = new URLSearchParams({
      query,
      api_key: apiKey,
      limit: String(Math.min(limit, 100)),
    });

    if (location) {
      params.set('location', location);
    }

    const response = await fetch(`https://api.hunter.io/v2/domain-search?${params}`, {
      method: 'GET',
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[Hunter] API error ${response.status}:`, data?.errors || data);
      return null;
    }

    const result = data.data;
    if (!result || !result.domain) {
      console.log('[Hunter] No results found');
      return null;
    }

    // Hunter returns a single company domain result
    const companies: CompanyResult[] = [{
      name: result.organization || result.domain || '',
      domain: result.domain || '',
      website: result.domain ? `https://${result.domain}` : null,
      linkedin_url: result.linkedin || null,
      industry: result.industry || industry || null,
      employee_count: null,
      employee_range: null,
      annual_revenue: null,
      founded_year: null,
      description: result.description || null,
      headquarters_city: result.city || null,
      headquarters_state: result.state || null,
      headquarters_country: result.country || null,
      technologies: result.technologies?.slice(0, 20) || [],
      keywords: [],
      source_provider: 'hunter',
    }];

    console.log(`[Hunter] Found ${companies.length} companies`);
    return companies.length > 0 ? companies : null;
  } catch (e) {
    console.error('[Hunter] Exception:', e);
    return null;
  }
}

// ── Main Handler ────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    const requestedHeaders = req.headers.get('access-control-request-headers');
    return new Response(null, {
      headers: {
        ...corsHeaders,
        ...(requestedHeaders ? { 'Access-Control-Allow-Headers': requestedHeaders } : {}),
      },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Auth check
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ success: false, error: 'Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid authentication' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: CompanySearchInput = await req.json();
    const limit = body.limit || 25;

    console.log(`Industry search waterfall: industry=${body.industry}, location=${body.location}, employees=${body.employee_count_min}-${body.employee_count_max}`);

    // Waterfall: try each provider in order until one succeeds
    const providers: { name: string; fn: () => Promise<CompanyResult[] | null> }[] = [];

    const apolloKey = Deno.env.get('APOLLO_API_KEY');
    if (apolloKey) {
      providers.push({ name: 'Apollo', fn: () => searchApollo(body, apolloKey) });
    }

    const pdlKey = Deno.env.get('PDL_API_KEY');
    if (pdlKey) {
      providers.push({ name: 'PDL', fn: () => searchPDL(body, pdlKey) });
    }

    const hunterKey = Deno.env.get('HUNTER_API_KEY');
    if (hunterKey) {
      providers.push({ name: 'Hunter', fn: () => searchHunter(body, hunterKey) });
    }

    if (providers.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No search provider API keys configured. Add APOLLO_API_KEY, PDL_API_KEY, or HUNTER_API_KEY.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let companies: CompanyResult[] | null = null;
    let usedProvider = '';

    for (const provider of providers) {
      console.log(`[Waterfall] Trying ${provider.name}...`);
      companies = await provider.fn();
      if (companies && companies.length > 0) {
        usedProvider = provider.name;
        console.log(`[Waterfall] ✓ ${provider.name} returned ${companies.length} results`);
        break;
      }
      console.log(`[Waterfall] ✗ ${provider.name} returned no results, trying next...`);
    }

    if (!companies || companies.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          companies: [],
          total: 0,
          provider: 'none',
          pagination: { page: 1, per_page: limit, total_entries: 0, total_pages: 0 },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        companies,
        total: companies.length,
        provider: usedProvider.toLowerCase(),
        pagination: {
          page: 1,
          per_page: limit,
          total_entries: companies.length,
          total_pages: 1,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Industry search error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Search failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
