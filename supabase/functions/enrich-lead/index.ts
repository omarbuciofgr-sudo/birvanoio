import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

const enrichRequestSchema = z.object({
  lead_id: z.string().uuid().optional(),
  lead_ids: z.array(z.string().uuid()).max(50).optional(),
  enrich_company: z.boolean().optional().default(true),
  force_skip_trace: z.boolean().optional().default(false),
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

// Retry helper
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2, baseDelay = 1000): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status >= 400 && response.status < 500) return response;
      if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError || new Error('Fetch failed after retries');
}

function generateLinkedInSearchUrl(companyName?: string, name?: string, jobTitle?: string): string {
  const parts: string[] = [];
  if (name) parts.push(name);
  if (companyName) parts.push(companyName);
  if (jobTitle) parts.push(jobTitle);
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(parts.join(' '))}`;
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

// ========== REAL ESTATE DETECTION ==========

function isRealEstateLead(lead: any): boolean {
  const sourceType = lead.source_type || '';
  const leadType = lead.lead_type || '';
  const domain = lead.domain || '';
  const sourceUrl = lead.source_url || '';
  if (sourceType.includes('real_estate') || sourceType.includes('fsbo')) return true;
  if (leadType === 'fsbo' || leadType === 'frbo') return true;
  if (domain.includes('zillow-') || domain.includes('hotpads-') || domain.includes('apartments-') || domain.includes('redfin-') || domain.includes('trulia-') || domain.includes('realtor-')) return true;
  if (sourceUrl.includes('hotpads.com') || sourceUrl.includes('zillow.com') || sourceUrl.includes('apartments.com') || sourceUrl.includes('redfin.com') || sourceUrl.includes('trulia.com') || sourceUrl.includes('realtor.com')) return true;
  if (lead.address && (!domain || domain.includes('-'))) return true;
  return false;
}

function parseHotpadsAddressFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts.length === 0) return null;
    const slug = pathParts[0];
    if (slug.match(/^[a-z-]+-[a-z]{2}$/i)) return null;
    const cleanedSlug = slug.replace(/-[a-z0-9]{6,}$/i, '');
    const stateZipMatch = cleanedSlug.match(/^(.+?)-([a-z]{2})-(\d{5})$/i);
    if (stateZipMatch) {
      const [, addressPart, state, zip] = stateZipMatch;
      const streetSuffixes = ['ave', 'st', 'rd', 'dr', 'blvd', 'ln', 'way', 'ct', 'pl', 'cir', 'pkwy', 'ter'];
      let cityStartIndex = -1;
      const words = addressPart.split('-');
      for (let i = 0; i < words.length; i++) {
        if (streetSuffixes.includes(words[i].toLowerCase())) { cityStartIndex = i + 1; break; }
      }
      if (cityStartIndex > 0 && cityStartIndex < words.length) {
        const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
        const street = words.slice(0, cityStartIndex).map(capitalize).join(' ');
        const city = words.slice(cityStartIndex).map(capitalize).join(' ');
        return `${street}, ${city}, ${state.toUpperCase()} ${zip}`;
      }
    }
    const formattedAddress = cleanedSlug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    return formattedAddress || null;
  } catch { return null; }
}

function getAddressForSkipTrace(lead: any): string | null {
  if (lead.address) return lead.address;
  if (lead.schema_data?.address) return lead.schema_data.address;
  if (lead.schema_data?.full_address) return lead.schema_data.full_address;
  const sourceUrl = lead.source_url || '';
  if (sourceUrl.includes('hotpads.com')) {
    const parsed = parseHotpadsAddressFromUrl(sourceUrl);
    if (parsed) { console.log(`[EnrichLead] Parsed address from HotPads URL: ${parsed}`); return parsed; }
  }
  if (sourceUrl.includes('zillow.com') || sourceUrl.includes('apartments.com') || sourceUrl.includes('redfin.com') || sourceUrl.includes('trulia.com')) {
    try {
      const urlObj = new URL(sourceUrl);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      for (const part of pathParts) {
        if (part.match(/^\d+-[a-z-]+-[a-z]{2}-\d{5}$/i)) {
          const formatted = part.replace(/-([a-z]{2})-(\d{5})$/i, ', $1 $2').split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
          return formatted;
        }
      }
    } catch { /* ignore */ }
  }
  return null;
}

function parseAddressForSkipTrace(address: string): { street: string; city: string; state: string; zip: string } {
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 3) {
    const stateZip = parts[parts.length - 1].trim().split(/\s+/);
    return { street: parts[0], city: parts[1], state: stateZip[0] || '', zip: stateZip.length > 1 ? stateZip[stateZip.length - 1] : '' };
  }
  if (parts.length === 2) {
    const stateZipMatch = parts[1].match(/^(.+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
    if (stateZipMatch) return { street: parts[0], city: stateZipMatch[1].trim(), state: stateZipMatch[2].toUpperCase(), zip: stateZipMatch[3] };
  }
  return { street: address, city: '', state: '', zip: '' };
}

// ========== SKIP TRACE (Real Estate) ==========

async function enrichWithSkipTrace(address: string, batchDataApiKey?: string): Promise<EnrichmentResult | null> {
  const parsed = parseAddressForSkipTrace(address);
  if (!batchDataApiKey) return null;
  try {
    console.log('[SkipTrace-BatchData] Looking up:', address);
    const response = await fetch('https://api.batchdata.com/api/v1/property/skip-trace', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${batchDataApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ propertyAddress: { street: parsed.street, city: parsed.city, state: parsed.state, zip: parsed.zip } }] }),
    });
    if (response.ok) {
      const data = await response.json();
      const result = data.results?.success?.[0] || data.results?.[0];
      if (result) {
        const owner = result.people?.[0] || result.owner || {};
        const fieldsEnriched: string[] = [];
        const fullName = owner.fullName || owner.name || [owner.firstName, owner.lastName].filter(Boolean).join(' ');
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
  } catch (error) { console.error('[SkipTrace-BatchData] Error:', error); }
  return null;
}

// ========== B2B PROVIDER FUNCTIONS ==========

async function enrichWithApollo(domain: string, name?: string | null, apiKey?: string): Promise<EnrichmentResult | null> {
  if (!apiKey) return null;
  try {
    const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': apiKey },
      body: JSON.stringify({ q_organization_domains: domain, page: 1, per_page: 10 }),
    });
    const data = await response.json();
    if (data.people?.length) {
      const priorityTitles = ['owner', 'ceo', 'founder', 'president', 'director', 'manager'];
      let bestMatch = data.people[0];
      for (const person of data.people) {
        const title = (person.title || '').toLowerCase();
        if (priorityTitles.some(pt => title.includes(pt))) { bestMatch = person; break; }
      }
      const fieldsEnriched: string[] = [];
      const org = bestMatch.organization || {};
      if (bestMatch.name) fieldsEnriched.push('full_name');
      if (bestMatch.email) fieldsEnriched.push('email');
      if (bestMatch.phone_numbers?.[0]) fieldsEnriched.push('phone');
      if (org.name) fieldsEnriched.push('company_name');
      if (bestMatch.title) { fieldsEnriched.push('job_title', 'seniority_level', 'department'); }
      if (bestMatch.linkedin_url) fieldsEnriched.push('linkedin_url');
      if (org.estimated_num_employees) fieldsEnriched.push('employee_count');
      if (org.annual_revenue) fieldsEnriched.push('annual_revenue');
      if (org.founded_year) fieldsEnriched.push('founded_year');
      if (org.industry) fieldsEnriched.push('industry');
      const directPhone = bestMatch.phone_numbers?.find((p: any) => p.type === 'direct_dial')?.number;
      const mobilePhone = bestMatch.phone_numbers?.find((p: any) => p.type === 'mobile')?.number;
      return {
        full_name: bestMatch.name, email: bestMatch.email, phone: bestMatch.phone_numbers?.[0]?.number,
        direct_phone: directPhone, mobile_phone: mobilePhone, company_name: org.name,
        job_title: bestMatch.title, seniority_level: bestMatch.seniority || mapSeniorityLevel(bestMatch.title),
        department: bestMatch.departments?.[0] || mapDepartment(bestMatch.title),
        linkedin_url: bestMatch.linkedin_url, company_linkedin_url: org.linkedin_url,
        company_website: org.website_url, employee_count: org.estimated_num_employees,
        employee_range: org.employee_count_range, annual_revenue: org.annual_revenue,
        revenue_range: org.revenue_range, funding_total: org.total_funding,
        funding_stage: org.latest_funding_stage, founded_year: org.founded_year,
        industry: org.industry, company_description: org.short_description,
        technologies: org.technologies?.slice(0, 20), headquarters_city: org.city,
        headquarters_state: org.state, headquarters_country: org.country,
        provider: 'apollo', fields_enriched: fieldsEnriched,
      };
    }
    return null;
  } catch (error) { console.error('Apollo enrichment error:', error); return null; }
}

async function findEmailWithHunter(domain: string, firstName?: string, lastName?: string, apiKey?: string): Promise<EnrichmentResult | null> {
  if (!apiKey) return null;
  try {
    if (firstName && lastName) {
      const response = await fetch(`https://api.hunter.io/v2/email-finder?domain=${domain}&first_name=${firstName}&last_name=${lastName}&api_key=${apiKey}`);
      const data = await response.json();
      if (data.data?.email) return { email: data.data.email, provider: 'hunter', fields_enriched: ['email'] };
    }
    const response = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${apiKey}&limit=5`);
    const data = await response.json();
    if (data.data?.emails?.[0]) {
      const bestEmail = data.data.emails[0];
      const fieldsEnriched: string[] = ['email'];
      const result: EnrichmentResult = { email: bestEmail.value, provider: 'hunter', fields_enriched: fieldsEnriched };
      if (bestEmail.first_name && bestEmail.last_name) { result.full_name = `${bestEmail.first_name} ${bestEmail.last_name}`; fieldsEnriched.push('full_name'); }
      if (bestEmail.position) { result.job_title = bestEmail.position; result.seniority_level = mapSeniorityLevel(bestEmail.position); result.department = mapDepartment(bestEmail.position); fieldsEnriched.push('job_title', 'seniority_level', 'department'); }
      if (bestEmail.linkedin) { result.linkedin_url = bestEmail.linkedin; fieldsEnriched.push('linkedin_url'); }
      return result;
    }
    return null;
  } catch (error) { console.error('Hunter enrichment error:', error); return null; }
}

async function enrichWithPDL(email?: string, name?: string, domain?: string, apiKey?: string): Promise<EnrichmentResult | null> {
  if (!apiKey || (!email && !name)) return null;
  try {
    const params: Record<string, string> = {};
    if (email) params.email = email;
    if (name) params.name = name;
    if (domain) params.company = domain;
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${queryString}`, {
      headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    });
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
        full_name: person.full_name, email: person.work_email || person.personal_emails?.[0],
        phone: person.phone_numbers?.[0], mobile_phone: person.mobile_phone,
        company_name: person.job_company_name, job_title: person.job_title,
        seniority_level: person.job_title_levels?.[0] || mapSeniorityLevel(person.job_title),
        department: person.job_title_sub_role || mapDepartment(person.job_title),
        linkedin_url: person.linkedin_url, company_linkedin_url: person.job_company_linkedin_url,
        company_website: person.job_company_website, employee_range: person.job_company_size,
        industry: person.job_company_industry, headquarters_city: person.job_company_location_locality,
        headquarters_state: person.job_company_location_region, headquarters_country: person.job_company_location_country,
        provider: 'pdl', fields_enriched: fieldsEnriched,
      };
    }
    return null;
  } catch (error) { console.error('PDL enrichment error:', error); return null; }
}

