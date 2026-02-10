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
  posted_within?: string; // e.g. '7d', '30d', '90d'
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
}

// Use Apollo's Organization Job Postings as primary
async function searchApolloJobs(input: JobSearchInput, apiKey: string): Promise<{ jobs: JobResult[]; total: number } | null> {
  // Apollo doesn't have a dedicated job search, but we can use mixed_people/search
  // with person_titles to find people with those titles, then infer job availability.
  // Better approach: use Apollo's organization job postings endpoint for specific companies,
  // or use the people search to find recruiters posting jobs.
  
  // Strategy: Search for people with the given titles at companies in the given industries
  const params: Record<string, unknown> = {
    page: input.page || 1,
    per_page: Math.min(input.limit || 25, 100),
  };

  if (input.job_titles?.length) {
    params.person_titles = input.job_titles;
  }
  // Exclude specific job titles
  if (input.exclude_job_titles?.length) {
    params.person_not_titles = input.exclude_job_titles;
  }
  if (input.seniority?.length) {
    params.person_seniorities = input.seniority;
  }
  if (input.industries?.length) {
    // Use keyword tags for text-based industry matching (not numeric IDs)
    params.q_organization_keyword_tags = input.industries;
  }
  if (input.locations?.length) {
    params.person_locations = input.locations;
  }
  if (input.companies?.length) {
    params.q_organization_name = input.companies.join(' ');
  }
  if (input.job_description_keywords?.length) {
    params.q_keywords = input.job_description_keywords.join(' ');
  }
  // Employment type filter — map to Apollo department/seniority proxies
  if (input.employment_types?.length) {
    // Apollo doesn't have a direct employment_type filter, but we can use
    // person_titles to narrow down (e.g., "Part-time", "Contract", "Intern")
    const typeKeywords = input.employment_types.map(t => {
      const map: Record<string, string> = {
        'full_time': '',
        'part_time': 'Part-Time',
        'contract': 'Contract',
        'internship': 'Intern',
        'freelance': 'Freelance',
        'temporary': 'Temporary',
      };
      return map[t] || '';
    }).filter(Boolean);
    if (typeKeywords.length > 0) {
      params.q_keywords = [params.q_keywords || '', ...typeKeywords].filter(Boolean).join(' ');
    }
  }

  // Filter by recently changed (proxy for "recently posted")
  if (input.posted_within) {
    const days = parseInt(input.posted_within) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    params.person_title_changed_at_date_range = {
      min: since.toISOString().split('T')[0],
    };
  }

  console.log('[Job Search Apollo] Params:', JSON.stringify(params));

  try {
    const response = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[Job Search Apollo] Error ${response.status}:`, data?.error || data);
      return null;
    }

    const people = data.people || [];
    const pagination = data.pagination || {};
    console.log(`[Job Search Apollo] Found ${people.length} job-related people`);

    if (people.length === 0) return null;

    // Map people results to job results format
    const jobs: JobResult[] = people.map((p: any) => ({
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
    }));

    return {
      jobs,
      total: pagination.total_entries || jobs.length,
    };
  } catch (e) {
    console.error('[Job Search Apollo] Exception:', e);
    return null;
  }
}

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
    console.log('Job search request:', JSON.stringify(body));

    const apolloKey = Deno.env.get('APOLLO_API_KEY');
    if (!apolloKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'No search provider API keys configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await searchApolloJobs(body, apolloKey);

    return new Response(
      JSON.stringify({
        success: true,
        jobs: result?.jobs || [],
        total: result?.total || 0,
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
