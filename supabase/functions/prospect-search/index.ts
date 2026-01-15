import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Prospect Search - ZoomInfo-style lead prospecting
 * 
 * This combines Apollo.io's people database with Firecrawl web search
 * to find decision-makers in any niche and location.
 * 
 * Search Types:
 * 1. "apollo_search" - Search Apollo's database directly by industry, location, titles
 * 2. "web_discovery" - Use Google search + enrichment to find companies then contacts
 * 3. "hybrid" - Both combined for maximum coverage
 */

interface ProspectSearchParams {
  // What niche/industry
  industry?: string;         // e.g., "Roofing", "Real Estate", "Software"
  keywords?: string[];       // Additional keywords for search
  
  // Where
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  
  // Who (target contact)
  targetTitles?: string[];   // e.g., ["Owner", "CEO", "Founder"]
  seniorityLevels?: string[]; // e.g., ["owner", "c_suite", "vp", "director"]
  departments?: string[];    // e.g., ["executive", "sales", "operations"]
  
  // Company filters
  employeeCountMin?: number;
  employeeCountMax?: number;
  revenueMin?: number;
  revenueMax?: number;
  
  // Search settings
  searchType?: 'apollo_search' | 'web_discovery' | 'hybrid';
  limit?: number;
  enrichWebResults?: boolean; // Auto-enrich web search results with Apollo
}

interface ProspectResult {
  // Contact
  full_name: string | null;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  direct_phone: string | null;
  job_title: string | null;
  seniority_level: string | null;
  department: string | null;
  linkedin_url: string | null;
  
  // Company
  company_name: string | null;
  company_domain: string | null;
  company_website: string | null;
  company_linkedin_url: string | null;
  industry: string | null;
  employee_count: number | null;
  annual_revenue: number | null;
  founded_year: number | null;
  headquarters_city: string | null;
  headquarters_state: string | null;
  
  // Source
  source: string;
  confidence_score: number;
  enrichment_providers: string[];
}

// Default decision-maker titles by niche
const DECISION_MAKER_TITLES: Record<string, string[]> = {
  default: ['owner', 'ceo', 'founder', 'president', 'principal', 'partner', 'managing director'],
  roofing: ['owner', 'president', 'general manager', 'estimator', 'sales manager'],
  real_estate: ['broker', 'owner', 'managing broker', 'principal broker', 'team lead'],
  construction: ['owner', 'president', 'project manager', 'general contractor', 'superintendent'],
  hvac: ['owner', 'president', 'service manager', 'general manager'],
  plumbing: ['owner', 'master plumber', 'service manager', 'general manager'],
  electrical: ['owner', 'master electrician', 'service manager', 'project manager'],
  landscaping: ['owner', 'president', 'operations manager', 'general manager'],
  insurance: ['agency owner', 'principal agent', 'managing partner', 'agency president'],
  software: ['ceo', 'cto', 'founder', 'vp of engineering', 'head of product'],
  saas: ['ceo', 'cto', 'founder', 'vp of sales', 'head of growth'],
  law_firm: ['managing partner', 'senior partner', 'founding partner', 'practice leader'],
  medical: ['practice owner', 'medical director', 'office manager', 'practice manager'],
  dental: ['practice owner', 'dentist', 'office manager'],
  restaurant: ['owner', 'general manager', 'managing partner'],
  retail: ['owner', 'store manager', 'regional manager', 'district manager'],
};

// Seniority level mappings
const SENIORITY_KEYWORDS: Record<string, string[]> = {
  owner: ['owner', 'co-owner', 'principal', 'partner', 'proprietor'],
  c_suite: ['ceo', 'cto', 'cfo', 'coo', 'cmo', 'chief'],
  founder: ['founder', 'co-founder', 'founding'],
  vp: ['vp', 'vice president', 'svp', 'evp'],
  director: ['director', 'head of'],
  manager: ['manager', 'lead', 'supervisor'],
};

function getTitlesByNiche(niche: string): string[] {
  const normalizedNiche = niche.toLowerCase().replace(/[^a-z_]/g, '_');
  return DECISION_MAKER_TITLES[normalizedNiche] || DECISION_MAKER_TITLES.default;
}

function mapSeniorityLevel(title: string | null): string {
  if (!title) return 'unknown';
  const t = title.toLowerCase();
  
  for (const [level, keywords] of Object.entries(SENIORITY_KEYWORDS)) {
    if (keywords.some(kw => t.includes(kw))) return level;
  }
  return 'individual_contributor';
}

