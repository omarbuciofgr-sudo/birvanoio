import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Retry helper with exponential backoff
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  baseDelay = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status >= 400 && response.status < 500) return response;
      if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError || new Error('Fetch failed after retries');
}

/**
 * Data Waterfall Enrichment - Chain multiple providers for maximum coverage
 * 
 * Order: Clay → Apollo → Hunter → PDL → Snov.io → RocketReach → Lusha → ContactOut → Clearbit → Google Search
 * 
 * Clay is the first provider in the waterfall since it orchestrates 75+ enrichment
 * providers internally. If Clay returns complete data, subsequent providers are skipped.
 * Each provider fills in missing data from the previous one.
 * Stops when we have complete contact info (name, email, phone).
 */

interface EnrichmentInput {
  domain: string;
  name?: string;
  email?: string;
  company_name?: string;
  target_titles?: string[];
}

interface EnrichmentResult {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  direct_phone: string | null;
  job_title: string | null;
  seniority_level: string | null;
  department: string | null;
  linkedin_url: string | null;
  company_name: string | null;
  company_linkedin_url: string | null;
  employee_count: number | null;
  annual_revenue: number | null;
  industry: string | null;
  founded_year: number | null;
  headquarters_city: string | null;
  headquarters_state: string | null;
  providers_used: string[];
  waterfall_log: WaterfallStep[];
}

interface WaterfallStep {
  provider: string;
  success: boolean;
  fields_found: string[];
  fields_missing: string[];
  duration_ms: number;
}

function getMissingFields(result: Partial<EnrichmentResult>): string[] {
  const requiredFields = ['full_name', 'email', 'phone'];
  const niceToHave = ['job_title', 'linkedin_url', 'company_name'];
  const missing: string[] = [];
  for (const field of [...requiredFields, ...niceToHave]) {
    if (!result[field as keyof EnrichmentResult]) missing.push(field);
  }
  return missing;
}

function hasCompleteData(result: Partial<EnrichmentResult>): boolean {
  return !!(result.full_name && result.email && result.phone);
}

// ========== PROVIDER FUNCTIONS ==========

