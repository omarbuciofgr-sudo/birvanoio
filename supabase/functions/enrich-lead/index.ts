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
  force_skip_trace: z.boolean().optional().default(false), // Force skip trace even if data exists
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

// Generate LinkedIn search URL
function generateLinkedInSearchUrl(companyName?: string, name?: string, jobTitle?: string): string {
  const parts: string[] = [];
  if (name) parts.push(name);
  if (companyName) parts.push(companyName);
  if (jobTitle) parts.push(jobTitle);
  
  const query = parts.join(' ');
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
}

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

// Detect if this is a real estate lead (needs skip trace instead of B2B enrichment)
function isRealEstateLead(lead: any): boolean {
  const sourceType = lead.source_type || '';
  const leadType = lead.lead_type || '';
  const domain = lead.domain || '';
  const sourceUrl = lead.source_url || '';
  
  // Check source type
  if (sourceType.includes('real_estate') || sourceType.includes('fsbo')) return true;
  
  // Check lead type
  if (leadType === 'fsbo' || leadType === 'frbo') return true;
  
  // Check domain pattern (real estate leads have address-based domains)
  if (domain.includes('zillow-') || domain.includes('hotpads-') || 
      domain.includes('apartments-') || domain.includes('redfin-') ||
      domain.includes('trulia-') || domain.includes('realtor-')) return true;
  
  // Check source URL for real estate platforms
  if (sourceUrl.includes('hotpads.com') || sourceUrl.includes('zillow.com') ||
      sourceUrl.includes('apartments.com') || sourceUrl.includes('redfin.com') ||
      sourceUrl.includes('trulia.com') || sourceUrl.includes('realtor.com')) return true;
  
  // Check if has address but no website domain
  if (lead.address && (!domain || domain.includes('-'))) return true;
  
  return false;
}

// Parse address from HotPads URL slug (for enrichment when address is null)
function parseHotpadsAddressFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    if (pathParts.length === 0) return null;
    
    // The first path segment contains the address slug
    const slug = pathParts[0];
    
    // Skip if it's just a city search page
    if (slug.match(/^[a-z-]+-[a-z]{2}$/i)) return null;
    
    // Remove the trailing listing ID (alphanumeric code at the end)
    const cleanedSlug = slug.replace(/-[a-z0-9]{6,}$/i, '');
    
    // Match pattern: street-number-street-name-city-state-zip
    const stateZipMatch = cleanedSlug.match(/^(.+?)-([a-z]{2})-(\d{5})$/i);
    if (stateZipMatch) {
      const [, addressPart, state, zip] = stateZipMatch;
      
      // Find where city starts (after street suffix like ave, st, dr, etc.)
      const streetSuffixes = ['ave', 'st', 'rd', 'dr', 'blvd', 'ln', 'way', 'ct', 'pl', 'cir', 'pkwy', 'ter'];
      let cityStartIndex = -1;
      const words = addressPart.split('-');
      
      for (let i = 0; i < words.length; i++) {
        if (streetSuffixes.includes(words[i].toLowerCase())) {
          cityStartIndex = i + 1;
          break;
        }
      }
      
      if (cityStartIndex > 0 && cityStartIndex < words.length) {
        const streetParts = words.slice(0, cityStartIndex);
        const cityParts = words.slice(cityStartIndex);
        
        const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
        const street = streetParts.map(capitalize).join(' ');
        const city = cityParts.map(capitalize).join(' ');
        
        return `${street}, ${city}, ${state.toUpperCase()} ${zip}`;
      }
    }
    
    // Fallback: format the slug nicely
    const formattedAddress = cleanedSlug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    return formattedAddress || null;
  } catch {
    return null;
  }
}

