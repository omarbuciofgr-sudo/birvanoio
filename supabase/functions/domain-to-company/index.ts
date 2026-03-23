const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CompanyProfile {
  domain: string;
  name: string | null;
  industry: string | null;
  employee_count: number | null;
  employee_range: string | null;
  founded_year: number | null;
  description: string | null;
  linkedin_url: string | null;
  website: string | null;
  headquarters_city: string | null;
  headquarters_state: string | null;
  headquarters_country: string | null;
  technologies: string[];
  annual_revenue: number | null;
  phone: string | null;
  logo_url: string | null;
  source_providers: string[];
}

// ── Apollo ──
async function enrichApollo(domain: string, apiKey: string): Promise<Partial<CompanyProfile> | null> {
  try {
    const resp = await fetch('https://api.apollo.io/api/v1/organizations/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({ domain }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const org = data.organization;
    if (!org) return null;
    return {
      name: org.name,
      industry: org.industry,
      employee_count: org.estimated_num_employees,
      description: org.short_description || org.seo_description,
      linkedin_url: org.linkedin_url,
      website: org.website_url,
      headquarters_city: org.city,
      headquarters_state: org.state,
      headquarters_country: org.country,
      technologies: org.current_technologies || [],
      annual_revenue: org.annual_revenue,
      phone: org.phone,
      logo_url: org.logo_url,
      founded_year: org.founded_year,
    };
  } catch { return null; }
}

// ── PDL ──
async function enrichPDL(domain: string, apiKey: string): Promise<Partial<CompanyProfile> | null> {
  try {
    const params = new URLSearchParams({ website: domain, pretty: 'true' });
    const resp = await fetch(`https://api.peopledatalabs.com/v5/company/enrich?${params}`, {
      headers: { 'X-Api-Key': apiKey },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return {
      name: data.name,
      industry: data.industry,
      employee_count: data.employee_count,
      employee_range: data.size,
      description: data.summary,
      linkedin_url: data.linkedin_url,
      website: data.website,
      headquarters_city: data.location?.locality,
      headquarters_state: data.location?.region,
      headquarters_country: data.location?.country,
      technologies: data.tags || [],
      founded_year: data.founded,
    };
  } catch { return null; }
}

// ── Clearbit / public enrichment ──
async function enrichClearbit(domain: string): Promise<Partial<CompanyProfile> | null> {
  try {
    const resp = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${domain}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    const match = data.find((c: any) => c.domain === domain || c.domain === `www.${domain}`);
    if (!match) return null;
    return {
      name: match.name,
      logo_url: match.logo,
      domain: match.domain,
    };
  } catch { return null; }
}

// ── RocketReach ──
async function enrichRocketReach(domain: string, apiKey: string): Promise<Partial<CompanyProfile> | null> {
  try {
    const resp = await fetch(`https://api.rocketreach.co/v2/api/lookupCompany?domain=${domain}`, {
      headers: { 'Api-Key': apiKey },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return {
      name: data.name,
      industry: data.industry,
      employee_count: data.num_employees || data.employee_count,
      description: data.description,
      linkedin_url: data.linkedin_url,
      website: data.website,
      headquarters_city: data.city,
      headquarters_state: data.state,
      headquarters_country: data.country,
      phone: data.phone,
      founded_year: data.founded,
    };
  } catch { return null; }
}

function mergeProfiles(...profiles: (Partial<CompanyProfile> | null)[]): CompanyProfile {
  const result: CompanyProfile = {
    domain: '', name: null, industry: null, employee_count: null, employee_range: null,
    founded_year: null, description: null, linkedin_url: null, website: null,
    headquarters_city: null, headquarters_state: null, headquarters_country: null,
    technologies: [], annual_revenue: null, phone: null, logo_url: null, source_providers: [],
  };

  for (const p of profiles) {
    if (!p) continue;
    for (const [key, val] of Object.entries(p)) {
      if (val === null || val === undefined) continue;
      if (key === 'technologies' && Array.isArray(val)) {
        result.technologies = [...new Set([...result.technologies, ...val])];
      } else if (key === 'description' && typeof val === 'string') {
        if (!result.description || val.length > result.description.length) {
          result.description = val;
        }
      } else if ((result as any)[key] === null || (result as any)[key] === undefined) {
        (result as any)[key] = val;
      }
    }
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { domains } = await req.json() as { domains: string[] };
    if (!domains?.length) {
      return new Response(JSON.stringify({ success: false, error: 'domains array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apolloKey = Deno.env.get('APOLLO_API_KEY');
    const pdlKey = Deno.env.get('PDL_API_KEY');
    const rrKey = Deno.env.get('ROCKETREACH_API_KEY');

    const results: CompanyProfile[] = [];

    // Process in batches of 5
    for (let i = 0; i < Math.min(domains.length, 50); i += 5) {
      const batch = domains.slice(i, i + 5);
      const batchResults = await Promise.all(batch.map(async (domain) => {
        const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();

        const providers: Array<Promise<Partial<CompanyProfile> | null>> = [];
        const providerNames: string[] = [];

        if (apolloKey) { providers.push(enrichApollo(cleanDomain, apolloKey)); providerNames.push('apollo'); }
        if (pdlKey) { providers.push(enrichPDL(cleanDomain, pdlKey)); providerNames.push('pdl'); }
        if (rrKey) { providers.push(enrichRocketReach(cleanDomain, rrKey)); providerNames.push('rocketreach'); }
        providers.push(enrichClearbit(cleanDomain)); providerNames.push('clearbit');

        const settled = await Promise.allSettled(providers);
        const profiles = settled.map((s, idx) => {
          if (s.status === 'fulfilled' && s.value) return s.value;
          return null;
        });

        const merged = mergeProfiles(...profiles);
        merged.domain = cleanDomain;
        merged.source_providers = providerNames.filter((_, idx) => {
          const s = settled[idx];
          return s.status === 'fulfilled' && s.value !== null;
        });

        return merged;
      }));

      results.push(...batchResults);
    }

    return new Response(JSON.stringify({
      success: true,
      companies: results,
      total: results.length,
      resolved: results.filter(r => r.name !== null).length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[DomainToCompany] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
