import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

interface JobSearchInput {
  job_titles?: string[];
  exclude_job_titles?: string[];
  job_description_keywords?: string[];
  industries?: string[];
  companies?: string[];
  locations?: string[];
  employment_types?: string[];
  seniority?: string[];
  recruiter_keywords?: string[];
  posted_within?: string;
  limit?: number;
  page?: number;
}

interface JobResult {
  id: string;
  title: string;
  company_name: string;
  company_domain: string | null;
  company_industry: string | null;
  location: string | null;
  employment_type: string | null;
  seniority: string | null;
  description_snippet: string | null;
  posted_at: string | null;
  linkedin_url: string | null;
  apply_url: string | null;
  source_provider?: string;
}

// ── Provider 1: Apollo (updated endpoint) ───────────────────────────
async function searchApollo(input: JobSearchInput, apiKey: string): Promise<JobResult[] | null> {
  const params: Record<string, unknown> = {
    page: input.page || 1,
    per_page: Math.min(input.limit || 25, 100),
  };

  if (input.job_titles?.length) params.person_titles = input.job_titles;
  if (input.exclude_job_titles?.length) params.person_not_titles = input.exclude_job_titles;
  if (input.seniority?.length) params.person_seniorities = input.seniority;
  if (input.industries?.length) params.q_organization_keyword_tags = input.industries;
  if (input.locations?.length) params.person_locations = input.locations;
  if (input.companies?.length) {
    params.q_organization_name = input.companies.join(' ');
    // Tighten fuzzy org-name search (mixed_people is loose without this)
    const extra = input.companies.join(' ');
    params.q_keywords = [params.q_keywords as string | undefined, extra].filter(Boolean).join(' ').trim();
  }

  const keywordParts: string[] = [];
  if (input.job_description_keywords?.length) keywordParts.push(...input.job_description_keywords);
  if (input.recruiter_keywords?.length) keywordParts.push(...input.recruiter_keywords);
  if (input.employment_types?.length) {
    const typeKeywords = input.employment_types.map(t => {
      const map: Record<string, string> = {
        'part_time': 'Part-Time', 'contract': 'Contract',
        'internship': 'Intern', 'freelance': 'Freelance', 'temporary': 'Temporary',
      };
      return map[t] || '';
    }).filter(Boolean);
    keywordParts.push(...typeKeywords);
  }
  if (keywordParts.length > 0) params.q_keywords = keywordParts.join(' ');

  if (input.posted_within) {
    const days = parseInt(input.posted_within) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    params.person_title_changed_at_date_range = { min: since.toISOString().split('T')[0] };
  }

  const hasSignal = !!(
    input.job_titles?.length ||
    input.industries?.length ||
    input.locations?.length ||
    input.companies?.length ||
    input.job_description_keywords?.length ||
    input.recruiter_keywords?.length
  );
  if (!hasSignal) {
    params.q_keywords = 'hiring recruiting talent careers';
    params.person_titles = ['Recruiter', 'Talent Acquisition', 'Human Resources', 'HR Manager', 'People Operations'];
    params.person_locations = ['United States'];
  } else if (!input.job_titles?.length) {
    params.person_titles = [
      'Manager', 'Director', 'Engineer', 'Sales', 'Marketing', 'Operations',
      'Specialist', 'Analyst', 'Representative', 'Consultant', 'Developer',
    ];
  }

  console.log('[Job Apollo] Params:', JSON.stringify(params));

  try {
    // Try the new endpoint first, fall back to the old one
    const endpoints = [
      'https://api.apollo.io/api/v1/mixed_people/api_search',
      'https://api.apollo.io/api/v1/people/search',
    ];

    let data: any = null;
    let success = false;

    for (const endpoint of endpoints) {
      console.log(`[Job Apollo] Trying ${endpoint}...`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': apiKey,
        },
        body: JSON.stringify(params),
      });

      data = await response.json();

      if (response.ok) {
        success = true;
        break;
      }
      console.error(`[Job Apollo] ${endpoint} error ${response.status}:`, data?.error || JSON.stringify(data).slice(0, 200));
    }

    if (!success || !data) return null;

    const people = data.people || [];
    console.log(`[Job Apollo] Found ${people.length} people`);
    if (people.length === 0) return null;

    return people.map((p: any) => ({
      id: p.id || '',
      title: p.title || 'Unknown Position',
      company_name: p.organization?.name || '',
      company_domain: p.organization?.primary_domain || null,
      company_industry: p.organization?.industry || null,
      location: [p.city, p.state, p.country].filter(Boolean).join(', ') || null,
      employment_type: null,
      seniority: p.seniority || null,
      description_snippet: p.headline || null,
      posted_at: null,
      linkedin_url: p.linkedin_url || null,
      apply_url: p.organization?.website_url || null,
      source_provider: 'apollo',
    }));
  } catch (e) {
    console.error('[Job Apollo] Exception:', e);
    return null;
  }
}

