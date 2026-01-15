import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const enrichRequestSchema = z.object({
  lead_id: z.string().uuid().optional(),
  lead_ids: z.array(z.string().uuid()).max(50).optional(),
  enrich_company: z.boolean().optional().default(true),
}).refine(
  data => data.lead_id || (data.lead_ids && data.lead_ids.length > 0),
  { message: 'Either lead_id or lead_ids must be provided' }
);

interface EnrichmentResult {
  full_name?: string;
  email?: string;
  phone?: string;
  direct_phone?: string;
  mobile_phone?: string;
  company_name?: string;
  job_title?: string;
  seniority_level?: string;
  department?: string;
  linkedin_url?: string;
  // Company data
  company_linkedin_url?: string;
  company_website?: string;
  employee_count?: number;
  employee_range?: string;
  annual_revenue?: number;
  revenue_range?: string;
  funding_total?: number;
  funding_stage?: string;
  founded_year?: number;
  industry?: string;
  company_description?: string;
  technologies?: string[];
  headquarters_city?: string;
  headquarters_state?: string;
  headquarters_country?: string;
  provider: string;
  fields_enriched: string[];
}

// Generate LinkedIn search URL (safe, does not scrape)
function generateLinkedInSearchUrl(companyName?: string, name?: string, jobTitle?: string): string {
  const parts: string[] = [];
  if (name) parts.push(name);
  if (companyName) parts.push(companyName);
  if (jobTitle) parts.push(jobTitle);
  
  const query = parts.join(' ');
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
}

// Map Apollo seniority levels
function mapSeniorityLevel(title: string | null): string {
  if (!title) return 'unknown';
  const t = title.toLowerCase();
  
  if (t.includes('ceo') || t.includes('cto') || t.includes('cfo') || t.includes('coo') || t.includes('chief')) return 'c_suite';
  if (t.includes('vp') || t.includes('vice president')) return 'vp';
  if (t.includes('director')) return 'director';
  if (t.includes('senior') || t.includes('sr.')) return 'senior';
  if (t.includes('manager')) return 'manager';
  if (t.includes('lead')) return 'lead';
  if (t.includes('junior') || t.includes('jr.') || t.includes('associate')) return 'entry';
  return 'individual_contributor';
}

// Map department from title
function mapDepartment(title: string | null): string {
  if (!title) return 'unknown';
  const t = title.toLowerCase();
  
  if (t.includes('sales') || t.includes('account executive') || t.includes('business development')) return 'sales';
  if (t.includes('marketing') || t.includes('growth') || t.includes('brand')) return 'marketing';
  if (t.includes('engineer') || t.includes('developer') || t.includes('tech') || t.includes('software')) return 'engineering';
  if (t.includes('product') || t.includes('pm')) return 'product';
  if (t.includes('hr') || t.includes('human resources') || t.includes('people')) return 'hr';
  if (t.includes('finance') || t.includes('accounting') || t.includes('cfo')) return 'finance';
  if (t.includes('operations') || t.includes('ops')) return 'operations';
  if (t.includes('legal') || t.includes('counsel')) return 'legal';
  if (t.includes('customer success') || t.includes('support')) return 'customer_success';
  if (t.includes('ceo') || t.includes('founder') || t.includes('owner')) return 'executive';
  return 'other';
}