// Clay enrichment - orchestrates 75+ providers via Clay's API
async function enrichWithClay(
  input: EnrichmentInput,
  apiKey: string
): Promise<{ data: Partial<EnrichmentResult> | null; fields: string[] }> {
  try {
    // Try Clay's direct People & Company API
    const params = new URLSearchParams();
    if (input.domain) params.set('company_domain', input.domain);
    if (input.name) params.set('name', input.name);
    if (input.email) params.set('email', input.email);

    const response = await fetchWithRetry(
      `https://api.clay.com/v3/people/enrich?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // If 403/404 - endpoint not available on this plan, skip silently
    if (response.status === 403 || response.status === 404) {
      console.log('Clay direct API not available on this plan, skipping');
      return { data: null, fields: [] };
    }

    if (!response.ok) {
      console.error(`Clay API error: ${response.status}`);
      return { data: null, fields: [] };
    }

    const data = await response.json();
    const fields: string[] = [];
    const result: Partial<EnrichmentResult> = {};

    if (data.full_name || data.name) { result.full_name = data.full_name || data.name; fields.push('full_name'); }
    if (data.work_email || data.email) { result.email = data.work_email || data.email; fields.push('email'); }
    if (data.phone_number || data.mobile_phone || data.direct_phone) {
      result.phone = data.phone_number || data.mobile_phone || data.direct_phone;
      fields.push('phone');
      if (data.mobile_phone) { result.mobile_phone = data.mobile_phone; fields.push('mobile_phone'); }
      if (data.direct_phone) { result.direct_phone = data.direct_phone; fields.push('direct_phone'); }
    }
    if (data.job_title || data.title) { result.job_title = data.job_title || data.title; fields.push('job_title'); }
    if (data.seniority) { result.seniority_level = data.seniority; fields.push('seniority_level'); }
    if (data.linkedin_url) { result.linkedin_url = data.linkedin_url; fields.push('linkedin_url'); }
    if (data.company_name || data.organization?.name) {
      result.company_name = data.company_name || data.organization?.name;
      fields.push('company_name');
    }
    if (data.company_linkedin_url || data.organization?.linkedin_url) {
      result.company_linkedin_url = data.company_linkedin_url || data.organization?.linkedin_url;
      fields.push('company_linkedin_url');
    }
    if (data.company_employee_count || data.organization?.employee_count) {
      result.employee_count = data.company_employee_count || data.organization?.employee_count;
      fields.push('employee_count');
    }
    if (data.company_industry || data.organization?.industry) {
      result.industry = data.company_industry || data.organization?.industry;
      fields.push('industry');
    }
    if (data.company_annual_revenue) {
      result.annual_revenue = typeof data.company_annual_revenue === 'string'
        ? parseInt(data.company_annual_revenue.replace(/[^0-9]/g, ''))
        : data.company_annual_revenue;
      fields.push('annual_revenue');
    }

    if (fields.length > 0) return { data: result, fields };
  } catch (error) { console.error('Clay waterfall error:', error); }
  return { data: null, fields: [] };
}

// Apollo enrichment
async function enrichWithApollo(
  input: EnrichmentInput,
  apiKey: string
): Promise<{ data: Partial<EnrichmentResult> | null; fields: string[] }> {
  try {
    const searchBody: Record<string, unknown> = {
      q_organization_domains: input.domain,
      page: 1,
      per_page: 5,
    };
    if (input.target_titles?.length) searchBody.person_titles = input.target_titles;
    
    const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify(searchBody),
    });
    const data = await response.json();
    
    if (data.people?.length) {
      const priorityTitles = ['owner', 'ceo', 'founder', 'president'];
      let bestMatch = data.people[0];
      for (const person of data.people) {
        const title = (person.title || '').toLowerCase();
        if (priorityTitles.some(pt => title.includes(pt))) { bestMatch = person; break; }
      }
      
      const org = bestMatch.organization || {};
      const directPhone = bestMatch.phone_numbers?.find((p: any) => p.type === 'direct_dial')?.number;
      const mobilePhone = bestMatch.phone_numbers?.find((p: any) => p.type === 'mobile')?.number;
      
      const fields: string[] = [];
      if (bestMatch.name) fields.push('full_name');
      if (bestMatch.email) fields.push('email');
      if (bestMatch.phone_numbers?.[0]) fields.push('phone');
      if (bestMatch.title) fields.push('job_title');
      if (bestMatch.linkedin_url) fields.push('linkedin_url');
      if (org.name) fields.push('company_name');
      
      return {
        data: {
          full_name: bestMatch.name || null,
          email: bestMatch.email || null,
          phone: bestMatch.phone_numbers?.[0]?.number || null,
          mobile_phone: mobilePhone || null,
          direct_phone: directPhone || null,
          job_title: bestMatch.title || null,
          seniority_level: bestMatch.seniority || null,
          department: bestMatch.departments?.[0] || null,
          linkedin_url: bestMatch.linkedin_url || null,
          company_name: org.name || null,
          company_linkedin_url: org.linkedin_url || null,
          employee_count: org.estimated_num_employees || null,
          annual_revenue: org.annual_revenue || null,
          industry: org.industry || null,
          founded_year: org.founded_year || null,
          headquarters_city: org.city || null,
          headquarters_state: org.state || null,
        },
        fields,
      };
    }
  } catch (error) { console.error('Apollo waterfall error:', error); }
  return { data: null, fields: [] };
}

// Hunter enrichment
async function enrichWithHunter(
  input: EnrichmentInput,
  currentData: Partial<EnrichmentResult>,
  apiKey: string
): Promise<{ data: Partial<EnrichmentResult> | null; fields: string[] }> {
  try {
    if (currentData.full_name) {
      const nameParts = currentData.full_name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      const response = await fetch(
        `https://api.hunter.io/v2/email-finder?domain=${input.domain}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&api_key=${apiKey}`
      );
      const data = await response.json();
      if (data.data?.email) {
        return { data: { email: data.data.email }, fields: ['email'] };
      }
    }
    
    const response = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${input.domain}&api_key=${apiKey}&limit=5`
    );
    const data = await response.json();
    
    if (data.data?.emails?.[0]) {
      const bestEmail = data.data.emails[0];
      const fields: string[] = ['email'];
      const result: Partial<EnrichmentResult> = { email: bestEmail.value };
      
      if (!currentData.full_name && bestEmail.first_name && bestEmail.last_name) {
        result.full_name = `${bestEmail.first_name} ${bestEmail.last_name}`;
        fields.push('full_name');
      }
      if (!currentData.job_title && bestEmail.position) {
        result.job_title = bestEmail.position;
        fields.push('job_title');
      }
      if (!currentData.linkedin_url && bestEmail.linkedin) {
        result.linkedin_url = bestEmail.linkedin;
        fields.push('linkedin_url');
      }
      return { data: result, fields };
    }
  } catch (error) { console.error('Hunter waterfall error:', error); }
  return { data: null, fields: [] };
}

// PDL enrichment
async function enrichWithPDL(
  input: EnrichmentInput,
  currentData: Partial<EnrichmentResult>,
  apiKey: string
): Promise<{ data: Partial<EnrichmentResult> | null; fields: string[] }> {
  try {
    const params: Record<string, string> = {};
    if (currentData.email) params.email = currentData.email;
    if (currentData.full_name) params.name = currentData.full_name;
    if (input.domain) params.company = input.domain;
    if (Object.keys(params).length === 0) return { data: null, fields: [] };
    
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(
      `https://api.peopledatalabs.com/v5/person/enrich?${queryString}`,
      { headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' } }
    );
    if (!response.ok) return { data: null, fields: [] };
    const data = await response.json();
    
    if (data.status === 200 && data.data) {
      const person = data.data;
      const fields: string[] = [];
      const result: Partial<EnrichmentResult> = {};
      
      if (!currentData.full_name && person.full_name) { result.full_name = person.full_name; fields.push('full_name'); }
      if (!currentData.email && (person.work_email || person.personal_emails?.[0])) { result.email = person.work_email || person.personal_emails[0]; fields.push('email'); }
      if (!currentData.phone && person.phone_numbers?.[0]) { result.phone = person.phone_numbers[0]; fields.push('phone'); }
      if (!currentData.mobile_phone && person.mobile_phone) { result.mobile_phone = person.mobile_phone; fields.push('mobile_phone'); }
      if (!currentData.job_title && person.job_title) { result.job_title = person.job_title; fields.push('job_title'); }
      if (!currentData.linkedin_url && person.linkedin_url) { result.linkedin_url = person.linkedin_url; fields.push('linkedin_url'); }
      if (!currentData.company_name && person.job_company_name) { result.company_name = person.job_company_name; fields.push('company_name'); }
      if (!currentData.industry && person.job_company_industry) { result.industry = person.job_company_industry; fields.push('industry'); }
      
      return { data: result, fields };
    }
  } catch (error) { console.error('PDL waterfall error:', error); }
  return { data: null, fields: [] };
}

