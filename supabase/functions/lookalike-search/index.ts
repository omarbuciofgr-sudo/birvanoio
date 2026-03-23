const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface LookalikeInput {
  domain: string;
  company_name?: string;
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
  similarity_score: number;
  source_provider: string;
}

// Step 1: Enrich the seed company to get firmographic attributes
async function enrichSeed(domain: string, apolloKey?: string, pdlKey?: string): Promise<{
  industry: string | null;
  employee_count: number | null;
  technologies: string[];
  country: string | null;
  keywords: string[];
  name: string | null;
}> {
  const seed: { industry: string | null; employee_count: number | null; technologies: string[]; country: string | null; keywords: string[]; name: string | null } = {
    industry: null, employee_count: null, technologies: [], country: null, keywords: [], name: null,
  };

  // Apollo enrichment
  if (apolloKey) {
    try {
      const resp = await fetch('https://api.apollo.io/api/v1/organizations/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apolloKey },
        body: JSON.stringify({ domain }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const org = data.organization;
        if (org) {
          seed.industry = org.industry;
          seed.employee_count = org.estimated_num_employees;
          seed.technologies = org.current_technologies || [];
          seed.country = org.country;
          seed.keywords = org.keywords || [];
          seed.name = org.name;
        }
      }
    } catch {}
  }

  // PDL fallback
  if (!seed.name && pdlKey) {
    try {
      const resp = await fetch(`https://api.peopledatalabs.com/v5/company/enrich?website=${domain}`, {
        headers: { 'X-Api-Key': pdlKey },
      });
      if (resp.ok) {
        const data = await resp.json();
        seed.industry = seed.industry || data.industry;
        seed.employee_count = seed.employee_count || data.employee_count;
        seed.technologies = [...new Set([...seed.technologies, ...(data.tags || [])])];
        seed.country = seed.country || data.location?.country;
        seed.name = seed.name || data.name;
      }
    } catch {}
  }

  return seed;
}

// Step 2: Search for similar companies based on seed attributes
async function searchApolloLookalikes(seed: any, inputDomain: string, limit: number, apiKey: string): Promise<CompanyResult[]> {
  try {
    const body: Record<string, unknown> = {
      page: 1,
      per_page: Math.min(limit * 2, 100), // over-fetch to filter out seed
    };

    if (seed.industry) {
      body.q_organization_keyword_tags = [seed.industry];
      body.q_keywords = seed.industry;
    }

    // Match employee size range
    if (seed.employee_count) {
      const count = seed.employee_count;
      let range: string;
      if (count <= 10) range = '1,10';
      else if (count <= 50) range = '11,50';
      else if (count <= 200) range = '51,200';
      else if (count <= 500) range = '201,500';
      else if (count <= 1000) range = '501,1000';
      else if (count <= 5000) range = '1001,5000';
      else range = '5001,10000';
      body.organization_num_employees_ranges = [range];
    }

    if (seed.country) body.organization_locations = [seed.country];

    const resp = await fetch('https://api.apollo.io/api/v1/mixed_companies/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify(body),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.organizations || data.accounts || [])
      .filter((o: any) => {
        const d = (o.primary_domain || o.domain || '').toLowerCase();
        return d && d !== inputDomain.toLowerCase();
      })
      .map((o: any) => ({
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
        technologies: o.current_technologies || [],
        similarity_score: 0,
        source_provider: 'apollo',
      }));
  } catch { return []; }
}

async function searchPDLLookalikes(seed: any, inputDomain: string, limit: number, apiKey: string): Promise<CompanyResult[]> {
  try {
    const sqlParts: string[] = [];
    if (seed.industry) sqlParts.push(`industry = '${seed.industry}'`);
    if (seed.employee_count) {
      const min = Math.floor(seed.employee_count * 0.3);
      const max = Math.ceil(seed.employee_count * 3);
      sqlParts.push(`employee_count >= ${min} AND employee_count <= ${max}`);
    }
    if (seed.country) sqlParts.push(`location.country = '${seed.country}'`);
    sqlParts.push(`website != '${inputDomain}'`);

    const resp = await fetch('https://api.peopledatalabs.com/v5/company/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        size: Math.min(limit * 2, 100),
        sql: `SELECT * FROM company WHERE ${sqlParts.join(' AND ')}`,
      }),
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
      similarity_score: 0,
      source_provider: 'pdl',
    }));
  } catch { return []; }
}