// Apollo.io API - Enhanced Domain/Company enrichment
async function enrichWithApollo(
  domain: string,
  name?: string | null,
  apiKey?: string
): Promise<EnrichmentResult | null> {
  if (!apiKey) return null;

  try {
    // Domain search to find people
    const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({
        api_key: apiKey,
        q_organization_domains: domain,
        page: 1,
        per_page: 10, // Get more people for better selection
      }),
    });

    const data = await response.json();
    
    if (data.people && data.people.length > 0) {
      // Find best match (prefer owner/founder/CEO, or first person)
      const priorityTitles = ['owner', 'ceo', 'founder', 'president', 'director', 'manager'];
      let bestMatch = data.people[0];
      
      for (const person of data.people) {
        const title = (person.title || '').toLowerCase();
        if (priorityTitles.some(pt => title.includes(pt))) {
          bestMatch = person;
          break;
        }
      }

      const fieldsEnriched: string[] = [];
      const org = bestMatch.organization || {};
      
      if (bestMatch.name) fieldsEnriched.push('full_name');
      if (bestMatch.email) fieldsEnriched.push('email');
      if (bestMatch.phone_numbers?.[0]) fieldsEnriched.push('phone');
      if (org.name) fieldsEnriched.push('company_name');
      if (bestMatch.title) {
        fieldsEnriched.push('job_title');
        fieldsEnriched.push('seniority_level');
        fieldsEnriched.push('department');
      }
      if (bestMatch.linkedin_url) fieldsEnriched.push('linkedin_url');
      if (org.estimated_num_employees) fieldsEnriched.push('employee_count');
      if (org.annual_revenue) fieldsEnriched.push('annual_revenue');
      if (org.founded_year) fieldsEnriched.push('founded_year');
      if (org.industry) fieldsEnriched.push('industry');
      if (org.linkedin_url) fieldsEnriched.push('company_linkedin_url');
      if (org.short_description) fieldsEnriched.push('company_description');
      if (org.technologies?.length) fieldsEnriched.push('technologies');

      // Extract direct/mobile phones
      const directPhone = bestMatch.phone_numbers?.find((p: any) => p.type === 'direct_dial')?.number;
      const mobilePhone = bestMatch.phone_numbers?.find((p: any) => p.type === 'mobile')?.number;

      return {
        full_name: bestMatch.name,
        email: bestMatch.email,
        phone: bestMatch.phone_numbers?.[0]?.number,
        direct_phone: directPhone,
        mobile_phone: mobilePhone,
        company_name: org.name,
        job_title: bestMatch.title,
        seniority_level: bestMatch.seniority || mapSeniorityLevel(bestMatch.title),
        department: bestMatch.departments?.[0] || mapDepartment(bestMatch.title),
        linkedin_url: bestMatch.linkedin_url,
        company_linkedin_url: org.linkedin_url,
        company_website: org.website_url,
        employee_count: org.estimated_num_employees,
        employee_range: org.employee_count_range,
        annual_revenue: org.annual_revenue,
        revenue_range: org.revenue_range,
        funding_total: org.total_funding,
        funding_stage: org.latest_funding_stage,
        founded_year: org.founded_year,
        industry: org.industry,
        company_description: org.short_description,
        technologies: org.technologies?.slice(0, 20), // Limit to 20 techs
        headquarters_city: org.city,
        headquarters_state: org.state,
        headquarters_country: org.country,
        provider: 'apollo',
        fields_enriched: fieldsEnriched,
      };
    }

    return null;
  } catch (error) {
    console.error('Apollo enrichment error:', error);
    return null;
  }
}

