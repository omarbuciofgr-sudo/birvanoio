import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

interface CompanySearchInput {
  industry?: string;
  industries_exclude?: string[];
  employee_ranges?: string[];
  employee_count_min?: number;
  employee_count_max?: number;
  location?: string;
  locations_exclude?: string[];
  keywords?: string;
  keywords_exclude?: string[];
  revenue_range?: string;
  funding_range?: string;
  funding_stage?: string;
  company_types?: string[];
  technologies?: string[];
  sic_codes?: string[];
  naics_codes?: string[];
  buying_intent?: string;
  market_segments?: string[];
  job_posting_filter?: string;
  job_categories?: string[];
  limit?: number;
  page?: number;
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
  social_profiles?: Record<string, string>;
  phone?: string | null;
  logo_url?: string | null;
}

// ── Provider 1: Apollo ──────────────────────────────────────────────
async function searchApollo(input: CompanySearchInput, apiKey: string): Promise<CompanyResult[] | null> {
  const { industry, employee_ranges, employee_count_min, employee_count_max, location, keywords, limit = 25 } = input;

  const page = input.page || 1;
  const searchParams: Record<string, unknown> = {
    page,
    per_page: Math.min(limit, 100),
  };

  if (industry) {
    const industryTags = industry.split(',').map((s: string) => s.trim()).filter(Boolean);
    // Use q_organization_keyword_tags for industry matching (Apollo requires numeric IDs for organization_industry_tag_ids)
    searchParams.q_organization_keyword_tags = industryTags;
    // Also set as a strict keyword filter to narrow results
    searchParams.q_keywords = industryTags.join(' ');
  }

  // Use employee_ranges directly if provided (e.g. ["1-10", "11-50", "51-200"])
  // IMPORTANT: Apollo expects comma-separated format like "1,10" not "1-10"
  if (employee_ranges && employee_ranges.length > 0) {
    const apolloRanges = employee_ranges.map(r => {
      if (r === '5001+' || r === '10001+') return '10001,';
      // Convert "1-10" → "1,10"
      return r.replace('-', ',');
    });
    searchParams.organization_num_employees_ranges = apolloRanges;
  } else if (employee_count_min || employee_count_max) {
    const ranges: string[] = [];
    const min = employee_count_min || 0;
    const max = employee_count_max || 999999;
    if (min < 10) ranges.push('1,10');
    if (min <= 50 && max >= 11) ranges.push('11,50');
    if (min <= 200 && max >= 51) ranges.push('51,200');
    if (min <= 500 && max >= 201) ranges.push('201,500');
    if (min <= 1000 && max >= 501) ranges.push('501,1000');
    if (min <= 5000 && max >= 1001) ranges.push('1001,5000');
    if (min <= 10000 && max >= 5001) ranges.push('5001,10000');
    if (max >= 10001) ranges.push('10001,');
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
    // Merge keywords into keyword tags for narrowing
    const keywordTags = keywords.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (keywordTags.length > 0) {
      searchParams.q_organization_keyword_tags = [
        ...(searchParams.q_organization_keyword_tags as string[] || []),
        ...keywordTags,
      ];
    }
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

  // Funding stage (Seed, Series A, etc.)
  if (input.funding_stage) {
    const stageMap: Record<string, string> = {
      'seed': 'seed',
      'series_a': 'series_a',
      'series_b': 'series_b',
      'series_c': 'series_c',
      'series_d': 'series_d',
      'ipo': 'ipo',
      'private_equity': 'private_equity',
      'debt_financing': 'debt_financing',
      'grant': 'grant',
    };
    const mapped = stageMap[input.funding_stage];
    if (mapped) searchParams.organization_latest_funding_stage_cd = [mapped];
  }

  // Exclude industries
  if (input.industries_exclude?.length) {
    searchParams.q_organization_not_keyword_tags = [
      ...(searchParams.q_organization_not_keyword_tags as string[] || []),
      ...input.industries_exclude,
    ];
  }

  // Market segments → keyword proxy
  if (input.market_segments?.length) {
    const segmentKeywords = input.market_segments.map(s => {
      const map: Record<string, string> = {
        'enterprise': 'enterprise',
        'mid_market': 'mid-market',
        'smb': 'small business',
        'startup': 'startup',
        'consumer': 'consumer',
        'government': 'government',
        'education': 'education',
        'healthcare': 'healthcare',
      };
      return map[s] || s;
    });
    searchParams.q_organization_keyword_tags = [
      ...(searchParams.q_organization_keyword_tags as string[] || []),
      ...segmentKeywords,
    ];
  }

  // Buying intent → Apollo intent filters
  if (input.buying_intent) {
    if (input.buying_intent === 'high') {
      searchParams.organization_job_locations = searchParams.organization_job_locations || ['United States'];
    }
    // Add intent as keyword signal
    const intentKeywords: Record<string, string> = {
      'high': 'actively buying',
      'medium': 'evaluating solutions',
    };
    if (intentKeywords[input.buying_intent]) {
      searchParams.q_keywords = [searchParams.q_keywords || '', intentKeywords[input.buying_intent]].filter(Boolean).join(' ');
    }
  }

  // Company types
  if (input.company_types?.length) {
    searchParams.organization_types = input.company_types;
  }

  // Technologies
  if (input.technologies?.length) {
    searchParams.currently_using_any_of_technology_uids = input.technologies;
  }

  // SIC codes
  if (input.sic_codes?.length) {
    searchParams.organization_sic_codes = input.sic_codes;
  }

  // NAICS codes
  if (input.naics_codes?.length) {
    searchParams.organization_naics_codes = input.naics_codes;
  }

  // Job postings filter
  if (input.job_posting_filter === 'has_job_postings') {
    searchParams.organization_job_locations = ['United States'];
  }

  // Job categories / departments hiring
  if (input.job_categories?.length) {
    searchParams.organization_department_or_subdepartment_counts = input.job_categories.map(cat => ({
      department_or_subdepartment: cat,
      min: 1,
    }));
  }

  console.log('[Apollo] Searching with params:', JSON.stringify(searchParams));

  try {
    // Use organizations/search for richer company data (description, employee count, location)
    const response = await fetch('https://api.apollo.io/api/v1/mixed_companies/search', {
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
      return null;
    }

    const orgs = data.organizations || data.accounts || [];
    console.log(`[Apollo] Found ${orgs.length} companies`);
    
    // Log first result's raw fields for debugging data gaps
    if (orgs.length > 0) {
      const sample = orgs[0];
      console.log(`[Apollo] Sample org fields: name=${sample.name}, estimated_num_employees=${sample.estimated_num_employees}, city=${sample.city}, state=${sample.state}, short_description=${(sample.short_description || '').slice(0, 50)}, seo_description=${(sample.seo_description || '').slice(0, 50)}`);
      console.log(`[Apollo] Sample org keys:`, Object.keys(sample).join(', '));
    }
    if (orgs.length === 0) return null;

    const totalEntries = data.pagination?.total_entries || orgs.length;
    const totalPages = data.pagination?.total_pages || 1;

    return {
      results: orgs.map((org: any) => ({
        name: org.name || '',
        domain: org.primary_domain || org.domain || org.website_url?.replace(/^https?:\/\//, '').replace(/\/.*$/, '') || '',
        website: org.website_url || (org.primary_domain ? `https://${org.primary_domain}` : null),
        linkedin_url: org.linkedin_url || null,
        industry: org.industry || org.organization_industry || input.industry || null,
        employee_count: org.estimated_num_employees || org.employee_count || org.num_employees || null,
        employee_range: org.employee_count_range || org.employees_range || null,
        annual_revenue: org.organization_revenue || org.annual_revenue || org.estimated_annual_revenue || null,
        founded_year: org.founded_year || null,
        description: org.short_description || org.seo_description || org.snippets_loaded?.description || org.raw_address || null,
        headquarters_city: org.city || org.hq_city || org.organization_city || null,
        headquarters_state: org.state || org.hq_state || org.organization_state || null,
        headquarters_country: org.country || org.hq_country || org.organization_country || null,
        technologies: org.technologies?.slice(0, 20) || [],
        keywords: org.keywords?.slice(0, 10) || [],
        source_provider: 'apollo',
        logo_url: org.logo_url || null,
        phone: org.phone || org.primary_phone?.number || org.sanitized_phone || null,
        market_cap: org.market_cap || null,
        sic_codes: org.sic_codes || [],
        naics_codes: org.naics_codes || [],
      })),
      totalEntries,
      totalPages,
    };
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

// ── Provider 3: RocketReach (Company Search) ───────────────────────
async function searchRocketReach(input: CompanySearchInput, apiKey: string): Promise<CompanyResult[] | null> {
  const { industry, location, keywords, limit = 25 } = input;

  const query: Record<string, unknown> = {
    page_size: Math.min(limit, 100),
    page: input.page || 1,
  };

  if (industry) {
    query.keyword = industry.split(',').map((s: string) => s.trim()).filter(Boolean);
  }

  if (location) {
    query.location = location.split(',').map((s: string) => s.trim());
  }

  if (input.employee_ranges?.length) {
    // RocketReach uses employee_count_min/max
    const ranges = input.employee_ranges;
    const mins = ranges.map(r => {
      const parts = r.split('-');
      return parseInt(parts[0]) || 0;
    });
    const maxes = ranges.map(r => {
      if (r.includes('+')) return 999999;
      const parts = r.split('-');
      return parseInt(parts[1]) || 999999;
    });
    query.employee_count_min = Math.min(...mins);
    query.employee_count_max = Math.max(...maxes);
  }

  if (keywords) {
    query.name = keywords;
  }

  if (input.revenue_range) {
    const revenueMap: Record<string, [number, number]> = {
      '0-1M': [0, 1000000],
      '1M-5M': [1000000, 5000000],
      '5M-10M': [5000000, 10000000],
      '10M-50M': [10000000, 50000000],
      '50M-100M': [50000000, 100000000],
      '100M-500M': [100000000, 500000000],
      '500M-1B': [500000000, 1000000000],
      '1B+': [1000000000, 999999999999],
    };
    const mapped = revenueMap[input.revenue_range];
    if (mapped) {
      query.revenue_min = mapped[0];
      query.revenue_max = mapped[1];
    }
  }

  console.log('[RocketReach] Searching with params:', JSON.stringify(query));

  try {
    const response = await fetch('https://api.rocketreach.co/api/v2/searchCompany', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': apiKey,
      },
      body: JSON.stringify(query),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[RocketReach] API error ${response.status}:`, data?.detail || data);
      return null;
    }

    const companies = data.companies || data.results || [];
    console.log(`[RocketReach] Found ${companies.length} companies`);

    if (companies.length === 0) return null;

    return companies.map((c: any) => ({
      name: c.name || '',
      domain: c.domain || c.website_domain || '',
      website: c.website_url || (c.domain ? `https://${c.domain}` : null),
      linkedin_url: c.linkedin_url || null,
      industry: c.industry || input.industry || null,
      employee_count: c.employee_count || c.num_employees || null,
      employee_range: null,
      annual_revenue: c.revenue || null,
      founded_year: c.year_founded || null,
      description: c.description || null,
      headquarters_city: c.city || c.location?.city || null,
      headquarters_state: c.state || c.location?.state || null,
      headquarters_country: c.country || c.location?.country || null,
      technologies: [],
      keywords: [],
      source_provider: 'rocketreach',
    }));
  } catch (e) {
    console.error('[RocketReach] Exception:', e);
    return null;
  }
}

// ── Provider 4: Lusha (Company Prospecting) ─────────────────────────
async function searchLusha(input: CompanySearchInput, apiKey: string): Promise<CompanyResult[] | null> {
  const { industry, location, limit = 25 } = input;

  const filters: Record<string, unknown> = {
    limit: Math.min(limit, 100),
  };

  if (industry) {
    // Lusha uses industry labels
    filters.industries = industry.split(',').map((s: string) => s.trim()).filter(Boolean);
  }

  if (location) {
    filters.locations = location.split(',').map((s: string) => s.trim());
  }

  if (input.employee_ranges?.length) {
    // Lusha uses size labels like "1-10", "11-50", etc.
    filters.sizes = input.employee_ranges;
  }

  if (input.revenue_range) {
    filters.revenues = [input.revenue_range];
  }

  if (input.technologies?.length) {
    filters.technologies = input.technologies;
  }

  if (input.sic_codes?.length) {
    filters.sic_codes = input.sic_codes;
  }

  if (input.naics_codes?.length) {
    filters.naics_codes = input.naics_codes;
  }

  console.log('[Lusha] Searching with filters:', JSON.stringify(filters));

  try {
    const response = await fetch('https://api.lusha.com/prospecting/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_key': apiKey,
      },
      body: JSON.stringify({
        searchType: 'company',
        filters,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[Lusha] API error ${response.status}:`, data?.message || data);
      return null;
    }

    const companies = data.data || data.companies || data.results || [];
    console.log(`[Lusha] Found ${companies.length} companies`);

    if (companies.length === 0) return null;

    return companies.map((c: any) => ({
      name: c.company_name || c.name || '',
      domain: c.website_domain || c.domain || '',
      website: c.website || (c.website_domain ? `https://${c.website_domain}` : null),
      linkedin_url: c.linkedin_url || null,
      industry: c.industry || input.industry || null,
      employee_count: c.employee_count || c.company_size || null,
      employee_range: c.size_range || null,
      annual_revenue: c.revenue || null,
      founded_year: c.year_founded || null,
      description: c.description || null,
      headquarters_city: c.city || c.location?.city || null,
      headquarters_state: c.state || c.location?.state || null,
      headquarters_country: c.country_code || c.country || null,
      technologies: c.technologies || [],
      keywords: [],
      source_provider: 'lusha',
    }));
  } catch (e) {
    console.error('[Lusha] Exception:', e);
    return null;
  }
}

// ── Provider 5: Hunter.io (Domain Search) ───────────────────────────
async function searchHunter(input: CompanySearchInput, apiKey: string): Promise<CompanyResult[] | null> {
  const { industry, location, keywords, limit = 25 } = input;

  if (!keywords && !industry) {
    console.log('[Hunter] No keywords or industry to search');
    return null;
  }

  const query = keywords || industry || '';
  console.log(`[Hunter] Searching for companies matching: ${query}`);

  try {
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

// ── Social Profile Scraper (free, from website) ─────────────────────
async function scrapeSocialProfiles(domain: string): Promise<Record<string, string>> {
  const profiles: Record<string, string> = {};
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(`https://${domain}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrivanoBot/1.0)' },
    });
    clearTimeout(timeout);
    if (!resp.ok) return profiles;
    const html = await resp.text();

    // Extract social links from HTML
    const patterns: [string, RegExp][] = [
      ['twitter', /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]{1,50})/g],
      ['facebook', /https?:\/\/(?:www\.)?facebook\.com\/([a-zA-Z0-9.]+)/g],
      ['instagram', /https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)/g],
      ['youtube', /https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|c\/|user\/)([a-zA-Z0-9_-]+)/g],
      ['tiktok', /https?:\/\/(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.]+)/g],
      ['github', /https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/g],
    ];

    for (const [platform, regex] of patterns) {
      const match = regex.exec(html);
      if (match) {
        profiles[platform] = match[0];
      }
    }
  } catch {
    // Timeout or fetch error — skip silently
  }
  return profiles;
}

// ── Merge helper: fill blanks from secondary into primary ───────────
function mergeCompany(primary: CompanyResult, secondary: CompanyResult): CompanyResult {
  return {
    name: primary.name || secondary.name,
    domain: primary.domain || secondary.domain,
    website: primary.website || secondary.website,
    linkedin_url: primary.linkedin_url || secondary.linkedin_url,
    industry: primary.industry || secondary.industry,
    employee_count: primary.employee_count ?? secondary.employee_count,
    employee_range: primary.employee_range || secondary.employee_range,
    annual_revenue: primary.annual_revenue ?? secondary.annual_revenue,
    founded_year: primary.founded_year ?? secondary.founded_year,
    description: primary.description || secondary.description,
    headquarters_city: primary.headquarters_city || secondary.headquarters_city,
    headquarters_state: primary.headquarters_state || secondary.headquarters_state,
    headquarters_country: primary.headquarters_country || secondary.headquarters_country,
    technologies: primary.technologies.length > 0 ? primary.technologies : secondary.technologies,
    keywords: primary.keywords.length > 0 ? primary.keywords : secondary.keywords,
    source_provider: primary.source_provider,
    social_profiles: { ...(secondary.social_profiles || {}), ...(primary.social_profiles || {}) },
    phone: primary.phone || secondary.phone,
    logo_url: primary.logo_url || secondary.logo_url,
  };
}

function normalizedDomain(d: string | null | undefined): string {
  if (!d) return '';
  return d.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();
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
    const page = body.page || 1;

    console.log(`Industry search (merge mode): industry=${body.industry}, location=${body.location}`);

    // Build provider list
    const providers: { name: string; fn: () => Promise<any> }[] = [];

    const apolloKey = Deno.env.get('APOLLO_API_KEY');
    if (apolloKey) providers.push({ name: 'Apollo', fn: () => searchApollo(body, apolloKey) });

    const pdlKey = Deno.env.get('PDL_API_KEY');
    if (pdlKey) providers.push({ name: 'PDL', fn: () => searchPDL(body, pdlKey) });

    const rocketReachKey = Deno.env.get('ROCKETREACH_API_KEY');
    if (rocketReachKey) providers.push({ name: 'RocketReach', fn: () => searchRocketReach(body, rocketReachKey) });

    const lushaKey = Deno.env.get('LUSHA_API_KEY');
    if (lushaKey) providers.push({ name: 'Lusha', fn: () => searchLusha(body, lushaKey) });

    const hunterKey = Deno.env.get('HUNTER_API_KEY');
    if (hunterKey) providers.push({ name: 'Hunter', fn: () => searchHunter(body, hunterKey) });

    if (providers.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No search provider API keys configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Run ALL providers in parallel
    console.log(`[Merge] Running ${providers.length} providers in parallel...`);
    const allResults = await Promise.allSettled(providers.map(async (p) => {
      console.log(`[Merge] Starting ${p.name}...`);
      const result = await p.fn();
      if (result && typeof result === 'object' && 'results' in result) {
        console.log(`[Merge] ✓ ${p.name} returned ${result.results.length} results`);
        return { name: p.name, companies: result.results as CompanyResult[], totalEntries: result.totalEntries, totalPages: result.totalPages };
      } else if (Array.isArray(result) && result.length > 0) {
        console.log(`[Merge] ✓ ${p.name} returned ${result.length} results`);
        return { name: p.name, companies: result as CompanyResult[], totalEntries: result.length, totalPages: 1 };
      }
      console.log(`[Merge] ✗ ${p.name} returned no results`);
      return { name: p.name, companies: [] as CompanyResult[], totalEntries: 0, totalPages: 0 };
    }));

    // Build merged map keyed by normalized domain
    const mergedMap = new Map<string, CompanyResult>();
    let totalEntries = 0;
    let totalPages = 1;
    const usedProviders: string[] = [];

    for (const settled of allResults) {
      if (settled.status !== 'fulfilled') continue;
      const { name, companies, totalEntries: te, totalPages: tp } = settled.value;
      if (companies.length === 0) continue;
      usedProviders.push(name);

      // Use the first successful provider's pagination as the primary
      if (totalEntries === 0) {
        totalEntries = te;
        totalPages = tp;
      }

      for (const company of companies) {
        const key = normalizedDomain(company.domain) || company.name.toLowerCase();
        if (!key) continue;
        const existing = mergedMap.get(key);
        if (existing) {
          mergedMap.set(key, mergeCompany(existing, company));
        } else {
          mergedMap.set(key, company);
        }
      }
    }

    let companies = Array.from(mergedMap.values()).slice(0, limit);

    if (companies.length === 0) {
      return new Response(
        JSON.stringify({
          success: true, companies: [], total: 0, provider: 'none',
          pagination: { page, per_page: limit, total_entries: 0, total_pages: 0 },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Scrape social profiles from websites (parallel, with timeout)
    console.log(`[Social] Scraping social profiles for ${Math.min(companies.length, 15)} companies...`);
    const socialBatch = companies.slice(0, 15); // limit to first 15 to keep response fast
    const socialResults = await Promise.allSettled(
      socialBatch.map(async (c) => {
        const domain = normalizedDomain(c.domain);
        if (!domain) return {};
        return scrapeSocialProfiles(domain);
      })
    );

    for (let i = 0; i < socialBatch.length; i++) {
      const r = socialResults[i];
      if (r.status === 'fulfilled' && Object.keys(r.value).length > 0) {
        companies[i] = {
          ...companies[i],
          social_profiles: { ...(companies[i].social_profiles || {}), ...r.value },
        };
      }
    }

    console.log(`[Merge] Final: ${companies.length} merged companies from [${usedProviders.join(', ')}]`);

    return new Response(
      JSON.stringify({
        success: true,
        companies,
        total: totalEntries,
        provider: usedProviders.join('+').toLowerCase(),
        pagination: { page, per_page: limit, total_entries: totalEntries, total_pages: totalPages },
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