// Get address for skip tracing - from lead.address or parse from source_url
function getAddressForSkipTrace(lead: any): string | null {
  // First try the address field
  if (lead.address) {
    return lead.address;
  }
  
  // Try schema_data.full_address
  if (lead.schema_data?.full_address) {
    return lead.schema_data.full_address;
  }
  
  // Parse from source URL for HotPads and similar platforms
  const sourceUrl = lead.source_url || '';
  if (sourceUrl.includes('hotpads.com')) {
    const parsed = parseHotpadsAddressFromUrl(sourceUrl);
    if (parsed) {
      console.log(`[EnrichLead] Parsed address from HotPads URL: ${parsed}`);
      return parsed;
    }
  }
  
  // Try to parse address from Zillow/Apartments/etc URL patterns
  if (sourceUrl.includes('zillow.com') || sourceUrl.includes('apartments.com') ||
      sourceUrl.includes('redfin.com') || sourceUrl.includes('trulia.com')) {
    try {
      const urlObj = new URL(sourceUrl);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      
      // Look for address-like segments
      for (const part of pathParts) {
        // Pattern like: 123-main-st-city-state-12345
        if (part.match(/^\d+-[a-z-]+-[a-z]{2}-\d{5}$/i)) {
          const formatted = part
            .replace(/-([a-z]{2})-(\d{5})$/i, ', $1 $2')
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          console.log(`[EnrichLead] Parsed address from URL: ${formatted}`);
          return formatted;
        }
      }
    } catch {
      // Ignore URL parse errors
    }
  }
  
  return null;
}