// Apollo.io API - People Search (find specific person by name)
async function apolloPeopleSearch(
  name: string,
  domain?: string,
  jobTitle?: string,
  apiKey?: string
): Promise<EnrichmentResult | null> {
  if (!apiKey || !name) return null;

  try {
    const searchParams: Record<string, unknown> = {
      api_key: apiKey,
      q_keywords: name,
      page: 1,
      per_page: 5,
    };

    if (domain) {
      searchParams.q_organization_domains = domain;
    }
    if (jobTitle) {
      searchParams.q_person_titles = [jobTitle];
    }

    const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(searchParams),
    });

    const data = await response.json();
    
    if (data.people && data.people.length > 0) {
      const person = data.people[0];
      const org = person.organization || {};
      const fieldsEnriched: string[] = [];
      
      if (person.email) fieldsEnriched.push('email');
      if (person.phone_numbers?.[0]) fieldsEnriched.push('phone');
      if (org.name) fieldsEnriched.push('company_name');
      if (person.title) {
        fieldsEnriched.push('job_title');
        fieldsEnriched.push('seniority_level');
        fieldsEnriched.push('department');
      }
      if (person.linkedin_url) fieldsEnriched.push('linkedin_url');
      if (org.estimated_num_employees) fieldsEnriched.push('employee_count');
      if (org.annual_revenue) fieldsEnriched.push('annual_revenue');

      const directPhone = person.phone_numbers?.find((p: any) => p.type === 'direct_dial')?.number;
      const mobilePhone = person.phone_numbers?.find((p: any) => p.type === 'mobile')?.number;

      return {
        full_name: person.name,
        email: person.email,
        phone: person.phone_numbers?.[0]?.number,
        direct_phone: directPhone,
        mobile_phone: mobilePhone,
        company_name: org.name,
        job_title: person.title,
        seniority_level: person.seniority || mapSeniorityLevel(person.title),
        department: person.departments?.[0] || mapDepartment(person.title),
        linkedin_url: person.linkedin_url,
        company_linkedin_url: org.linkedin_url,
        employee_count: org.estimated_num_employees,
        annual_revenue: org.annual_revenue,
        funding_total: org.total_funding,
        funding_stage: org.latest_funding_stage,
        industry: org.industry,
        provider: 'apollo_people_search',
        fields_enriched: fieldsEnriched,
      };
    }

    return null;
  } catch (error) {
    console.error('Apollo people search error:', error);
    return null;
  }
}

// Apollo.io API - Organization enrichment (company-level data)
async function apolloOrganizationEnrich(
  domain: string,
  apiKey?: string
): Promise<EnrichmentResult | null> {
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.apollo.io/v1/organizations/enrich', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });

    // Apollo org enrich uses query params
    const url = `https://api.apollo.io/v1/organizations/enrich?api_key=${apiKey}&domain=${domain}`;
    const enrichResponse = await fetch(url);
    const data = await enrichResponse.json();
    
    if (data.organization) {
      const org = data.organization;
      const fieldsEnriched: string[] = [];
      
      if (org.name) fieldsEnriched.push('company_name');
      if (org.estimated_num_employees) fieldsEnriched.push('employee_count');
      if (org.annual_revenue) fieldsEnriched.push('annual_revenue');
      if (org.total_funding) fieldsEnriched.push('funding_total');
      if (org.founded_year) fieldsEnriched.push('founded_year');
      if (org.industry) fieldsEnriched.push('industry');
      if (org.linkedin_url) fieldsEnriched.push('company_linkedin_url');
      if (org.technologies?.length) fieldsEnriched.push('technologies');

      return {
        company_name: org.name,
        company_linkedin_url: org.linkedin_url,
        company_website: org.website_url,
        employee_count: org.estimated_num_employees,
        employee_range: org.employee_count_range,
        annual_revenue: org.annual_revenue,
        revenue_range: org.revenue_range,
        funding_total: org.total_funding,
        funding_stage: org.latest_funding_stage,
        founded_year: org.founded_year,
        industry: org.industry,
        company_description: org.short_description,
        technologies: org.technologies?.slice(0, 20),
        headquarters_city: org.city,
        headquarters_state: org.state,
        headquarters_country: org.country,
        provider: 'apollo_org',
        fields_enriched: fieldsEnriched,
      };
    }

    return null;
  } catch (error) {
    console.error('Apollo organization enrichment error:', error);
    return null;
  }
}