// Snov.io enrichment - email finder + domain search
async function enrichWithSnovio(
  input: EnrichmentInput,
  currentData: Partial<EnrichmentResult>,
  apiKey: string
): Promise<{ data: Partial<EnrichmentResult> | null; fields: string[] }> {
  try {
    // First try email finder if we have a name
    if (currentData.full_name) {
      const nameParts = currentData.full_name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      
      const response = await fetchWithRetry(
        'https://api.snov.io/v1/get-emails-from-names',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: apiKey,
            domain: input.domain,
            firstName,
            lastName,
          }),
        }
      );
      const data = await response.json();
      
      if (data.success && data.data?.emails?.length) {
        const fields: string[] = ['email'];
        const result: Partial<EnrichmentResult> = {
          email: data.data.emails[0].email,
        };
        return { data: result, fields };
      }
    }
    
    // Fall back to domain search
    const response = await fetchWithRetry(
      `https://api.snov.io/v2/domain-emails-with-info?domain=${input.domain}&type=all&limit=5`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      }
    );
    const data = await response.json();
    
    if (data.success && data.data?.emails?.length) {
      const best = data.data.emails[0];
      const fields: string[] = [];
      const result: Partial<EnrichmentResult> = {};
      
      if (!currentData.email && best.email) { result.email = best.email; fields.push('email'); }
      if (!currentData.full_name && best.firstName && best.lastName) {
        result.full_name = `${best.firstName} ${best.lastName}`;
        fields.push('full_name');
      }
      if (!currentData.job_title && best.position) { result.job_title = best.position; fields.push('job_title'); }
      
      if (fields.length > 0) return { data: result, fields };
    }
  } catch (error) { console.error('Snov.io waterfall error:', error); }
  return { data: null, fields: [] };
}

