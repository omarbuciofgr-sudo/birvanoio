import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

interface PeopleSearchInput {
  person_titles?: string[];
  person_seniorities?: string[];
  person_departments?: string[];
  person_locations?: string[];
  organization_industry_tag_ids?: string[];
  organization_num_employees_ranges?: string[];
  organization_ids?: string[];           // current companies
  q_organization_name?: string;          // company name search
  person_past_organization_ids?: string[];
  person_past_titles?: string[];
  skills?: string[];
  certifications?: string[];
  languages?: string[];
  education_level?: string[];
  schools?: string[];
  exclude_person_names?: string[];
  profile_keywords?: string[];
  years_experience_min?: number;
  years_experience_max?: number;
  limit?: number;
  page?: number;
}

interface PersonResult {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  headline: string | null;
  seniority: string | null;
  departments: string[];
  organization_name: string | null;
  organization_domain: string | null;
  organization_industry: string | null;
  organization_employee_count: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  linkedin_url: string | null;
  email_status: string | null;
  photo_url: string | null;
}

// Map seniority labels to Apollo codes
const SENIORITY_MAP: Record<string, string> = {
  'owner': 'owner',
  'founder': 'founder',
  'c_suite': 'c_suite',
  'partner': 'partner',
  'vp': 'vp',
  'head': 'head',
  'director': 'director',
  'manager': 'manager',
  'senior': 'senior',
  'entry': 'entry',
  'intern': 'intern',
};

// Map department labels to Apollo codes
const DEPARTMENT_MAP: Record<string, string> = {
  'engineering': 'engineering',
  'sales': 'sales',
  'marketing': 'marketing',
  'finance': 'finance',
  'hr': 'human_resources',
  'operations': 'operations',
  'product': 'product_management',
  'design': 'design',
  'support': 'support',
  'legal': 'legal',
  'it': 'information_technology',
  'data': 'data_science',
  'education': 'education',
  'consulting': 'consulting',
  'media': 'media_and_communication',
};

async function searchApollo(input: PeopleSearchInput, apiKey: string): Promise<{ people: PersonResult[]; total: number } | null> {
  const params: Record<string, unknown> = {
    page: input.page || 1,
    per_page: Math.min(input.limit || 25, 100),
  };

  // Person filters
  if (input.person_titles?.length) {
    params.person_titles = input.person_titles;
  }
  if (input.person_seniorities?.length) {
    params.person_seniorities = input.person_seniorities.map(s => SENIORITY_MAP[s] || s);
  }
  if (input.person_departments?.length) {
    params.person_departments = input.person_departments.map(d => DEPARTMENT_MAP[d] || d);
  }
  if (input.person_locations?.length) {
    params.person_locations = input.person_locations;
  }

  // Organization filters
  if (input.organization_industry_tag_ids?.length) {
    params.organization_industry_tag_ids = input.organization_industry_tag_ids;
    params.q_organization_keyword_tags = input.organization_industry_tag_ids;
  }
  if (input.organization_num_employees_ranges?.length) {
    params.organization_num_employees_ranges = input.organization_num_employees_ranges;
  }
  if (input.q_organization_name) {
    params.q_organization_name = input.q_organization_name;
  }

  // Keywords / skills
  if (input.profile_keywords?.length) {
    params.q_keywords = input.profile_keywords.join(' ');
  }

  console.log('[People Search Apollo] Params:', JSON.stringify(params));

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
      console.error(`[People Search Apollo] Error ${response.status}:`, data?.error || data);
      return null;
    }

    const people = data.people || [];
    const pagination = data.pagination || {};
    console.log(`[People Search Apollo] Found ${people.length} people (total: ${pagination.total_entries || 0})`);

    if (people.length === 0) return null;

    const results: PersonResult[] = people.map((p: any) => ({
      id: p.id || '',
      name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.name || '',
      first_name: p.first_name || null,
      last_name: p.last_name || null,
      title: p.title || null,
      headline: p.headline || null,
      seniority: p.seniority || null,
      departments: p.departments || [],
      organization_name: p.organization?.name || null,
      organization_domain: p.organization?.primary_domain || null,
      organization_industry: p.organization?.industry || null,
      organization_employee_count: p.organization?.estimated_num_employees || null,
      city: p.city || null,
      state: p.state || null,
      country: p.country || null,
      linkedin_url: p.linkedin_url || null,
      email_status: p.email_status || null,
      photo_url: p.photo_url || null,
    }));

    return {
      people: results,
      total: pagination.total_entries || results.length,
    };
  } catch (e) {
    console.error('[People Search Apollo] Exception:', e);
    return null;
  }
}