// Extract city and state from address for skip trace
function parseAddressForSkipTrace(address: string): { street: string; city: string; state: string; zip: string } {
  const parts = address.split(',').map(p => p.trim());
  
  if (parts.length >= 3) {
    const stateZip = parts[parts.length - 1].trim().split(/\s+/);
    return {
      street: parts[0],
      city: parts[1],
      state: stateZip[0] || '',
      zip: stateZip.length > 1 ? stateZip[stateZip.length - 1] : '',
    };
  }
  
  // Try to parse "Street, City State ZIP" format (only 2 comma-separated parts)
  if (parts.length === 2) {
    const stateZipMatch = parts[1].match(/^(.+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
    if (stateZipMatch) {
      return {
        street: parts[0],
        city: stateZipMatch[1].trim(),
        state: stateZipMatch[2].toUpperCase(),
        zip: stateZipMatch[3],
      };
    }
  }
  
  return { street: address, city: '', state: '', zip: '' };
}

// Skip trace for real estate leads using BatchData/Tracerfy
async function enrichWithSkipTrace(
  address: string,
  batchDataApiKey?: string,
  tracerfyApiKey?: string
): Promise<EnrichmentResult | null> {
  const parsed = parseAddressForSkipTrace(address);
  
  // Try BatchData first
  if (batchDataApiKey) {
    try {
      console.log('[SkipTrace-BatchData] Looking up:', address);
      
      const response = await fetch('https://api.batchdata.com/api/v1/property/skip-trace', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${batchDataApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{
            propertyAddress: {
              street: parsed.street,
              city: parsed.city,
              state: parsed.state,
              zip: parsed.zip,
            }
          }]
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const result = data.results?.success?.[0] || data.results?.[0];
        
        if (result) {
          const owner = result.people?.[0] || result.owner || {};
          const fieldsEnriched: string[] = [];
          
          const fullName = owner.fullName || owner.name || 
            [owner.firstName, owner.lastName].filter(Boolean).join(' ');
          const phones = owner.phones || owner.phoneNumbers || [];
          const emails = owner.emails || owner.emailAddresses || [];
          
          if (fullName) fieldsEnriched.push('full_name');
          if (phones.length > 0) fieldsEnriched.push('phone');
          if (emails.length > 0) fieldsEnriched.push('email');
          
          if (fieldsEnriched.length > 0) {
            return {
              full_name: fullName || undefined,
              phone: typeof phones[0] === 'object' ? phones[0].number : phones[0],
              mobile_phone: phones.find((p: any) => p.type?.toLowerCase().includes('mobile'))?.number,
              email: typeof emails[0] === 'object' ? emails[0].address : emails[0],
              provider: 'batchdata_skip_trace',
              fields_enriched: fieldsEnriched,
            };
          }
        }
      }
    } catch (error) {
      console.error('[SkipTrace-BatchData] Error:', error);
    }
  }
  
  // Fallback to Tracerfy
  if (tracerfyApiKey) {
    try {
      console.log('[SkipTrace-Tracerfy] Looking up:', address);
      
      const response = await fetch('https://www.tracerfy.com/api/v2/trace', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tracerfyApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: parsed.street,
          city: parsed.city,
          state: parsed.state,
          zip: parsed.zip,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.data) {
          const result = data.data;
          const fieldsEnriched: string[] = [];
          
          const fullName = result.fullName || result.full_name || 
            [result.firstName || result.first_name, result.lastName || result.last_name].filter(Boolean).join(' ');
          
          const phones = result.phones || result.phoneNumbers || [];
          const emails = result.emails || result.emailAddresses || [];
          
          if (fullName) fieldsEnriched.push('full_name');
          if (phones.length > 0) fieldsEnriched.push('phone');
          if (emails.length > 0) fieldsEnriched.push('email');
          
          if (fieldsEnriched.length > 0) {
            return {
              full_name: fullName || undefined,
              phone: typeof phones[0] === 'object' ? phones[0].number : phones[0],
              email: typeof emails[0] === 'object' ? emails[0].address : emails[0],
              provider: 'tracerfy_skip_trace',
              fields_enriched: fieldsEnriched,
            };
          }
        }
      }
    } catch (error) {
      console.error('[SkipTrace-Tracerfy] Error:', error);
    }
  }
  
  return null;
}

// Apollo.io API - Domain enrichment
async function enrichWithApollo(
  domain: string,
  name?: string | null,
  apiKey?: string
): Promise<EnrichmentResult | null> {
  if (!apiKey) return null;

  try {
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
        per_page: 10,
      }),
    });

    const data = await response.json();
    
    if (data.people && data.people.length > 0) {
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
        technologies: org.technologies?.slice(0, 20),
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

// Hunter.io email finder
async function findEmailWithHunter(
  domain: string,
  firstName?: string,
  lastName?: string,
  apiKey?: string
): Promise<EnrichmentResult | null> {
  if (!apiKey) return null;

  try {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const apolloApiKey = Deno.env.get('APOLLO_API_KEY');
  const hunterApiKey = Deno.env.get('HUNTER_API_KEY');
  const pdlApiKey = Deno.env.get('PDL_API_KEY');
  const batchDataApiKey = Deno.env.get('BATCHDATA_API_KEY');
  const tracerfyApiKey = Deno.env.get('TRACERFY_API_KEY');

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
    
    const { lead_id, lead_ids, enrich_company, force_skip_trace } = parseResult.data;
    const idsToProcess = lead_ids || (lead_id ? [lead_id] : []);

    console.log(`Enriching ${idsToProcess.length} lead(s)`);

    const results: { lead_id: string; enrichments: EnrichmentResult[]; error?: string }[] = [];

    for (const leadId of idsToProcess) {
      const { data: lead, error: fetchError } = await supabase
        .from('scraped_leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (fetchError || !lead) {
        console.error(`Lead ${leadId} not found:`, fetchError);
        results.push({ lead_id: leadId, enrichments: [], error: 'Lead not found' });
        continue;
      }

      const enrichments: EnrichmentResult[] = [];
      const updates: Record<string, unknown> = {};
      const providersUsed: string[] = lead.enrichment_providers_used || [];

      // Check what's missing
      const needsName = !lead.full_name;
      const needsEmail = !lead.best_email;
      const needsPhone = !lead.best_phone;

      console.log(`Lead ${leadId}: isRealEstate=${isRealEstateLead(lead)}, needsName=${needsName}, needsEmail=${needsEmail}, needsPhone=${needsPhone}`);

      // Use different enrichment strategy based on lead type
      if (isRealEstateLead(lead)) {
        console.log(`[RealEstate] Using skip trace for lead ${leadId}`);
        
        // Get address for skip tracing - from lead.address or parse from source_url
        const addressForSkipTrace = getAddressForSkipTrace(lead);
        
        // For real estate, use skip trace based on address
        if (addressForSkipTrace && (needsName || needsEmail || needsPhone || force_skip_trace)) {
          console.log(`[SkipTrace] Using address: ${addressForSkipTrace}`);
          
          // Update the lead's address if we parsed it from URL and it was previously null
          if (!lead.address && addressForSkipTrace) {
            updates.address = addressForSkipTrace;
          }
          
          const skipTraceResult = await enrichWithSkipTrace(addressForSkipTrace, batchDataApiKey, tracerfyApiKey);
          
          if (skipTraceResult) {
            enrichments.push(skipTraceResult);
            providersUsed.push(skipTraceResult.provider);
            
            if (skipTraceResult.full_name && needsName) {
              updates.full_name = skipTraceResult.full_name;
            }
            if (skipTraceResult.email && needsEmail) {
              updates.best_email = skipTraceResult.email;
              const allEmails = lead.all_emails || [];
              if (!allEmails.includes(skipTraceResult.email)) {
                updates.all_emails = [...allEmails, skipTraceResult.email];
              }
            }
            if ((skipTraceResult.phone || skipTraceResult.mobile_phone) && needsPhone) {
              updates.best_phone = skipTraceResult.mobile_phone || skipTraceResult.phone;
              const allPhones = lead.all_phones || [];
              const newPhones = [skipTraceResult.phone, skipTraceResult.mobile_phone].filter(Boolean) as string[];
              updates.all_phones = [...new Set([...allPhones, ...newPhones])];
            }
            
            console.log(`[SkipTrace] Found: name=${!!skipTraceResult.full_name}, phone=${!!skipTraceResult.phone}, email=${!!skipTraceResult.email}`);
          } else {
            console.log(`[SkipTrace] No results found for address: ${addressForSkipTrace}`);
          }
        } else if (!addressForSkipTrace) {
          console.log(`[SkipTrace] No address available for lead ${leadId} - cannot perform skip trace`);
        }
      } else {
        // For B2B leads, use Apollo/Hunter/PDL
        console.log(`[B2B] Using Apollo/Hunter/PDL for lead ${leadId}`);
        
        // Extract domain from lead
        let domain = lead.domain;
        if (!domain || domain.includes('-')) {
          // Try to extract from source_url or website
          const sourceUrl = lead.source_url || '';
          try {
            const url = new URL(sourceUrl.startsWith('http') ? sourceUrl : `https://${sourceUrl}`);
            domain = url.hostname.replace('www.', '');
          } catch {
            domain = null;
          }
        }

        if (domain && (needsName || needsEmail || needsPhone)) {
          // Try Apollo first
          if (apolloApiKey) {
            const apolloResult = await enrichWithApollo(domain, lead.full_name, apolloApiKey);
            if (apolloResult) {
              enrichments.push(apolloResult);
              providersUsed.push('apollo');

              if (apolloResult.full_name && needsName) {
                updates.full_name = apolloResult.full_name;
              }
              if (apolloResult.email && needsEmail) {
                updates.best_email = apolloResult.email;
              }
              if ((apolloResult.phone || apolloResult.direct_phone || apolloResult.mobile_phone) && needsPhone) {
                updates.best_phone = apolloResult.direct_phone || apolloResult.mobile_phone || apolloResult.phone;
              }
              if (apolloResult.linkedin_url) {
                updates.linkedin_search_url = apolloResult.linkedin_url;
              }
            }
          }

          // Try PDL if still missing data
          if (pdlApiKey && (!updates.best_email || !updates.best_phone)) {
            const pdlResult = await enrichWithPDL(
              updates.best_email as string || lead.best_email,
              updates.full_name as string || lead.full_name,
              domain,
              pdlApiKey
            );
            
            if (pdlResult) {
              enrichments.push(pdlResult);
              providersUsed.push('pdl');

              if (pdlResult.email && !updates.best_email) {
                updates.best_email = pdlResult.email;
              }
              if ((pdlResult.mobile_phone || pdlResult.phone) && !updates.best_phone) {
                updates.best_phone = pdlResult.mobile_phone || pdlResult.phone;
              }
            }
          }

          // Try Hunter if still missing email
          if (hunterApiKey && !updates.best_email) {
            const nameParts = (updates.full_name || lead.full_name)?.split(' ') || [];
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ') || undefined;

            const hunterResult = await findEmailWithHunter(domain, firstName, lastName, hunterApiKey);
            if (hunterResult) {
              enrichments.push(hunterResult);
              providersUsed.push('hunter');

              if (hunterResult.email) {
                updates.best_email = hunterResult.email;
              }
              if (hunterResult.full_name && !updates.full_name && needsName) {
                updates.full_name = hunterResult.full_name;
              }
            }
          }
        }
      }

      // Generate LinkedIn search URL if not set
      if (!lead.linkedin_search_url && !updates.linkedin_search_url) {
        const companyName = lead.schema_data?.company_name as string || lead.domain;
        const fullName = updates.full_name as string || lead.full_name;
        updates.linkedin_search_url = generateLinkedInSearchUrl(companyName, fullName);
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
        updates.confidence_score = Math.min(100, newScore);
      }

      // Apply updates
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('scraped_leads')
          .update(updates)
          .eq('id', leadId);
          
        if (updateError) {
          console.error(`Error updating lead ${leadId}:`, updateError);
        }
      }

      results.push({ lead_id: leadId, enrichments });
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in enrich-lead:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to enrich lead data' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