// Snov.io - email finder
async function enrichWithSnovio(domain: string, name?: string | null, apiKey?: string): Promise<EnrichmentResult | null> {
  if (!apiKey) return null;
  try {
    // Try email finder if we have a name
    if (name) {
      const nameParts = name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      const response = await fetchWithRetry('https://api.snov.io/v1/get-emails-from-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: apiKey, domain, firstName, lastName }),
      });
      const data = await response.json();
      if (data.success && data.data?.emails?.length) {
        return { email: data.data.emails[0].email, provider: 'snovio', fields_enriched: ['email'] };
      }
    }
    // Fall back to domain search
    const response = await fetchWithRetry(
      `https://api.snov.io/v2/domain-emails-with-info?domain=${domain}&type=all&limit=5`,
      { method: 'GET', headers: { 'Authorization': `Bearer ${apiKey}` } }
    );
    const data = await response.json();
    if (data.success && data.data?.emails?.length) {
      const best = data.data.emails[0];
      const fieldsEnriched: string[] = [];
      const result: EnrichmentResult = { provider: 'snovio', fields_enriched: fieldsEnriched };
      if (best.email) { result.email = best.email; fieldsEnriched.push('email'); }
      if (best.firstName && best.lastName) { result.full_name = `${best.firstName} ${best.lastName}`; fieldsEnriched.push('full_name'); }
      if (best.position) { result.job_title = best.position; fieldsEnriched.push('job_title'); }
      if (fieldsEnriched.length > 0) return result;
    }
    return null;
  } catch (error) { console.error('Snov.io enrichment error:', error); return null; }
}