// RocketReach enrichment - full POC (email, phone, LinkedIn, title)
async function enrichWithRocketReach(
  input: EnrichmentInput,
  currentData: Partial<EnrichmentResult>,
  apiKey: string
): Promise<{ data: Partial<EnrichmentResult> | null; fields: string[] }> {
  try {
    const searchBody: Record<string, unknown> = {
      current_employer: input.company_name || input.domain,
      page_size: 5,
    };
    if (currentData.full_name) searchBody.name = currentData.full_name;
    if (input.target_titles?.length) searchBody.current_title = input.target_titles;
    
    const response = await fetchWithRetry(
      'https://api.rocketreach.co/api/v2/person/search',
      {
        method: 'POST',
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchBody),
      }
    );
    const data = await response.json();
    
    if (data.profiles?.length) {
      const profile = data.profiles[0];
      const fields: string[] = [];
      const result: Partial<EnrichmentResult> = {};
      
      if (!currentData.full_name && profile.name) { result.full_name = profile.name; fields.push('full_name'); }
      if (!currentData.email && profile.current_work_email) { result.email = profile.current_work_email; fields.push('email'); }
      if (!currentData.email && !result.email && profile.emails?.length) { result.email = profile.emails[0]; fields.push('email'); }
      if (!currentData.phone && profile.phones?.length) {
        result.phone = typeof profile.phones[0] === 'object' ? profile.phones[0].number : profile.phones[0];
        fields.push('phone');
      }
      if (!currentData.job_title && profile.current_title) { result.job_title = profile.current_title; fields.push('job_title'); }
      if (!currentData.linkedin_url && profile.linkedin_url) { result.linkedin_url = profile.linkedin_url; fields.push('linkedin_url'); }
      if (!currentData.company_name && profile.current_employer) { result.company_name = profile.current_employer; fields.push('company_name'); }
      
      if (fields.length > 0) return { data: result, fields };
    }
  } catch (error) { console.error('RocketReach waterfall error:', error); }
  return { data: null, fields: [] };
}

// Lusha enrichment - direct dials + verified emails
async function enrichWithLusha(
  input: EnrichmentInput,
  currentData: Partial<EnrichmentResult>,
  apiKey: string
): Promise<{ data: Partial<EnrichmentResult> | null; fields: string[] }> {
  try {
    const params: Record<string, string> = {};
    if (input.domain) params.company = input.domain;
    if (currentData.full_name) {
      const nameParts = currentData.full_name.split(' ');
      params.firstName = nameParts[0];
      params.lastName = nameParts[nameParts.length - 1];
    }
    if (currentData.linkedin_url) params.linkedinUrl = currentData.linkedin_url;
    
    const queryString = new URLSearchParams(params).toString();
    const response = await fetchWithRetry(
      `https://api.lusha.com/person?${queryString}`,
      {
        method: 'GET',
        headers: { 'api_key': apiKey, 'Content-Type': 'application/json' },
      }
    );
    
    if (!response.ok) return { data: null, fields: [] };
    const data = await response.json();
    
    if (data) {
      const fields: string[] = [];
      const result: Partial<EnrichmentResult> = {};
      
      if (!currentData.full_name && data.firstName && data.lastName) {
        result.full_name = `${data.firstName} ${data.lastName}`;
        fields.push('full_name');
      }
      if (!currentData.email && data.emailAddresses?.length) {
        result.email = data.emailAddresses[0].email;
        fields.push('email');
      }
      if (!currentData.phone && data.phoneNumbers?.length) {
        const directDial = data.phoneNumbers.find((p: any) => p.type === 'direct') || data.phoneNumbers[0];
        result.phone = directDial.internationalNumber || directDial.number;
        fields.push('phone');
        if (directDial.type === 'direct') {
          result.direct_phone = result.phone;
          fields.push('direct_phone');
        }
      }
      if (!currentData.job_title && data.jobTitle) { result.job_title = data.jobTitle; fields.push('job_title'); }
      if (!currentData.company_name && data.company?.name) { result.company_name = data.company.name; fields.push('company_name'); }
      
      if (fields.length > 0) return { data: result, fields };
    }
  } catch (error) { console.error('Lusha waterfall error:', error); }
  return { data: null, fields: [] };
}