// Search Apollo's people database directly
async function searchApolloDatabase(
  params: ProspectSearchParams,
  apolloApiKey: string
): Promise<ProspectResult[]> {
  const results: ProspectResult[] = [];
  
  try {
    // Build Apollo search query
    const searchBody: Record<string, unknown> = {
      api_key: apolloApiKey,
      page: 1,
      per_page: Math.min(params.limit || 25, 100),
    };
    
    // Industry/Keywords
    if (params.industry) {
      searchBody.organization_industry_tag_ids = [params.industry.toLowerCase()];
    }
    
    // Location
    if (params.location) {
      if (params.location.city) {
        searchBody.person_locations = [params.location.city];
      }
      if (params.location.state) {
        searchBody.organization_locations = [`${params.location.city || ''}, ${params.location.state}`.trim()];
      }
      if (params.location.country) {
        searchBody.person_country_codes = [params.location.country === 'USA' ? 'US' : params.location.country];
      }
    }
    
    // Target titles
    const titles = params.targetTitles || getTitlesByNiche(params.industry || 'default');
    searchBody.person_titles = titles;
    
    // Seniority levels
    if (params.seniorityLevels?.length) {
      searchBody.person_seniorities = params.seniorityLevels;
    }
    
    // Company size
    if (params.employeeCountMin || params.employeeCountMax) {
      searchBody.organization_num_employees_ranges = [];
      const ranges = [];
      if (params.employeeCountMin && params.employeeCountMax) {
        ranges.push(`${params.employeeCountMin},${params.employeeCountMax}`);
      } else if (params.employeeCountMax && params.employeeCountMax <= 10) {
        ranges.push('1,10');
      } else if (params.employeeCountMax && params.employeeCountMax <= 50) {
        ranges.push('1,10', '11,50');
      }
      searchBody.organization_num_employees_ranges = ranges;
    }
    
    console.log('Apollo search query:', JSON.stringify(searchBody, null, 2));
    
    const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(searchBody),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Apollo API error:', data);
      return results;
    }
    
    console.log(`Apollo returned ${data.people?.length || 0} people`);
    
    if (data.people?.length) {
      for (const person of data.people) {
        const org = person.organization || {};
        const directPhone = person.phone_numbers?.find((p: any) => p.type === 'direct_dial')?.number;
        const mobilePhone = person.phone_numbers?.find((p: any) => p.type === 'mobile')?.number;
        
        results.push({
          full_name: person.name || null,
          email: person.email || null,
          phone: person.phone_numbers?.[0]?.number || null,
          mobile_phone: mobilePhone || null,
          direct_phone: directPhone || null,
          job_title: person.title || null,
          seniority_level: person.seniority || mapSeniorityLevel(person.title),
          department: person.departments?.[0] || null,
          linkedin_url: person.linkedin_url || null,
          company_name: org.name || null,
          company_domain: org.primary_domain || null,
          company_website: org.website_url || null,
          company_linkedin_url: org.linkedin_url || null,
          industry: org.industry || null,
          employee_count: org.estimated_num_employees || null,
          annual_revenue: org.annual_revenue || null,
          founded_year: org.founded_year || null,
          headquarters_city: org.city || null,
          headquarters_state: org.state || null,
          source: 'apollo_database',
          confidence_score: calculateConfidence(person, org),
          enrichment_providers: ['apollo'],
        });
      }
    }
  } catch (error) {
    console.error('Apollo database search error:', error);
  }
  
  return results;
}