// RocketReach - full POC lookup
async function enrichWithRocketReach(domain: string, name?: string | null, apiKey?: string): Promise<EnrichmentResult | null> {
  if (!apiKey) return null;
  try {
    const searchBody: Record<string, unknown> = { current_employer: domain, page_size: 5 };
    if (name) searchBody.name = name;
    const response = await fetchWithRetry('https://api.rocketreach.co/api/v2/person/search', {
      method: 'POST',
      headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody),
    });
    const data = await response.json();
    if (data.profiles?.length) {
      const profile = data.profiles[0];
      const fieldsEnriched: string[] = [];
      const result: EnrichmentResult = { provider: 'rocketreach', fields_enriched: fieldsEnriched };
      if (profile.name) { result.full_name = profile.name; fieldsEnriched.push('full_name'); }
      if (profile.current_work_email) { result.email = profile.current_work_email; fieldsEnriched.push('email'); }
      else if (profile.emails?.length) { result.email = profile.emails[0]; fieldsEnriched.push('email'); }
      if (profile.phones?.length) {
        result.phone = typeof profile.phones[0] === 'object' ? profile.phones[0].number : profile.phones[0];
        fieldsEnriched.push('phone');
      }
      if (profile.current_title) { result.job_title = profile.current_title; fieldsEnriched.push('job_title'); }
      if (profile.linkedin_url) { result.linkedin_url = profile.linkedin_url; fieldsEnriched.push('linkedin_url'); }
      if (profile.current_employer) { result.company_name = profile.current_employer; fieldsEnriched.push('company_name'); }
      if (fieldsEnriched.length > 0) return result;
    }
    return null;
  } catch (error) { console.error('RocketReach enrichment error:', error); return null; }
}