// ── Provider 2: RocketReach ─────────────────────────────────────────
async function searchRocketReach(input: JobSearchInput, apiKey: string): Promise<JobResult[] | null> {
  const query: Record<string, unknown> = {
    page_size: Math.min(input.limit || 25, 100),
    start: ((input.page || 1) - 1) * Math.min(input.limit || 25, 100) + 1,
  };

  if (input.job_titles?.length) query.current_title = input.job_titles;
  if (input.locations?.length) query.location = input.locations;
  if (input.industries?.length) query.keyword = input.industries;
  if (input.companies?.length) query.current_employer = input.companies[0];
  if (input.seniority?.length) query.management_levels = input.seniority;

  if (!input.job_titles?.length && !input.industries?.length && !input.companies?.length) {
    console.log('[Job RocketReach] No search criteria');
    return null;
  }

  console.log('[Job RocketReach] Params:', JSON.stringify(query));

  try {
    const response = await fetch('https://api.rocketreach.co/api/v2/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Api-Key': apiKey },
      body: JSON.stringify(query),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error(`[Job RocketReach] Error ${response.status}:`, data?.detail || data);
      return null;
    }

    const profiles = data.profiles || data.people || data.results || [];
    console.log(`[Job RocketReach] Found ${profiles.length} people`);
    if (profiles.length === 0) return null;

    return profiles.map((p: any) => ({
      id: String(p.id || ''),
      title: p.current_title || p.title || 'Unknown Position',
      company_name: p.current_employer || p.company_name || '',
      company_domain: p.employer_website?.replace(/^https?:\/\//, '').replace(/\/.*$/, '') || null,
      company_industry: p.industry || null,
      location: [p.city, p.state || p.region, p.country].filter(Boolean).join(', ') || null,
      employment_type: null,
      seniority: p.management_level || null,
      description_snippet: p.headline || null,
      posted_at: null,
      linkedin_url: p.linkedin_url || null,
      apply_url: p.employer_website || null,
      source_provider: 'rocketreach',
    }));
  } catch (e) {
    console.error('[Job RocketReach] Exception:', e);
    return null;
  }
}