// Search via web discovery (Google search + enrichment)
async function searchWebDiscovery(
  params: ProspectSearchParams,
  firecrawlApiKey: string,
  apolloApiKey?: string
): Promise<ProspectResult[]> {
  const results: ProspectResult[] = [];
  
  try {
    // Build search query
    const queryParts: string[] = [];
    
    if (params.industry) {
      queryParts.push(params.industry);
    }
    if (params.keywords?.length) {
      queryParts.push(...params.keywords);
    }
    if (params.location?.city) {
      queryParts.push(params.location.city);
    }
    if (params.location?.state) {
      queryParts.push(params.location.state);
    }
    
    // Add decision-maker targeting keywords
    const titles = params.targetTitles || getTitlesByNiche(params.industry || 'default');
    if (titles.length && Math.random() > 0.5) {
      // Sometimes include title in search for variety
      queryParts.push(titles[0]);
    }
    
    queryParts.push('companies', 'contact');
    
    const searchQuery = queryParts.join(' ');
    console.log('Web search query:', searchQuery);
    
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: Math.min(params.limit || 20, 50),
        country: params.location?.country === 'USA' ? 'us' : params.location?.country?.toLowerCase(),
        scrapeOptions: {
          formats: ['markdown', 'links'],
        },
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      console.error('Firecrawl search error:', data);
      return results;
    }
    
    console.log(`Web search returned ${data.data?.length || 0} results`);
    
    // Process each search result
    for (const result of (data.data || [])) {
      const url = result.url;
      const markdown = result.markdown || '';
      const domain = extractDomain(url);
      
      if (!domain) continue;
      
      // Extract basic info from page
      const extractedEmails = extractEmails(markdown);
      const extractedPhones = extractPhones(markdown);
      const companyName = extractCompanyName(markdown, domain);
      
      let prospect: ProspectResult = {
        full_name: null,
        email: extractedEmails[0] || null,
        phone: extractedPhones[0] || null,
        mobile_phone: null,
        direct_phone: null,
        job_title: null,
        seniority_level: null,
        department: null,
        linkedin_url: null,
        company_name: companyName,
        company_domain: domain,
        company_website: `https://${domain}`,
        company_linkedin_url: null,
        industry: params.industry || null,
        employee_count: null,
        annual_revenue: null,
        founded_year: null,
        headquarters_city: params.location?.city || null,
        headquarters_state: params.location?.state || null,
        source: 'web_discovery',
        confidence_score: 30,
        enrichment_providers: ['firecrawl'],
      };
      
      // Enrich with Apollo if available
      if (apolloApiKey && params.enrichWebResults !== false) {
        const enriched = await enrichWithApollo(domain, apolloApiKey, titles);
        if (enriched) {
          prospect = {
            ...prospect,
            ...enriched,
            company_domain: domain,
            company_website: `https://${domain}`,
            source: 'web_discovery_enriched',
            confidence_score: enriched.email ? 80 : 50,
            enrichment_providers: ['firecrawl', 'apollo'],
          };
        }
      }
      
      results.push(prospect);
    }
  } catch (error) {
    console.error('Web discovery error:', error);
  }
  
  return results;
}

// Enrich a domain using Apollo
async function enrichWithApollo(
  domain: string,
  apolloApiKey: string,
  targetTitles: string[]
): Promise<Partial<ProspectResult> | null> {
  try {
    const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({
        api_key: apolloApiKey,
        q_organization_domains: domain,
        person_titles: targetTitles,
        page: 1,
        per_page: 5,
      }),
    });
    
    const data = await response.json();
    
    if (data.people?.length) {
      // Find best match by title priority
      const priorityTitles = ['owner', 'ceo', 'founder', 'president', 'partner'];
      let bestMatch = data.people[0];
      
      for (const person of data.people) {
        const title = (person.title || '').toLowerCase();
        if (priorityTitles.some(pt => title.includes(pt))) {
          bestMatch = person;
          break;
        }
      }
      
      const org = bestMatch.organization || {};
      const directPhone = bestMatch.phone_numbers?.find((p: any) => p.type === 'direct_dial')?.number;
      const mobilePhone = bestMatch.phone_numbers?.find((p: any) => p.type === 'mobile')?.number;
      
      return {
        full_name: bestMatch.name,
        email: bestMatch.email,
        phone: bestMatch.phone_numbers?.[0]?.number,
        mobile_phone: mobilePhone,
        direct_phone: directPhone,
        job_title: bestMatch.title,
        seniority_level: bestMatch.seniority || mapSeniorityLevel(bestMatch.title),
        department: bestMatch.departments?.[0],
        linkedin_url: bestMatch.linkedin_url,
        company_name: org.name,
        company_linkedin_url: org.linkedin_url,
        industry: org.industry,
        employee_count: org.estimated_num_employees,
        annual_revenue: org.annual_revenue,
        founded_year: org.founded_year,
        headquarters_city: org.city,
        headquarters_state: org.state,
      };
    }
  } catch (error) {
    console.error('Apollo enrichment error:', error);
  }
  
  return null;
}

// Calculate confidence score based on data completeness
function calculateConfidence(person: any, org: any): number {
  let score = 20; // Base score
  
  if (person.name) score += 10;
  if (person.email) score += 25;
  if (person.phone_numbers?.length) score += 15;
  if (person.title) score += 10;
  if (person.linkedin_url) score += 5;
  if (org?.name) score += 10;
  if (org?.website_url) score += 5;
  
  return Math.min(score, 100);
}