// Lusha - direct dials + verified emails
async function enrichWithLusha(domain: string, name?: string | null, linkedinUrl?: string | null, apiKey?: string): Promise<EnrichmentResult | null> {
  if (!apiKey) return null;
  try {
    const params: Record<string, string> = {};
    if (domain) params.company = domain;
    if (name) { const nameParts = name.split(' '); params.firstName = nameParts[0]; params.lastName = nameParts[nameParts.length - 1]; }
    if (linkedinUrl) params.linkedinUrl = linkedinUrl;
    const queryString = new URLSearchParams(params).toString();
    const response = await fetchWithRetry(`https://api.lusha.com/person?${queryString}`, {
      method: 'GET',
      headers: { 'api_key': apiKey, 'Content-Type': 'application/json' },
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data) {
      const fieldsEnriched: string[] = [];
      const result: EnrichmentResult = { provider: 'lusha', fields_enriched: fieldsEnriched };
      if (data.firstName && data.lastName) { result.full_name = `${data.firstName} ${data.lastName}`; fieldsEnriched.push('full_name'); }
      if (data.emailAddresses?.length) { result.email = data.emailAddresses[0].email; fieldsEnriched.push('email'); }
      if (data.phoneNumbers?.length) {
        const directDial = data.phoneNumbers.find((p: any) => p.type === 'direct') || data.phoneNumbers[0];
        result.phone = directDial.internationalNumber || directDial.number;
        fieldsEnriched.push('phone');
        if (directDial.type === 'direct') { result.direct_phone = result.phone; fieldsEnriched.push('direct_phone'); }
      }
      if (data.jobTitle) { result.job_title = data.jobTitle; fieldsEnriched.push('job_title'); }
      if (data.company?.name) { result.company_name = data.company.name; fieldsEnriched.push('company_name'); }
      if (fieldsEnriched.length > 0) return result;
    }
    return null;
  } catch (error) { console.error('Lusha enrichment error:', error); return null; }
}

// ContactOut - LinkedIn-based email/phone
async function enrichWithContactOut(domain: string, name?: string | null, linkedinUrl?: string | null, apiKey?: string): Promise<EnrichmentResult | null> {
  if (!apiKey) return null;
  try {
    // Best with LinkedIn URL
    if (linkedinUrl) {
      const response = await fetchWithRetry(
        `https://api.contactout.com/v1/people/linkedin?linkedin_url=${encodeURIComponent(linkedinUrl)}`,
        { method: 'GET', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
      );
      if (response.ok) {
        const data = await response.json();
        const person = data.profile || data;
        const fieldsEnriched: string[] = [];
        const result: EnrichmentResult = { provider: 'contactout', fields_enriched: fieldsEnriched };
        if (person.emails?.length) { result.email = person.emails[0]; fieldsEnriched.push('email'); }
        if (person.phones?.length) { result.phone = person.phones[0]; fieldsEnriched.push('phone'); }
        if (person.name) { result.full_name = person.name; fieldsEnriched.push('full_name'); }
        if (person.title) { result.job_title = person.title; fieldsEnriched.push('job_title'); }
        if (fieldsEnriched.length > 0) return result;
      }
    }
    // Fall back to search
    if (name || domain) {
      const searchParams: Record<string, string> = {};
      if (name) searchParams.name = name;
      if (domain) searchParams.company = domain;
      const queryString = new URLSearchParams(searchParams).toString();
      const response = await fetchWithRetry(
        `https://api.contactout.com/v1/people/search?${queryString}`,
        { method: 'GET', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
      );
      if (response.ok) {
        const data = await response.json();
        const profiles = data.profiles || data.results || [];
        if (profiles.length > 0) {
          const person = profiles[0];
          const fieldsEnriched: string[] = [];
          const result: EnrichmentResult = { provider: 'contactout', fields_enriched: fieldsEnriched };
          if (person.emails?.length) { result.email = person.emails[0]; fieldsEnriched.push('email'); }
          if (person.phones?.length) { result.phone = person.phones[0]; fieldsEnriched.push('phone'); }
          if (person.linkedin_url) { result.linkedin_url = person.linkedin_url; fieldsEnriched.push('linkedin_url'); }
          if (person.title) { result.job_title = person.title; fieldsEnriched.push('job_title'); }
          if (fieldsEnriched.length > 0) return result;
        }
      }
    }
    return null;
  } catch (error) { console.error('ContactOut enrichment error:', error); return null; }
}

// Clearbit/HubSpot - company enrichment
async function enrichWithClearbit(domain: string, apiKey?: string): Promise<EnrichmentResult | null> {
  if (!apiKey) return null;
  try {
    const response = await fetch(`https://company.clearbit.com/v2/companies/find?domain=${domain}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!response.ok) return null;
    const company = await response.json();
    const fieldsEnriched: string[] = [];
    const result: EnrichmentResult = { provider: 'clearbit', fields_enriched: fieldsEnriched };
    if (company.name) { result.company_name = company.name; fieldsEnriched.push('company_name'); }
    if (company.category?.industry) { result.industry = company.category.industry; fieldsEnriched.push('industry'); }
    if (company.metrics?.employees) { result.employee_count = company.metrics.employees; fieldsEnriched.push('employee_count'); }
    if (company.metrics?.estimatedAnnualRevenue) { result.annual_revenue = parseInt(company.metrics.estimatedAnnualRevenue.replace(/[^0-9]/g, '')); fieldsEnriched.push('annual_revenue'); }
    if (company.linkedin?.handle) { result.company_linkedin_url = `https://www.linkedin.com/company/${company.linkedin.handle}`; fieldsEnriched.push('company_linkedin_url'); }
    if (company.geo?.city) { result.headquarters_city = company.geo.city; fieldsEnriched.push('headquarters_city'); }
    if (company.geo?.stateCode) { result.headquarters_state = company.geo.stateCode; fieldsEnriched.push('headquarters_state'); }
    if (fieldsEnriched.length > 0) return result;
    return null;
  } catch (error) { console.error('Clearbit enrichment error:', error); return null; }
}

// Google Search fallback via Firecrawl
async function enrichWithGoogleSearch(domain: string, apiKey?: string): Promise<EnrichmentResult | null> {
  if (!apiKey) return null;
  try {
    const response = await fetchWithRetry('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `site:${domain} contact OR about OR team`, limit: 3, scrapeOptions: { formats: ['markdown'] } }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.success && data.data?.length) {
      const fieldsEnriched: string[] = [];
      const result: EnrichmentResult = { provider: 'google_search', fields_enriched: fieldsEnriched };
      for (const page of data.data) {
        const content = page.markdown || page.content || '';
        if (!result.email) {
          const emailMatch = content.match(/[\w.+-]+@[\w-]+\.[\w.]+/g);
          if (emailMatch) {
            const personEmail = emailMatch.find((e: string) => !e.includes('noreply') && !e.includes('info@') && !e.includes('support@') && !e.includes('admin@') && !e.includes('webmaster@') && !e.includes('example')) || emailMatch[0];
            if (personEmail && !personEmail.includes('example')) { result.email = personEmail; fieldsEnriched.push('email'); }
          }
        }
        if (!result.phone) {
          const phoneMatch = content.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g);
          if (phoneMatch) { result.phone = phoneMatch[0]; fieldsEnriched.push('phone'); }
        }
        if (!result.linkedin_url) {
          const linkedinMatch = content.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w-]+/);
          if (linkedinMatch) { result.linkedin_url = linkedinMatch[0]; fieldsEnriched.push('linkedin_url'); }
        }
      }
      if (fieldsEnriched.length > 0) return result;
    }
    return null;
  } catch (error) { console.error('Google Search fallback error:', error); return null; }
}

// ========== MAIN HANDLER ==========

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    const requestedHeaders = req.headers.get('access-control-request-headers');
    return new Response(null, {
      headers: { ...corsHeaders, ...(requestedHeaders ? { 'Access-Control-Allow-Headers': requestedHeaders } : {}) },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  // All API keys
  const apolloApiKey = Deno.env.get('APOLLO_API_KEY');
  const hunterApiKey = Deno.env.get('HUNTER_API_KEY');
  const pdlApiKey = Deno.env.get('PDL_API_KEY');
  const batchDataApiKey = Deno.env.get('BATCHDATA_API_KEY');
  const snovioApiKey = Deno.env.get('SNOVIO_API_KEY');
  const rocketreachApiKey = Deno.env.get('ROCKETREACH_API_KEY');
  const lushaApiKey = Deno.env.get('LUSHA_API_KEY');
  const contactoutApiKey = Deno.env.get('CONTACTOUT_API_KEY');
  const clearbitApiKey = Deno.env.get('CLEARBIT_API_KEY') || Deno.env.get('HUBSPOT_API_KEY');
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

  // Authentication check
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data: { user }, error: userError } = await authSupabase.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid authentication' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const userId = user.id;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: hasAdminRole } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
  if (!hasAdminRole) {
    return new Response(JSON.stringify({ error: 'Admin access required' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parseResult = enrichRequestSchema.safeParse(body);
    
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request format', validation_errors: parseResult.error.errors.map(e => e.message) }),
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

      const needsName = !lead.full_name;
      const needsEmail = !lead.best_email;
      const needsPhone = !lead.best_phone;

      console.log(`Lead ${leadId}: isRealEstate=${isRealEstateLead(lead)}, needsName=${needsName}, needsEmail=${needsEmail}, needsPhone=${needsPhone}`);

      if (isRealEstateLead(lead)) {
        // ========== REAL ESTATE ENRICHMENT ==========
        // Phase 1: Skip trace (primary for real estate)
        console.log(`[RealEstate] Using skip trace for lead ${leadId}`);
        const addressForSkipTrace = getAddressForSkipTrace(lead);
        
        if (addressForSkipTrace && (needsName || needsEmail || needsPhone || force_skip_trace)) {
          console.log(`[SkipTrace] Using address: ${addressForSkipTrace}`);
          if (!lead.address && addressForSkipTrace) updates.address = addressForSkipTrace;
          
          const skipTraceResult = await enrichWithSkipTrace(addressForSkipTrace, batchDataApiKey);
          if (skipTraceResult) {
            enrichments.push(skipTraceResult);
            providersUsed.push(skipTraceResult.provider);
            if (skipTraceResult.full_name && needsName) updates.full_name = skipTraceResult.full_name;
            if (skipTraceResult.email && needsEmail) {
              updates.best_email = skipTraceResult.email;
              const allEmails = lead.all_emails || [];
              if (!allEmails.includes(skipTraceResult.email)) updates.all_emails = [...allEmails, skipTraceResult.email];
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
          console.log(`[SkipTrace] No address available for lead ${leadId}`);
        }

        // Phase 2: B2B waterfall fallback if skip trace left gaps
        const stillNeedsNameRE = !lead.full_name && !updates.full_name;
        const stillNeedsEmailRE = !lead.best_email && !updates.best_email;
        const stillNeedsPhoneRE = !lead.best_phone && !updates.best_phone;

        if (stillNeedsNameRE || stillNeedsEmailRE || stillNeedsPhoneRE) {
          // Try to find a domain to use for B2B lookups
          let reDomain = lead.domain;
          if (!reDomain || reDomain.includes('-')) {
            // Real estate domains are often address slugs, try source_url or website
            const sourceUrl = lead.source_url || lead.schema_data?.website || '';
            try {
              const url = new URL(typeof sourceUrl === 'string' && sourceUrl.startsWith('http') ? sourceUrl : `https://${sourceUrl}`);
              const host = url.hostname.replace('www.', '');
              // Only use if it's a real company domain, not a listing platform
              const platformDomains = ['zillow.com', 'hotpads.com', 'apartments.com', 'redfin.com', 'trulia.com', 'realtor.com', 'craigslist.org'];
              if (!platformDomains.some(pd => host.includes(pd))) {
                reDomain = host;
              }
            } catch { /* ignore */ }
          }

          // If we have a person name from skip trace, try B2B providers to find their email/phone
          const personName = (updates.full_name as string) || lead.full_name;
          
          if (reDomain || personName) {
            console.log(`[RealEstate-B2B] Running B2B fallback. domain=${reDomain}, name=${personName}, needsEmail=${stillNeedsEmailRE}, needsPhone=${stillNeedsPhoneRE}`);

            const applyResult = (r: EnrichmentResult) => {
              enrichments.push(r);
              providersUsed.push(r.provider);
              if (r.full_name && !updates.full_name && !lead.full_name) updates.full_name = r.full_name;
              if (r.email && !updates.best_email && !lead.best_email) {
                updates.best_email = r.email;
                const allEmails = lead.all_emails || (updates.all_emails as string[]) || [];
                if (!allEmails.includes(r.email)) updates.all_emails = [...allEmails, r.email];
              }
              if ((r.phone || r.direct_phone || r.mobile_phone) && !updates.best_phone && !lead.best_phone) {
                updates.best_phone = r.direct_phone || r.mobile_phone || r.phone;
                const allPhones = lead.all_phones || (updates.all_phones as string[]) || [];
                const newPhones = [r.phone, r.direct_phone, r.mobile_phone].filter(Boolean) as string[];
                updates.all_phones = [...new Set([...allPhones, ...newPhones])];
              }
              if (r.linkedin_url && !updates.linkedin_search_url) updates.linkedin_search_url = r.linkedin_url;
              if (r.job_title && !updates.job_title) updates.job_title = r.job_title;
            };

            const hasCompleteRE = () => !!(updates.full_name || lead.full_name) && !!(updates.best_email || lead.best_email) && !!(updates.best_phone || lead.best_phone);
            const reNeedsEmail = () => !updates.best_email && !lead.best_email;
            const reNeedsPhone = () => !updates.best_phone && !lead.best_phone;
            const currentNameRE = () => (updates.full_name as string) || lead.full_name;
            const currentLinkedInRE = () => (updates.linkedin_search_url as string) || lead.linkedin_search_url;

            // Run providers in priority order, stop when complete
            if (reDomain) {
              if (apolloApiKey && !hasCompleteRE()) {
                const r = await enrichWithApollo(reDomain, personName, apolloApiKey);
                if (r) applyResult(r);
              }
              if (hunterApiKey && reNeedsEmail()) {
                const nameParts = currentNameRE()?.split(' ') || [];
                const r = await findEmailWithHunter(reDomain, nameParts[0], nameParts.slice(1).join(' ') || undefined, hunterApiKey);
                if (r) applyResult(r);
              }
              if (pdlApiKey && !hasCompleteRE()) {
                const r = await enrichWithPDL((updates.best_email as string) || lead.best_email, currentNameRE(), reDomain, pdlApiKey);
                if (r) applyResult(r);
              }
              if (snovioApiKey && reNeedsEmail()) {
                const r = await enrichWithSnovio(reDomain, currentNameRE(), snovioApiKey);
                if (r) applyResult(r);
              }
              if (rocketreachApiKey && !hasCompleteRE()) {
                const r = await enrichWithRocketReach(reDomain, currentNameRE(), rocketreachApiKey);
                if (r) applyResult(r);
              }
              if (lushaApiKey && (reNeedsEmail() || reNeedsPhone())) {
                const r = await enrichWithLusha(reDomain, currentNameRE(), currentLinkedInRE(), lushaApiKey);
                if (r) applyResult(r);
              }
              if (contactoutApiKey && (reNeedsEmail() || reNeedsPhone())) {
                const r = await enrichWithContactOut(reDomain, currentNameRE(), currentLinkedInRE(), contactoutApiKey);
                if (r) applyResult(r);
              }
              if (firecrawlApiKey && (reNeedsEmail() || reNeedsPhone())) {
                const r = await enrichWithGoogleSearch(reDomain, firecrawlApiKey);
                if (r) applyResult(r);
              }
            }
          }
        }
      } else {
        // ========== B2B ENRICHMENT - FULL 9-PROVIDER WATERFALL ==========
        console.log(`[B2B] Using full waterfall for lead ${leadId}`);
        
        let domain = lead.domain;
        if (!domain || domain.includes('-')) {
          const sourceUrl = lead.source_url || '';
          try {
            const url = new URL(sourceUrl.startsWith('http') ? sourceUrl : `https://${sourceUrl}`);
            domain = url.hostname.replace('www.', '');
          } catch { domain = null; }
        }

        if (domain && (needsName || needsEmail || needsPhone)) {
          // Helper to apply enrichment result
          const applyResult = (r: EnrichmentResult) => {
            enrichments.push(r);
            providersUsed.push(r.provider);
            if (r.full_name && !updates.full_name && needsName) updates.full_name = r.full_name;
            if (r.email && !updates.best_email && needsEmail) {
              updates.best_email = r.email;
              const allEmails = lead.all_emails || [];
              if (!allEmails.includes(r.email)) updates.all_emails = [...allEmails, r.email];
            }
            if ((r.phone || r.direct_phone || r.mobile_phone) && !updates.best_phone && needsPhone) {
              updates.best_phone = r.direct_phone || r.mobile_phone || r.phone;
              const allPhones = lead.all_phones || [];
              const newPhones = [r.phone, r.direct_phone, r.mobile_phone].filter(Boolean) as string[];
              updates.all_phones = [...new Set([...allPhones, ...newPhones])];
            }
            if (r.linkedin_url && !updates.linkedin_search_url) updates.linkedin_search_url = r.linkedin_url;
            if (r.job_title && !updates.job_title) updates.job_title = r.job_title;
            if (r.company_name && !updates.company_name) updates.company_name = r.company_name;
          };

          const hasComplete = () => !!(updates.full_name || lead.full_name) && !!(updates.best_email || lead.best_email) && !!(updates.best_phone || lead.best_phone);
          const stillNeedsEmail = () => !updates.best_email && needsEmail;
          const stillNeedsPhone = () => !updates.best_phone && needsPhone;
          const currentName = () => (updates.full_name as string) || lead.full_name;
          const currentLinkedIn = () => (updates.linkedin_search_url as string) || lead.linkedin_search_url;

          // 1. Apollo
          if (apolloApiKey && !hasComplete()) {
            const r = await enrichWithApollo(domain, lead.full_name, apolloApiKey);
            if (r) applyResult(r);
          }

          // 2. Hunter (if still missing email)
          if (hunterApiKey && stillNeedsEmail()) {
            const nameParts = currentName()?.split(' ') || [];
            const r = await findEmailWithHunter(domain, nameParts[0], nameParts.slice(1).join(' ') || undefined, hunterApiKey);
            if (r) applyResult(r);
          }

          // 3. PDL (if still missing data)
          if (pdlApiKey && !hasComplete()) {
            const r = await enrichWithPDL(
              (updates.best_email as string) || lead.best_email,
              currentName(),
              domain,
              pdlApiKey
            );
            if (r) applyResult(r);
          }

          // 4. Snov.io (if still missing email)
          if (snovioApiKey && stillNeedsEmail()) {
            const r = await enrichWithSnovio(domain, currentName(), snovioApiKey);
            if (r) applyResult(r);
          }

          // 5. RocketReach (if still missing data)
          if (rocketreachApiKey && !hasComplete()) {
            const r = await enrichWithRocketReach(domain, currentName(), rocketreachApiKey);
            if (r) applyResult(r);
          }

          // 6. Lusha (if still missing phone or email)
          if (lushaApiKey && (stillNeedsEmail() || stillNeedsPhone())) {
            const r = await enrichWithLusha(domain, currentName(), currentLinkedIn(), lushaApiKey);
            if (r) applyResult(r);
          }

          // 7. ContactOut (if still missing data and have LinkedIn)
          if (contactoutApiKey && (stillNeedsEmail() || stillNeedsPhone())) {
            const r = await enrichWithContactOut(domain, currentName(), currentLinkedIn(), contactoutApiKey);
            if (r) applyResult(r);
          }

          // 8. Clearbit (for company data)
          if (clearbitApiKey && enrich_company) {
            const r = await enrichWithClearbit(domain, clearbitApiKey);
            if (r) applyResult(r);
          }

          // 9. Google Search fallback (last resort)
          if (firecrawlApiKey && (stillNeedsEmail() || stillNeedsPhone())) {
            const r = await enrichWithGoogleSearch(domain, firecrawlApiKey);
            if (r) applyResult(r);
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

        let newScore = lead.confidence_score || 30;
        if (updates.best_email) newScore += 15;
        if (updates.best_phone) newScore += 10;
        if (updates.full_name) newScore += 10;
        updates.confidence_score = Math.min(100, newScore);
      }

      // Apply updates
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase.from('scraped_leads').update(updates).eq('id', leadId);
        if (updateError) console.error(`Error updating lead ${leadId}:`, updateError);
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