// ── Provider 3: PDL ─────────────────────────────────────────────────
async function searchPDL(input: JobSearchInput, apiKey: string): Promise<JobResult[] | null> {
  const clauses: string[] = [];

  if (input.job_titles?.length) {
    const titleClauses = input.job_titles.map(t => `job_title='${t}'`).join(' OR ');
    clauses.push(`(${titleClauses})`);
  }
  if (input.locations?.length) {
    const locClauses = input.locations.map(l => `location_name='${l}'`).join(' OR ');
    clauses.push(`(${locClauses})`);
  }
  if (input.industries?.length) {
    clauses.push(`industry='${input.industries[0]}'`);
  }

  if (clauses.length === 0) {
    console.log('[Job PDL] No filters');
    return null;
  }

  const sqlQuery = clauses.join(' AND ');
  console.log(`[Job PDL] Query: ${sqlQuery}`);

  try {
    const params = new URLSearchParams({
      sql: `SELECT * FROM person WHERE ${sqlQuery}`,
      size: String(Math.min(input.limit || 25, 100)),
      dataset: 'all',
    });

    const response = await fetch(`https://api.peopledatalabs.com/v5/person/search?${params}`, {
      headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    if (!response.ok) {
      console.error(`[Job PDL] Error ${response.status}:`, data);
      return null;
    }

    const people = data.data || [];
    if (people.length === 0) return null;
    console.log(`[Job PDL] Found ${people.length} people`);

    return people.map((p: any) => ({
      id: p.id || '',
      title: p.job_title || 'Unknown Position',
      company_name: p.job_company_name || '',
      company_domain: p.job_company_website?.replace(/^https?:\/\//, '').replace(/\/$/, '') || null,
      company_industry: p.industry || null,
      location: [p.location_locality, p.location_region, p.location_country].filter(Boolean).join(', ') || null,
      employment_type: null,
      seniority: p.job_title_levels?.[0] || null,
      description_snippet: p.headline || null,
      posted_at: null,
      linkedin_url: p.linkedin_url || null,
      apply_url: p.job_company_website || null,
      source_provider: 'pdl',
    }));
  } catch (e) {
    console.error('[Job PDL] Exception:', e);
    return null;
  }
}

// ── Merge helper ────────────────────────────────────────────────────
function normalizeKey(job: JobResult): string {
  const title = (job.title || '').toLowerCase().trim();
  const company = (job.company_name || job.company_domain || '').toLowerCase().trim();
  if (job.linkedin_url) return job.linkedin_url.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
  return `${title}@${company}`;
}

/** Drop rows that do not match user-requested employer names (Apollo returns many near-misses). */
function filterByCompanyNames(jobs: JobResult[], companies?: string[]): JobResult[] {
  if (!companies?.length) return jobs;
  const needles = companies
    .map((c) =>
      c
        .toLowerCase()
        .trim()
        .replace(/^https?:\/\/(www\.)?/i, '')
        .replace(/\.(com|io|co|net|org)\/?$/i, '')
    )
    .filter((c) => c.length >= 2);
  if (needles.length === 0) return jobs;
  return jobs.filter((j) => {
    const name = (j.company_name || '').toLowerCase();
    const dom = (j.company_domain || '').toLowerCase().replace(/^www\./, '');
    return needles.some((n) => name.includes(n) || dom.includes(n.replace(/\s+/g, '')));
  });
}

function mergeJob(primary: JobResult, secondary: JobResult): JobResult {
  return {
    id: primary.id || secondary.id,
    title: primary.title || secondary.title,
    company_name: primary.company_name || secondary.company_name,
    company_domain: primary.company_domain || secondary.company_domain,
    company_industry: primary.company_industry || secondary.company_industry,
    location: primary.location || secondary.location,
    employment_type: primary.employment_type || secondary.employment_type,
    seniority: primary.seniority || secondary.seniority,
    description_snippet: primary.description_snippet || secondary.description_snippet,
    posted_at: primary.posted_at || secondary.posted_at,
    linkedin_url: primary.linkedin_url || secondary.linkedin_url,
    apply_url: primary.apply_url || secondary.apply_url,
    source_provider: primary.source_provider,
  };
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
    const body: JobSearchInput = await req.json();
    const limit = body.limit || 25;
    console.log('Job search request:', JSON.stringify(body));

    // Build provider list
    const providers: { name: string; fn: () => Promise<JobResult[] | null> }[] = [];

    const apolloKey = Deno.env.get('APOLLO_API_KEY');
    if (apolloKey) providers.push({ name: 'Apollo', fn: () => searchApollo(body, apolloKey) });

    const rocketReachKey = Deno.env.get('ROCKETREACH_API_KEY');
    if (rocketReachKey) providers.push({ name: 'RocketReach', fn: () => searchRocketReach(body, rocketReachKey) });

    const pdlKey = Deno.env.get('PDL_API_KEY');
    if (pdlKey) providers.push({ name: 'PDL', fn: () => searchPDL(body, pdlKey) });

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
      if (result && result.length > 0) {
        console.log(`[Merge] ✓ ${p.name} returned ${result.length} jobs`);
        return { name: p.name, jobs: result };
      }
      console.log(`[Merge] ✗ ${p.name} returned no results`);
      return { name: p.name, jobs: [] as JobResult[] };
    }));

    // Merge results
    const mergedMap = new Map<string, JobResult>();
    const usedProviders: string[] = [];

    for (const settled of allResults) {
      if (settled.status !== 'fulfilled') continue;
      const { name, jobs } = settled.value;
      if (jobs.length === 0) continue;
      usedProviders.push(name);

      for (const job of jobs) {
        const key = normalizeKey(job);
        if (!key || key === '@') continue;
        const existing = mergedMap.get(key);
        if (existing) {
          mergedMap.set(key, mergeJob(existing, job));
        } else {
          mergedMap.set(key, job);
        }
      }
    }

    let mergedJobs = Array.from(mergedMap.values());
    if (body.companies?.length) {
      const before = mergedJobs.length;
      mergedJobs = filterByCompanyNames(mergedJobs, body.companies);
      console.log(`[Merge] Company-name filter: ${before} -> ${mergedJobs.length}`);
    }
    mergedJobs = mergedJobs.slice(0, limit);
    console.log(`[Merge] Final: ${mergedJobs.length} merged jobs from [${usedProviders.join(', ')}]`);

    return new Response(
      JSON.stringify({
        success: true,
        jobs: mergedJobs,
        total: mergedJobs.length,
        providers: usedProviders.map(p => p.toLowerCase()),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Job search error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Search failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