// PDL People Search fallback
async function searchPDL(input: PeopleSearchInput, apiKey: string): Promise<{ people: PersonResult[]; total: number } | null> {
  const clauses: string[] = [];

  if (input.person_titles?.length) {
    const titleClauses = input.person_titles.map(t => `job_title='${t}'`).join(' OR ');
    clauses.push(`(${titleClauses})`);
  }
  if (input.person_locations?.length) {
    const locClauses = input.person_locations.map(l => `location_name='${l}'`).join(' OR ');
    clauses.push(`(${locClauses})`);
  }
  if (input.organization_industry_tag_ids?.length) {
    clauses.push(`industry='${input.organization_industry_tag_ids[0]}'`);
  }

  if (clauses.length === 0) {
    console.log('[People Search PDL] No filters');
    return null;
  }

  const sqlQuery = clauses.join(' AND ');
  console.log(`[People Search PDL] Query: ${sqlQuery}`);

  try {
    const params = new URLSearchParams({
      sql: `SELECT * FROM person WHERE ${sqlQuery}`,
      size: String(Math.min(input.limit || 25, 100)),
      dataset: 'all',
    });

    const response = await fetch(`https://api.peopledatalabs.com/v5/person/search?${params}`, {
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[People Search PDL] Error ${response.status}:`, data);
      return null;
    }

    const people = data.data || [];
    if (people.length === 0) return null;

    const results: PersonResult[] = people.map((p: any) => ({
      id: p.id || '',
      name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || '',
      first_name: p.first_name || null,
      last_name: p.last_name || null,
      title: p.job_title || null,
      headline: p.headline || null,
      seniority: p.job_title_levels?.[0] || null,
      departments: p.job_title_sub_role ? [p.job_title_sub_role] : [],
      organization_name: p.job_company_name || null,
      organization_domain: p.job_company_website?.replace(/^https?:\/\//, '').replace(/\/$/, '') || null,
      organization_industry: p.industry || null,
      organization_employee_count: p.job_company_size || null,
      city: p.location_locality || null,
      state: p.location_region || null,
      country: p.location_country || null,
      linkedin_url: p.linkedin_url || null,
      email_status: null,
      photo_url: null,
    }));

    return {
      people: results,
      total: data.total || results.length,
    };
  } catch (e) {
    console.error('[People Search PDL] Exception:', e);
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
    const body: PeopleSearchInput = await req.json();
    console.log('People search request:', JSON.stringify(body));

    const providers: { name: string; fn: () => Promise<{ people: PersonResult[]; total: number } | null> }[] = [];

    const apolloKey = Deno.env.get('APOLLO_API_KEY');
    if (apolloKey) {
      providers.push({ name: 'Apollo', fn: () => searchApollo(body, apolloKey) });
    }

    const pdlKey = Deno.env.get('PDL_API_KEY');
    if (pdlKey) {
      providers.push({ name: 'PDL', fn: () => searchPDL(body, pdlKey) });
    }

    if (providers.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No search provider API keys configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: { people: PersonResult[]; total: number } | null = null;
    let usedProvider = '';

    for (const provider of providers) {
      console.log(`[Waterfall] Trying ${provider.name}...`);
      result = await provider.fn();
      if (result && result.people.length > 0) {
        usedProvider = provider.name;
        console.log(`[Waterfall] ✓ ${provider.name} returned ${result.people.length} people`);
        break;
      }
      console.log(`[Waterfall] ✗ ${provider.name} returned no results`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        people: result?.people || [],
        total: result?.total || 0,
        provider: usedProvider.toLowerCase(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('People search error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Search failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