// ContactOut enrichment - LinkedIn-based email/phone lookup
async function enrichWithContactOut(
  input: EnrichmentInput,
  currentData: Partial<EnrichmentResult>,
  apiKey: string
): Promise<{ data: Partial<EnrichmentResult> | null; fields: string[] }> {
  try {
    // ContactOut works best with LinkedIn URL
    if (currentData.linkedin_url) {
      const response = await fetchWithRetry(
        `https://api.contactout.com/v1/people/linkedin?linkedin_url=${encodeURIComponent(currentData.linkedin_url)}`,
        {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const person = data.profile || data;
        const fields: string[] = [];
        const result: Partial<EnrichmentResult> = {};
        
        if (!currentData.email && person.emails?.length) { result.email = person.emails[0]; fields.push('email'); }
        if (!currentData.phone && person.phones?.length) { result.phone = person.phones[0]; fields.push('phone'); }
        if (!currentData.full_name && person.name) { result.full_name = person.name; fields.push('full_name'); }
        if (!currentData.job_title && person.title) { result.job_title = person.title; fields.push('job_title'); }
        
        if (fields.length > 0) return { data: result, fields };
      }
    }
    
    // Fall back to search by name + company
    if (currentData.full_name || input.company_name) {
      const searchParams: Record<string, string> = {};
      if (currentData.full_name) searchParams.name = currentData.full_name;
      if (input.company_name || input.domain) searchParams.company = input.company_name || input.domain;
      
      const queryString = new URLSearchParams(searchParams).toString();
      const response = await fetchWithRetry(
        `https://api.contactout.com/v1/people/search?${queryString}`,
        {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const profiles = data.profiles || data.results || [];
        if (profiles.length > 0) {
          const person = profiles[0];
          const fields: string[] = [];
          const result: Partial<EnrichmentResult> = {};
          
          if (!currentData.email && person.emails?.length) { result.email = person.emails[0]; fields.push('email'); }
          if (!currentData.phone && person.phones?.length) { result.phone = person.phones[0]; fields.push('phone'); }
          if (!currentData.linkedin_url && person.linkedin_url) { result.linkedin_url = person.linkedin_url; fields.push('linkedin_url'); }
          if (!currentData.job_title && person.title) { result.job_title = person.title; fields.push('job_title'); }
          
          if (fields.length > 0) return { data: result, fields };
        }
      }
    }
  } catch (error) { console.error('ContactOut waterfall error:', error); }
  return { data: null, fields: [] };
}

// Clearbit/HubSpot enrichment (company data)
async function enrichWithClearbit(
  input: EnrichmentInput,
  currentData: Partial<EnrichmentResult>,
  apiKey: string
): Promise<{ data: Partial<EnrichmentResult> | null; fields: string[] }> {
  try {
    const response = await fetch(
      `https://company.clearbit.com/v2/companies/find?domain=${input.domain}`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    );
    if (!response.ok) return { data: null, fields: [] };
    
    const company = await response.json();
    const fields: string[] = [];
    const result: Partial<EnrichmentResult> = {};
    
    if (!currentData.company_name && company.name) { result.company_name = company.name; fields.push('company_name'); }
    if (!currentData.industry && company.category?.industry) { result.industry = company.category.industry; fields.push('industry'); }
    if (!currentData.employee_count && company.metrics?.employees) { result.employee_count = company.metrics.employees; fields.push('employee_count'); }
    if (!currentData.annual_revenue && company.metrics?.estimatedAnnualRevenue) {
      result.annual_revenue = parseInt(company.metrics.estimatedAnnualRevenue.replace(/[^0-9]/g, ''));
      fields.push('annual_revenue');
    }
    if (!currentData.company_linkedin_url && company.linkedin?.handle) {
      result.company_linkedin_url = `https://www.linkedin.com/company/${company.linkedin.handle}`;
      fields.push('company_linkedin_url');
    }
    if (!currentData.headquarters_city && company.geo?.city) { result.headquarters_city = company.geo.city; fields.push('headquarters_city'); }
    if (!currentData.headquarters_state && company.geo?.stateCode) { result.headquarters_state = company.geo.stateCode; fields.push('headquarters_state'); }
    
    return { data: result, fields };
  } catch (error) { console.error('Clearbit waterfall error:', error); }
  return { data: null, fields: [] };
}

// Google Search fallback via Firecrawl - scrape contact pages
async function enrichWithGoogleSearch(
  input: EnrichmentInput,
  currentData: Partial<EnrichmentResult>,
  apiKey: string
): Promise<{ data: Partial<EnrichmentResult> | null; fields: string[] }> {
  try {
    // Search for contact page on the domain
    const searchQuery = `site:${input.domain} contact OR about OR team`;
    
    const response = await fetchWithRetry(
      'https://api.firecrawl.dev/v1/search',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 3,
          scrapeOptions: { formats: ['markdown'] },
        }),
      }
    );
    
    if (!response.ok) return { data: null, fields: [] };
    const data = await response.json();
    
    if (data.success && data.data?.length) {
      const fields: string[] = [];
      const result: Partial<EnrichmentResult> = {};
      
      // Parse contact info from scraped content
      for (const page of data.data) {
        const content = page.markdown || page.content || '';
        
        // Extract email with regex
        if (!currentData.email && !result.email) {
          const emailMatch = content.match(/[\w.+-]+@[\w-]+\.[\w.]+/g);
          if (emailMatch) {
            // Filter out common non-person emails
            const personEmail = emailMatch.find((e: string) => 
              !e.includes('noreply') && !e.includes('info@') && !e.includes('support@') && 
              !e.includes('admin@') && !e.includes('webmaster@') && !e.includes('example')
            ) || emailMatch[0];
            if (personEmail && !personEmail.includes('example')) {
              result.email = personEmail;
              fields.push('email');
            }
          }
        }
        
        // Extract phone with regex
        if (!currentData.phone && !result.phone) {
          const phoneMatch = content.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g);
          if (phoneMatch) {
            result.phone = phoneMatch[0];
            fields.push('phone');
          }
        }
        
        // Extract LinkedIn URL
        if (!currentData.linkedin_url && !result.linkedin_url) {
          const linkedinMatch = content.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w-]+/);
          if (linkedinMatch) {
            result.linkedin_url = linkedinMatch[0];
            fields.push('linkedin_url');
          }
        }
      }
      
      if (fields.length > 0) return { data: result, fields };
    }
  } catch (error) { console.error('Google Search fallback error:', error); }
  return { data: null, fields: [] };
}