// Score similarity based on firmographic attributes
function scoreSimilarity(company: CompanyResult, seed: any): number {
  let score = 0;
  let weights = 0;

  // Industry match (weight: 30)
  if (seed.industry && company.industry) {
    const seedInd = seed.industry.toLowerCase();
    const compInd = company.industry.toLowerCase();
    if (compInd === seedInd) { score += 30; }
    else if (compInd.includes(seedInd) || seedInd.includes(compInd)) { score += 20; }
    weights += 30;
  }

  // Employee size proximity (weight: 25)
  if (seed.employee_count && company.employee_count) {
    const ratio = Math.min(seed.employee_count, company.employee_count) /
                  Math.max(seed.employee_count, company.employee_count);
    score += ratio * 25;
    weights += 25;
  }

  // Technology overlap (weight: 25)
  if (seed.technologies?.length && company.technologies?.length) {
    const seedTech = new Set(seed.technologies.map((t: string) => t.toLowerCase()));
    const overlap = company.technologies.filter(t => seedTech.has(t.toLowerCase())).length;
    const maxPossible = Math.min(seedTech.size, company.technologies.length);
    if (maxPossible > 0) {
      score += (overlap / maxPossible) * 25;
    }
    weights += 25;
  }

  // Location match (weight: 20)
  if (seed.country && company.headquarters_country) {
    if (company.headquarters_country.toLowerCase() === seed.country.toLowerCase()) {
      score += 20;
    }
    weights += 20;
  }

  return weights > 0 ? Math.round((score / weights) * 100) : 50;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const input: LookalikeInput = await req.json();
    if (!input.domain) {
      return new Response(JSON.stringify({ success: false, error: 'domain required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const cleanDomain = input.domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();
    const limit = input.limit || 25;

    const apolloKey = Deno.env.get('APOLLO_API_KEY');
    const pdlKey = Deno.env.get('PDL_API_KEY');

    // Step 1: Enrich seed company
    console.log(`[Lookalike] Enriching seed: ${cleanDomain}`);
    const seed = await enrichSeed(cleanDomain, apolloKey || undefined, pdlKey || undefined);

    if (!seed.industry && !seed.name) {
      return new Response(JSON.stringify({
        success: false,
        error: `Could not resolve company information for domain: ${cleanDomain}`,
      }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[Lookalike] Seed resolved: ${seed.name}, ${seed.industry}, ${seed.employee_count} employees`);

    // Step 2: Search for lookalikes in parallel
    const searchPromises: Promise<CompanyResult[]>[] = [];
    if (apolloKey) searchPromises.push(searchApolloLookalikes(seed, cleanDomain, limit, apolloKey));
    if (pdlKey) searchPromises.push(searchPDLLookalikes(seed, cleanDomain, limit, pdlKey));

    const allResults = await Promise.allSettled(searchPromises);
    const mergedMap = new Map<string, CompanyResult>();

    for (const settled of allResults) {
      if (settled.status !== 'fulfilled') continue;
      for (const company of settled.value) {
        if (!company.domain) continue;
        const key = company.domain.toLowerCase().replace(/^www\./, '');
        if (key === cleanDomain) continue;
        const existing = mergedMap.get(key);
        if (existing) {
          // Merge
          for (const [k, v] of Object.entries(company)) {
            if (v && !(existing as any)[k]) (existing as any)[k] = v;
          }
          existing.technologies = [...new Set([...existing.technologies, ...company.technologies])];
          existing.source_provider = `${existing.source_provider}+${company.source_provider}`;
        } else {
          mergedMap.set(key, company);
        }
      }
    }

    // Step 3: Score and rank
    const scored = Array.from(mergedMap.values()).map(c => {
      c.similarity_score = scoreSimilarity(c, seed);
      return c;
    });
    scored.sort((a, b) => b.similarity_score - a.similarity_score);

    return new Response(JSON.stringify({
      success: true,
      seed_company: { name: seed.name, domain: cleanDomain, industry: seed.industry, employee_count: seed.employee_count },
      companies: scored.slice(0, limit),
      total: scored.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[LookalikeSearch] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