// Hunter.io email finder
async function findEmailWithHunter(
  domain: string,
  firstName?: string,
  lastName?: string,
  apiKey?: string
): Promise<EnrichmentResult | null> {
  if (!apiKey) return null;

  try {
    // If we have a name, try to find specific email
    if (firstName && lastName) {
      const response = await fetch(
        `https://api.hunter.io/v2/email-finder?domain=${domain}&first_name=${firstName}&last_name=${lastName}&api_key=${apiKey}`
      );
      const data = await response.json();

      if (data.data?.email) {
        return {
          email: data.data.email,
          provider: 'hunter',
          fields_enriched: ['email'],
        };
      }
    }

    // Fall back to domain search
    const response = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${apiKey}&limit=5`
    );
    const data = await response.json();

    if (data.data?.emails?.[0]) {
      const bestEmail = data.data.emails[0];
      const fieldsEnriched: string[] = ['email'];
      
      const result: EnrichmentResult = {
        email: bestEmail.value,
        provider: 'hunter',
        fields_enriched: fieldsEnriched,
      };

      if (bestEmail.first_name && bestEmail.last_name) {
        result.full_name = `${bestEmail.first_name} ${bestEmail.last_name}`;
        fieldsEnriched.push('full_name');
      }
      if (bestEmail.position) {
        result.job_title = bestEmail.position;
        result.seniority_level = mapSeniorityLevel(bestEmail.position);
        result.department = mapDepartment(bestEmail.position);
        fieldsEnriched.push('job_title', 'seniority_level', 'department');
      }
      if (bestEmail.linkedin) {
        result.linkedin_url = bestEmail.linkedin;
        fieldsEnriched.push('linkedin_url');
      }

      return result;
    }

    return null;
  } catch (error) {
    console.error('Hunter enrichment error:', error);
    return null;
  }
}

// People Data Labs - Person enrichment
async function enrichWithPDL(
  email?: string,
  name?: string,
  domain?: string,
  apiKey?: string
): Promise<EnrichmentResult | null> {
  if (!apiKey) return null;
  if (!email && !name) return null;

  try {
    const params: Record<string, string> = {};
    if (email) params.email = email;
    if (name) params.name = name;
    if (domain) params.company = domain;

    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(
      `https://api.peopledatalabs.com/v5/person/enrich?${queryString}`,
      {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    
    if (data.status === 200 && data.data) {
      const person = data.data;
      const fieldsEnriched: string[] = [];
      
      if (person.full_name) fieldsEnriched.push('full_name');
      if (person.work_email || person.personal_emails?.[0]) fieldsEnriched.push('email');
      if (person.mobile_phone) fieldsEnriched.push('mobile_phone');
      if (person.phone_numbers?.[0]) fieldsEnriched.push('phone');
      if (person.job_title) fieldsEnriched.push('job_title');
      if (person.job_company_name) fieldsEnriched.push('company_name');
      if (person.linkedin_url) fieldsEnriched.push('linkedin_url');
      if (person.job_company_size) fieldsEnriched.push('employee_range');
      if (person.job_company_industry) fieldsEnriched.push('industry');

      return {
        full_name: person.full_name,
        email: person.work_email || person.personal_emails?.[0],
        phone: person.phone_numbers?.[0],
        mobile_phone: person.mobile_phone,
        company_name: person.job_company_name,
        job_title: person.job_title,
        seniority_level: person.job_title_levels?.[0] || mapSeniorityLevel(person.job_title),
        department: person.job_title_sub_role || mapDepartment(person.job_title),
        linkedin_url: person.linkedin_url,
        company_linkedin_url: person.job_company_linkedin_url,
        company_website: person.job_company_website,
        employee_range: person.job_company_size,
        industry: person.job_company_industry,
        headquarters_city: person.job_company_location_locality,
        headquarters_state: person.job_company_location_region,
        headquarters_country: person.job_company_location_country,
        provider: 'pdl',
        fields_enriched: fieldsEnriched,
      };
    }

    return null;
  } catch (error) {
    console.error('PDL enrichment error:', error);
    return null;
  }
}

// People Data Labs - Company enrichment
async function enrichCompanyWithPDL(
  domain: string,
  apiKey?: string
): Promise<EnrichmentResult | null> {
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://api.peopledatalabs.com/v5/company/enrich?website=${domain}`,
      {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    
    if (data.status === 200 && data.data) {
      const company = data.data;
      const fieldsEnriched: string[] = [];
      
      if (company.name) fieldsEnriched.push('company_name');
      if (company.employee_count) fieldsEnriched.push('employee_count');
      if (company.inferred_revenue) fieldsEnriched.push('annual_revenue');
      if (company.total_funding_raised) fieldsEnriched.push('funding_total');
      if (company.founded) fieldsEnriched.push('founded_year');
      if (company.industry) fieldsEnriched.push('industry');
      if (company.linkedin_url) fieldsEnriched.push('company_linkedin_url');
      if (company.tags?.length) fieldsEnriched.push('technologies');

      return {
        company_name: company.name,
        company_linkedin_url: company.linkedin_url,
        company_website: company.website,
        employee_count: company.employee_count,
        employee_range: company.size,
        annual_revenue: company.inferred_revenue,
        funding_total: company.total_funding_raised,
        funding_stage: company.latest_funding_stage,
        founded_year: company.founded,
        industry: company.industry,
        company_description: company.summary,
        technologies: company.tags?.slice(0, 20),
        headquarters_city: company.location?.locality,
        headquarters_state: company.location?.region,
        headquarters_country: company.location?.country,
        provider: 'pdl_company',
        fields_enriched: fieldsEnriched,
      };
    }

    return null;
  } catch (error) {
    console.error('PDL company enrichment error:', error);
    return null;
  }
}

// Clearbit company enrichment
async function enrichWithClearbit(
  domain: string,
  apiKey?: string
): Promise<EnrichmentResult | null> {
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://company.clearbit.com/v2/companies/find?domain=${domain}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const fieldsEnriched: string[] = [];

    if (data.name) fieldsEnriched.push('company_name');
    if (data.metrics?.employees) fieldsEnriched.push('employee_count');
    if (data.metrics?.estimatedAnnualRevenue) fieldsEnriched.push('revenue_range');
    if (data.metrics?.raised) fieldsEnriched.push('funding_total');
    if (data.foundedYear) fieldsEnriched.push('founded_year');
    if (data.category?.industry) fieldsEnriched.push('industry');
    if (data.linkedin?.handle) fieldsEnriched.push('company_linkedin_url');
    if (data.tech?.length) fieldsEnriched.push('technologies');

    return {
      company_name: data.name,
      company_linkedin_url: data.linkedin?.handle ? `https://linkedin.com/company/${data.linkedin.handle}` : undefined,
      company_website: data.domain,
      employee_count: data.metrics?.employees,
      employee_range: data.metrics?.employeesRange,
      revenue_range: data.metrics?.estimatedAnnualRevenue,
      funding_total: data.metrics?.raised,
      founded_year: data.foundedYear,
      industry: data.category?.industry,
      company_description: data.description,
      technologies: data.tech?.slice(0, 20),
      headquarters_city: data.geo?.city,
      headquarters_state: data.geo?.state,
      headquarters_country: data.geo?.country,
      provider: 'clearbit',
      fields_enriched: fieldsEnriched,
    };
  } catch (error) {
    console.error('Clearbit enrichment error:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const apolloApiKey = Deno.env.get('APOLLO_API_KEY');
  const hunterApiKey = Deno.env.get('HUNTER_API_KEY');
  const clearbitApiKey = Deno.env.get('CLEARBIT_API_KEY');
  const pdlApiKey = Deno.env.get('PDL_API_KEY');

  // Authentication check
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: userError } = await authSupabase.auth.getUser();
  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid authentication' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const userId = user.id;

  // Check if user has admin role
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: hasAdminRole } = await supabase.rpc('has_role', { 
    _user_id: userId, 
    _role: 'admin' 
  });

  if (!hasAdminRole) {
    return new Response(
      JSON.stringify({ error: 'Admin access required' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Parse and validate input
    const body = await req.json().catch(() => ({}));
    const parseResult = enrichRequestSchema.safeParse(body);
    
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid request format',
          validation_errors: parseResult.error.errors.map(e => e.message)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { lead_id, lead_ids, enrich_company } = parseResult.data;
    const idsToProcess = lead_ids || (lead_id ? [lead_id] : []);

    // Check which providers are enabled
    const { data: providersConfig } = await supabase
      .from('enrichment_providers_config')
      .select('*')
      .eq('is_enabled', true);

    const enabledProviders = new Set(providersConfig?.map(p => p.provider) || []);

    console.log(`Enriching ${idsToProcess.length} lead(s) with providers: ${Array.from(enabledProviders).join(', ')}`);

    const results: { lead_id: string; enrichments: EnrichmentResult[]; company_data?: Record<string, unknown> }[] = [];

    for (const leadId of idsToProcess) {
      const { data: lead, error: fetchError } = await supabase
        .from('scraped_leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (fetchError || !lead) {
        results.push({ lead_id: leadId, enrichments: [] });
        continue;
      }

      const enrichments: EnrichmentResult[] = [];
      const updates: Record<string, unknown> = {};
      const providersUsed: string[] = lead.enrichment_providers_used || [];
      const companyData: Record<string, unknown> = lead.company_data || {};

      // Determine what's missing
      const needsName = !lead.full_name;
      const needsEmail = !lead.best_email;
      const needsPhone = !lead.best_phone;
      const needsCompany = !lead.schema_data?.company_name;
      const needsJobTitle = !lead.schema_data?.job_title;
      const needsCompanyEnrichment = enrich_company && (!companyData.employee_count || !companyData.industry);

      // Skip if everything is filled
      if (!needsName && !needsEmail && !needsPhone && !needsCompany && !needsJobTitle && !needsCompanyEnrichment) {
        // Just ensure LinkedIn URL is generated
        if (!lead.linkedin_search_url) {
          updates.linkedin_search_url = generateLinkedInSearchUrl(
            lead.schema_data?.company_name as string,
            lead.full_name,
            lead.schema_data?.job_title as string
          );
        }
        results.push({ lead_id: leadId, enrichments: [] });
        continue;
      }

      // Try Apollo first (best for B2B)
      if (enabledProviders.has('apollo') && apolloApiKey) {
        const apolloResult = await enrichWithApollo(lead.domain, lead.full_name, apolloApiKey);
        if (apolloResult) {
          enrichments.push(apolloResult);
          providersUsed.push('apollo');

          // Apply enriched data
          if (apolloResult.full_name && needsName) {
            updates.full_name = apolloResult.full_name;
            updates.name_source_url = null;
          }
          if (apolloResult.email && needsEmail) {
            updates.best_email = apolloResult.email;
            const allEmails = lead.all_emails || [];
            if (!allEmails.includes(apolloResult.email)) {
              updates.all_emails = [...allEmails, apolloResult.email];
            }
          }
          if ((apolloResult.phone || apolloResult.direct_phone || apolloResult.mobile_phone) && needsPhone) {
            updates.best_phone = apolloResult.direct_phone || apolloResult.mobile_phone || apolloResult.phone;
            const allPhones = lead.all_phones || [];
            const newPhones = [apolloResult.phone, apolloResult.direct_phone, apolloResult.mobile_phone].filter(Boolean) as string[];
            updates.all_phones = [...new Set([...allPhones, ...newPhones])];
          }
          
          // Update schema_data with person info
          if (apolloResult.company_name || apolloResult.job_title || apolloResult.seniority_level || apolloResult.department) {
            updates.schema_data = {
              ...(lead.schema_data || {}),
              ...(apolloResult.company_name ? { company_name: apolloResult.company_name } : {}),
              ...(apolloResult.job_title ? { job_title: apolloResult.job_title } : {}),
              ...(apolloResult.seniority_level ? { seniority_level: apolloResult.seniority_level } : {}),
              ...(apolloResult.department ? { department: apolloResult.department } : {}),
            };
          }
          
          // Update company_data with company info
          if (apolloResult.employee_count || apolloResult.annual_revenue || apolloResult.funding_total) {
            Object.assign(companyData, {
              employee_count: apolloResult.employee_count || companyData.employee_count,
              employee_range: apolloResult.employee_range || companyData.employee_range,
              annual_revenue: apolloResult.annual_revenue || companyData.annual_revenue,
              revenue_range: apolloResult.revenue_range || companyData.revenue_range,
              funding_total: apolloResult.funding_total || companyData.funding_total,
              funding_stage: apolloResult.funding_stage || companyData.funding_stage,
              founded_year: apolloResult.founded_year || companyData.founded_year,
              industry: apolloResult.industry || companyData.industry,
              company_description: apolloResult.company_description || companyData.company_description,
              technologies: apolloResult.technologies || companyData.technologies,
              company_linkedin_url: apolloResult.company_linkedin_url || companyData.company_linkedin_url,
              headquarters_city: apolloResult.headquarters_city || companyData.headquarters_city,
              headquarters_state: apolloResult.headquarters_state || companyData.headquarters_state,
              headquarters_country: apolloResult.headquarters_country || companyData.headquarters_country,
            });
          }
          
          if (apolloResult.linkedin_url) {
            updates.linkedin_search_url = apolloResult.linkedin_url;
          }

          // Log enrichment
          await supabase.from('enrichment_logs').insert({
            lead_id: leadId,
            provider: 'apollo',
            action: 'person_lookup',
            fields_enriched: apolloResult.fields_enriched,
            success: true,
          });
        }
      }

      // Try PDL for additional person data
      if (enabledProviders.has('pdl') && pdlApiKey && (needsEmail || needsPhone)) {
        const pdlResult = await enrichWithPDL(
          updates.best_email as string || lead.best_email,
          updates.full_name as string || lead.full_name,
          lead.domain,
          pdlApiKey
        );
        
        if (pdlResult) {
          enrichments.push(pdlResult);
          providersUsed.push('pdl');

          if (pdlResult.email && needsEmail && !updates.best_email) {
            updates.best_email = pdlResult.email;
          }
          if ((pdlResult.mobile_phone || pdlResult.phone) && needsPhone && !updates.best_phone) {
            updates.best_phone = pdlResult.mobile_phone || pdlResult.phone;
          }

          await supabase.from('enrichment_logs').insert({
            lead_id: leadId,
            provider: 'pdl',
            action: 'person_enrichment',
            fields_enriched: pdlResult.fields_enriched,
            success: true,
          });
        }
      }

      // Try Hunter if still missing email
      if (enabledProviders.has('hunter') && hunterApiKey && (!updates.best_email && needsEmail)) {
        const nameParts = (updates.full_name || lead.full_name)?.split(' ') || [];
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || undefined;

        const hunterResult = await findEmailWithHunter(lead.domain, firstName, lastName, hunterApiKey);
        if (hunterResult) {
          enrichments.push(hunterResult);
          providersUsed.push('hunter');

          if (hunterResult.email) {
            updates.best_email = hunterResult.email;
            const allEmails = updates.all_emails as string[] || lead.all_emails || [];
            if (!allEmails.includes(hunterResult.email)) {
              updates.all_emails = [...allEmails, hunterResult.email];
            }
          }
          if (hunterResult.full_name && !updates.full_name && needsName) {
            updates.full_name = hunterResult.full_name;
          }
          if (hunterResult.job_title) {
            updates.schema_data = {
              ...(updates.schema_data || lead.schema_data || {}),
              job_title: hunterResult.job_title,
              seniority_level: hunterResult.seniority_level,
              department: hunterResult.department,
            };
          }

          await supabase.from('enrichment_logs').insert({
            lead_id: leadId,
            provider: 'hunter',
            action: 'email_discovery',
            fields_enriched: hunterResult.fields_enriched,
            success: true,
          });
        }
      }

      // Company-level enrichment
      if (needsCompanyEnrichment) {
        // Try PDL Company
        if (enabledProviders.has('pdl') && pdlApiKey) {
          const pdlCompanyResult = await enrichCompanyWithPDL(lead.domain, pdlApiKey);
          if (pdlCompanyResult) {
            enrichments.push(pdlCompanyResult);
            providersUsed.push('pdl_company');

            Object.assign(companyData, {
              employee_count: pdlCompanyResult.employee_count || companyData.employee_count,
              employee_range: pdlCompanyResult.employee_range || companyData.employee_range,
              annual_revenue: pdlCompanyResult.annual_revenue || companyData.annual_revenue,
              funding_total: pdlCompanyResult.funding_total || companyData.funding_total,
              funding_stage: pdlCompanyResult.funding_stage || companyData.funding_stage,
              founded_year: pdlCompanyResult.founded_year || companyData.founded_year,
              industry: pdlCompanyResult.industry || companyData.industry,
              company_description: pdlCompanyResult.company_description || companyData.company_description,
              technologies: pdlCompanyResult.technologies || companyData.technologies,
              company_linkedin_url: pdlCompanyResult.company_linkedin_url || companyData.company_linkedin_url,
            });

            await supabase.from('enrichment_logs').insert({
              lead_id: leadId,
              provider: 'pdl_company',
              action: 'company_enrichment',
              fields_enriched: pdlCompanyResult.fields_enriched,
              success: true,
            });
          }
        }

        // Try Clearbit for company enrichment
        if (enabledProviders.has('clearbit') && clearbitApiKey && !companyData.employee_count) {
          const clearbitResult = await enrichWithClearbit(lead.domain, clearbitApiKey);
          if (clearbitResult) {
            enrichments.push(clearbitResult);
            providersUsed.push('clearbit');

            Object.assign(companyData, {
              employee_count: clearbitResult.employee_count || companyData.employee_count,
              employee_range: clearbitResult.employee_range || companyData.employee_range,
              revenue_range: clearbitResult.revenue_range || companyData.revenue_range,
              funding_total: clearbitResult.funding_total || companyData.funding_total,
              founded_year: clearbitResult.founded_year || companyData.founded_year,
              industry: clearbitResult.industry || companyData.industry,
              company_description: clearbitResult.company_description || companyData.company_description,
              technologies: clearbitResult.technologies || companyData.technologies,
              company_linkedin_url: clearbitResult.company_linkedin_url || companyData.company_linkedin_url,
            });

            await supabase.from('enrichment_logs').insert({
              lead_id: leadId,
              provider: 'clearbit',
              action: 'company_lookup',
              fields_enriched: clearbitResult.fields_enriched,
              success: true,
            });
          }
        }
      }

      // Generate LinkedIn search URL if not set
      if (!lead.linkedin_search_url && !updates.linkedin_search_url) {
        const companyName = (updates.schema_data as Record<string, unknown>)?.company_name as string || 
          lead.schema_data?.company_name as string || lead.domain;
        const fullName = updates.full_name as string || lead.full_name;
        const jobTitle = (updates.schema_data as Record<string, unknown>)?.job_title as string ||
          lead.schema_data?.job_title as string;

        updates.linkedin_search_url = generateLinkedInSearchUrl(companyName, fullName, jobTitle);
      }

      // Store company data
      if (Object.keys(companyData).length > 0) {
        updates.company_data = companyData;
      }

      // Store enrichment data
      if (enrichments.length > 0) {
        updates.enrichment_data = {
          ...(lead.enrichment_data || {}),
          last_enriched_at: new Date().toISOString(),
          enrichment_results: enrichments,
        };
        updates.enrichment_providers_used = [...new Set(providersUsed)];

        // Recalculate confidence score
        let newScore = lead.confidence_score || 30;
        if (updates.best_email) newScore += 15;
        if (updates.best_phone) newScore += 10;
        if (updates.full_name) newScore += 10;
        if (companyData.employee_count) newScore += 5;
        if (companyData.industry) newScore += 5;
        if (companyData.annual_revenue) newScore += 5;
        updates.confidence_score = Math.min(100, newScore);
      }

      // Apply updates
      if (Object.keys(updates).length > 0) {
        await supabase
          .from('scraped_leads')
          .update(updates)
          .eq('id', leadId);
      }

      results.push({ lead_id: leadId, enrichments, company_data: companyData });
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in enrich-lead:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to enrich lead data. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