// Extract domain from URL
function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// Extract emails from text
function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  return [...new Set(matches)].filter(email => 
    !email.includes('example.com') &&
    !email.includes('@2x') &&
    !email.endsWith('.png') &&
    !email.endsWith('.jpg')
  );
}

// Extract phone numbers from text
function extractPhones(text: string): string[] {
  const phoneRegex = /(?:\+?1[-.\s]?)?(?:\(\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
  const matches = text.match(phoneRegex) || [];
  return [...new Set(matches.map(p => p.replace(/\D/g, '')))].filter(p => p.length >= 10 && p.length <= 11);
}

// Extract company name from page content
function extractCompanyName(markdown: string, domain: string): string | null {
  // Try to find company name from title patterns
  const patterns = [
    /^#\s*([^|\n]+)/m,  // First H1
    /(?:Welcome to|About)\s+([A-Z][A-Za-z0-9\s&]+(?:LLC|Inc|Corp|Co\.?)?)/i,
    /©\s*\d{4}\s+([A-Z][A-Za-z0-9\s&]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (match?.[1] && match[1].length < 100) {
      return match[1].trim();
    }
  }
  
  // Fall back to domain name
  const domainName = domain.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  return domainName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Deduplicate results by domain/email
function deduplicateResults(results: ProspectResult[]): ProspectResult[] {
  const seen = new Map<string, ProspectResult>();
  
  for (const result of results) {
    const key = result.email || result.company_domain || result.company_name || '';
    if (!key) continue;
    
    const existing = seen.get(key);
    if (!existing || result.confidence_score > existing.confidence_score) {
      seen.set(key, result);
    }
  }
  
  return Array.from(seen.values()).sort((a, b) => b.confidence_score - a.confidence_score);
}

// Validate leads using ZeroBounce and Twilio
async function validateProspects(
  prospects: ProspectResult[],
  zerobounceApiKey?: string,
  twilioAccountSid?: string,
  twilioAuthToken?: string
): Promise<ProspectResult[]> {
  const validated = [...prospects];
  
  for (const prospect of validated) {
    // Email validation
    if (prospect.email && zerobounceApiKey) {
      try {
        const response = await fetch(
          `https://api.zerobounce.net/v2/validate?api_key=${zerobounceApiKey}&email=${encodeURIComponent(prospect.email)}`
        );
        const data = await response.json();
        
        if (data.status === 'valid') {
          prospect.confidence_score = Math.min(prospect.confidence_score + 10, 100);
          prospect.enrichment_providers.push('zerobounce_verified');
        } else if (data.status === 'invalid') {
          prospect.email = null;
          prospect.confidence_score = Math.max(prospect.confidence_score - 15, 0);
        }
      } catch (error) {
        console.error('ZeroBounce validation error:', error);
      }
    }
    
    // Phone validation
    if (prospect.phone && twilioAccountSid && twilioAuthToken) {
      try {
        const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
        const normalized = prospect.phone.replace(/\D/g, '');
        const e164 = normalized.length === 10 ? `+1${normalized}` : `+${normalized}`;
        
        const response = await fetch(
          `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164)}?Fields=line_type_intelligence`,
          { headers: { 'Authorization': `Basic ${authHeader}` } }
        );
        
        if (response.ok) {
          const data = await response.json();
          prospect.phone = data.phone_number || prospect.phone;
          prospect.confidence_score = Math.min(prospect.confidence_score + 10, 100);
          prospect.enrichment_providers.push('twilio_verified');
          
          // Prefer mobile phones
          if (data.line_type_intelligence?.type === 'mobile') {
            prospect.mobile_phone = prospect.phone;
          }
        } else if (response.status === 404) {
          prospect.phone = null;
          prospect.confidence_score = Math.max(prospect.confidence_score - 10, 0);
        }
      } catch (error) {
        console.error('Twilio validation error:', error);
      }
    }
  }
  
  return validated;
}

// Call data waterfall for enhanced enrichment
async function waterfallEnrich(
  domain: string,
  targetTitles: string[],
  supabaseUrl: string,
  supabaseKey: string
): Promise<Partial<ProspectResult> | null> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/data-waterfall-enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        domain,
        target_titles: targetTitles,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data) {
        return data.data;
      }
    }
  } catch (error) {
    console.error('Waterfall enrich error:', error);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check - require valid JWT token
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token for authentication
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Server-side admin role verification using service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError) {
      console.error('Role check error:', roleError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to verify permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!roleData) {
      console.warn(`Non-admin user ${user.id} attempted prospect search`);
      return new Response(
        JSON.stringify({ success: false, error: 'Administrator access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin user ${user.id} executing prospect search`);

    // Get API keys
    const apolloApiKey = Deno.env.get('APOLLO_API_KEY');
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const zerobounceApiKey = Deno.env.get('ZEROBOUNCE_API_KEY');
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const supabaseKey = supabaseAnonKey;
    
    if (!apolloApiKey && !firecrawlApiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No search providers configured. Please configure Apollo or Firecrawl API keys.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const params: ProspectSearchParams & { 
      validate_contacts?: boolean;
      use_waterfall?: boolean;
    } = await req.json();
    console.log('Prospect search params:', JSON.stringify(params, null, 2));
    
    // Validate required params
    if (!params.industry && !params.keywords?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'Industry or keywords required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const searchType = params.searchType || 'hybrid';
    let allResults: ProspectResult[] = [];
    
    // Execute searches based on type
    if (searchType === 'apollo_search' || searchType === 'hybrid') {
      if (apolloApiKey) {
        const apolloResults = await searchApolloDatabase(params, apolloApiKey);
        allResults.push(...apolloResults);
        console.log(`Apollo search found ${apolloResults.length} prospects`);
      }
    }
    
    if (searchType === 'web_discovery' || searchType === 'hybrid') {
      if (firecrawlApiKey) {
        const webResults = await searchWebDiscovery(params, firecrawlApiKey, apolloApiKey);
        allResults.push(...webResults);
        console.log(`Web discovery found ${webResults.length} prospects`);
      }
    }
    
    // Use waterfall enrichment for prospects missing data
    if (params.use_waterfall !== false && supabaseUrl && supabaseKey) {
      for (let i = 0; i < Math.min(allResults.length, 10); i++) {
        const prospect = allResults[i];
        if (!prospect.email && prospect.company_domain) {
          console.log(`Waterfall enriching ${prospect.company_domain}...`);
          const titles = params.targetTitles || getTitlesByNiche(params.industry || 'default');
          const enriched = await waterfallEnrich(prospect.company_domain, titles, supabaseUrl, supabaseKey);
          if (enriched) {
            if (enriched.full_name) prospect.full_name = enriched.full_name as string;
            if (enriched.email) prospect.email = enriched.email as string;
            if (enriched.phone) prospect.phone = enriched.phone as string;
            if (enriched.mobile_phone) prospect.mobile_phone = enriched.mobile_phone as string;
            if (enriched.job_title) prospect.job_title = enriched.job_title as string;
            if (enriched.linkedin_url) prospect.linkedin_url = enriched.linkedin_url as string;
            prospect.source = 'waterfall_enriched';
            prospect.confidence_score = Math.min(prospect.confidence_score + 20, 100);
            if ((enriched as any).providers_used) {
              prospect.enrichment_providers = [...prospect.enrichment_providers, ...((enriched as any).providers_used as string[])];
            }
          }
        }
      }
    }
    
    // Validate contacts if requested
    if (params.validate_contacts !== false && (zerobounceApiKey || (twilioAccountSid && twilioAuthToken))) {
      console.log('Validating contacts...');
      allResults = await validateProspects(
        allResults,
        zerobounceApiKey,
        twilioAccountSid,
        twilioAuthToken
      );
    }
    
    // Deduplicate and sort by confidence
    const finalResults = deduplicateResults(allResults);
    
    // Apply limit
    const limit = params.limit || 25;
    const limitedResults = finalResults.slice(0, limit);
    
    console.log(`Returning ${limitedResults.length} prospects (${allResults.length} total before dedup)`);
    
    return new Response(
      JSON.stringify({
        success: true,
        data: limitedResults,
        total: limitedResults.length,
        search_params: {
          industry: params.industry,
          location: params.location,
          target_titles: params.targetTitles || getTitlesByNiche(params.industry || 'default'),
          search_type: searchType,
        },
        enrichment_providers: [...new Set(limitedResults.flatMap(r => r.enrichment_providers))],
        validation_enabled: {
          email: !!zerobounceApiKey,
          phone: !!(twilioAccountSid && twilioAuthToken),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Prospect search error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Search failed. Please check your parameters and try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