// ========== VALIDATION FUNCTIONS ==========

async function validateEmailWithZeroBounce(
  email: string,
  apiKey: string
): Promise<{ valid: boolean; status: string; sub_status?: string }> {
  try {
    const response = await fetchWithRetry(
      `https://api.zerobounce.net/v2/validate?api_key=${apiKey}&email=${encodeURIComponent(email)}`,
      { method: 'GET' }
    );
    if (!response.ok) return { valid: true, status: 'api_error' };
    const data = await response.json();
    const validStatuses = ['valid', 'catch-all'];
    return {
      valid: validStatuses.includes(data.status?.toLowerCase()),
      status: data.status || 'unknown',
      sub_status: data.sub_status,
    };
  } catch (error) {
    console.error('ZeroBounce validation error:', error);
    return { valid: true, status: 'validation_error' };
  }
}

async function validatePhoneWithTwilio(
  phone: string,
  accountSid: string,
  authToken: string
): Promise<{ valid: boolean; line_type: string | null; carrier: string | null }> {
  try {
    const cleanedPhone = phone.replace(/[^0-9+]/g, '');
    if (cleanedPhone.length < 10) return { valid: false, line_type: null, carrier: null };
    
    const response = await fetchWithRetry(
      `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(cleanedPhone)}?Fields=line_type_intelligence`,
      {
        method: 'GET',
        headers: { 'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}` },
      }
    );
    if (!response.ok) {
      if (response.status === 404) return { valid: false, line_type: null, carrier: null };
      return { valid: true, line_type: null, carrier: null };
    }
    const data = await response.json();
    const lineTypeInfo = data.line_type_intelligence || {};
    const lineType = lineTypeInfo.type || null;
    const carrier = lineTypeInfo.carrier_name || null;
    const validTypes = ['mobile', 'landline', 'fixedVoip', 'nonFixedVoip'];
    return {
      valid: data.valid !== false && (!lineType || validTypes.includes(lineType)),
      line_type: lineType,
      carrier,
    };
  } catch (error) {
    console.error('Twilio validation error:', error);
    return { valid: true, line_type: null, carrier: null };
  }
}

// ========== MAIN HANDLER ==========

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get all API keys
    const clayApiKey = Deno.env.get('CLAY_API_KEY');
    const apolloApiKey = Deno.env.get('APOLLO_API_KEY');
    const hunterApiKey = Deno.env.get('HUNTER_API_KEY');
    const pdlApiKey = Deno.env.get('PDL_API_KEY');
    const clearbitApiKey = Deno.env.get('CLEARBIT_API_KEY') || Deno.env.get('HUBSPOT_API_KEY');
    const snovioApiKey = Deno.env.get('SNOVIO_API_KEY');
    const rocketreachApiKey = Deno.env.get('ROCKETREACH_API_KEY');
    const lushaApiKey = Deno.env.get('LUSHA_API_KEY');
    const contactoutApiKey = Deno.env.get('CONTACTOUT_API_KEY');
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    
    const availableProviders: string[] = [];
    if (clayApiKey) availableProviders.push('clay');
    if (apolloApiKey) availableProviders.push('apollo');
    if (hunterApiKey) availableProviders.push('hunter');
    if (pdlApiKey) availableProviders.push('pdl');
    if (snovioApiKey) availableProviders.push('snovio');
    if (rocketreachApiKey) availableProviders.push('rocketreach');
    if (lushaApiKey) availableProviders.push('lusha');
    if (contactoutApiKey) availableProviders.push('contactout');
    if (clearbitApiKey) availableProviders.push('clearbit');
    if (firecrawlApiKey) availableProviders.push('google_search');
    
    if (availableProviders.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No enrichment providers configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const body = await req.json();
    const input: EnrichmentInput = body;
    
    if (!input.domain) {
      return new Response(
        JSON.stringify({ success: false, error: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Starting waterfall enrichment for ${input.domain}`);
    console.log(`Available providers: ${availableProviders.join(', ')}`);
    
    let result: Partial<EnrichmentResult> = {
      full_name: null, email: null, phone: null, mobile_phone: null, direct_phone: null,
      job_title: null, seniority_level: null, department: null, linkedin_url: null,
      company_name: null, company_linkedin_url: null, employee_count: null,
      annual_revenue: null, industry: null, founded_year: null,
      headquarters_city: null, headquarters_state: null,
      providers_used: [], waterfall_log: [],
    };
    
    const waterfallLog: WaterfallStep[] = [];

    // Helper to run a provider step
    async function runStep(
      providerName: string,
      apiKey: string | undefined,
      condition: boolean,
      fn: () => Promise<{ data: Partial<EnrichmentResult> | null; fields: string[] }>
    ) {
      if (!apiKey || !condition) return;
      const startTime = Date.now();
      const stepResult = await fn();
      const duration = Date.now() - startTime;
      
      waterfallLog.push({
        provider: providerName,
        success: !!stepResult.data,
        fields_found: stepResult.fields,
        fields_missing: getMissingFields({ ...result, ...stepResult.data }),
        duration_ms: duration,
      });
      
      if (stepResult.data) {
        // Only merge non-null fields (don't overwrite existing data)
        for (const [key, value] of Object.entries(stepResult.data)) {
          if (value !== null && value !== undefined && !(result as any)[key]) {
            (result as any)[key] = value;
          }
        }
        (result.providers_used as string[]).push(providerName);
      }
      console.log(`${providerName}: ${stepResult.fields.length} fields found`);
    }
    
    // Step 0: Clay (orchestrates 75+ providers internally)
    await runStep('clay', clayApiKey, !hasCompleteData(result),
      () => enrichWithClay(input, clayApiKey!));
    
    // Step 1: Apollo
    await runStep('apollo', apolloApiKey, !hasCompleteData(result),
      () => enrichWithApollo(input, apolloApiKey!));
    
    // Step 2: Hunter (if still missing email)
    await runStep('hunter', hunterApiKey, !result.email,
      () => enrichWithHunter(input, result, hunterApiKey!));
    
    // Step 3: PDL (if still missing data)
    await runStep('pdl', pdlApiKey, !hasCompleteData(result),
      () => enrichWithPDL(input, result, pdlApiKey!));
    
    // Step 4: Snov.io (if still missing email)
    await runStep('snovio', snovioApiKey, !result.email,
      () => enrichWithSnovio(input, result, snovioApiKey!));
    
    // Step 5: RocketReach (if still missing data)
    await runStep('rocketreach', rocketreachApiKey, !hasCompleteData(result),
      () => enrichWithRocketReach(input, result, rocketreachApiKey!));
    
    // Step 6: Lusha (if still missing phone or email)
    await runStep('lusha', lushaApiKey, !result.phone || !result.email,
      () => enrichWithLusha(input, result, lushaApiKey!));
    
    // Step 7: ContactOut (if still missing data, works best with LinkedIn)
    await runStep('contactout', contactoutApiKey, (!result.email || !result.phone) && !!result.linkedin_url,
      () => enrichWithContactOut(input, result, contactoutApiKey!));
    
    // Step 8: Clearbit (for company data if still missing)
    await runStep('clearbit', clearbitApiKey, !result.company_name || !result.industry || !result.employee_count,
      () => enrichWithClearbit(input, result, clearbitApiKey!));
    
    // Step 9: Google Search fallback (last resort for missing contact info)
    await runStep('google_search', firecrawlApiKey, !result.email || !result.phone,
      () => enrichWithGoogleSearch(input, result, firecrawlApiKey!));
    
    // Step 10: ZeroBounce email validation
    const zerobounceApiKey = Deno.env.get('ZEROBOUNCE_API_KEY');
    if (zerobounceApiKey && result.email) {
      const startTime = Date.now();
      const zbResult = await validateEmailWithZeroBounce(result.email, zerobounceApiKey);
      const duration = Date.now() - startTime;
      waterfallLog.push({
        provider: 'zerobounce', success: zbResult.valid,
        fields_found: zbResult.valid ? ['email_validated'] : [],
        fields_missing: [], duration_ms: duration,
      });
      if (zbResult.valid) {
        (result.providers_used as string[]).push('zerobounce');
        console.log(`ZeroBounce: Email validated - ${zbResult.status}`);
      } else {
        console.log(`ZeroBounce: Email invalid - ${zbResult.status}. Clearing email.`);
        result.email = null;
      }
    }
    
    // Step 11: Twilio phone validation
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    if (twilioAccountSid && twilioAuthToken && result.phone) {
      const startTime = Date.now();
      const twilioResult = await validatePhoneWithTwilio(result.phone, twilioAccountSid, twilioAuthToken);
      const duration = Date.now() - startTime;
      waterfallLog.push({
        provider: 'twilio', success: twilioResult.valid,
        fields_found: twilioResult.valid ? ['phone_validated', ...(twilioResult.line_type ? ['line_type'] : [])] : [],
        fields_missing: [], duration_ms: duration,
      });
      if (twilioResult.valid) {
        (result.providers_used as string[]).push('twilio');
        console.log(`Twilio: Phone validated - ${twilioResult.line_type || 'unknown type'}`);
      } else {
        console.log(`Twilio: Phone invalid. Clearing phone.`);
        result.phone = null;
      }
    }
    
    result.waterfall_log = waterfallLog;
    const finalResult = result as EnrichmentResult;
    const isComplete = hasCompleteData(result);
    
    console.log(`Waterfall complete. Providers used: ${finalResult.providers_used.join(', ')}. Complete: ${isComplete}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        data: finalResult,
        is_complete: isComplete,
        providers_used: finalResult.providers_used,
        waterfall_log: waterfallLog,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Waterfall enrichment error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Enrichment failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
