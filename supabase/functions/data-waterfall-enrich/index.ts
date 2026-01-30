import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      
      // Don't retry on 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        return response;
      }
      
      // Retry on 5xx errors
      if (response.status >= 500) {
        throw new Error(`HTTP ${response.status}`);
      }
      
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
 * Order: Apollo → Hunter → PDL → Clearbit
 * 
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

// Check what fields are still missing
function getMissingFields(result: Partial<EnrichmentResult>): string[] {
  const requiredFields = ['full_name', 'email', 'phone'];
  const niceToHave = ['job_title', 'linkedin_url', 'company_name'];
  
  const missing: string[] = [];
  for (const field of [...requiredFields, ...niceToHave]) {
    if (!result[field as keyof EnrichmentResult]) {
      missing.push(field);
    }
  }
  return missing;
}

// Check if we have complete core data
function hasCompleteData(result: Partial<EnrichmentResult>): boolean {
  return !!(result.full_name && result.email && result.phone);
}

// Apollo enrichment
async function enrichWithApollo(
  input: EnrichmentInput,
  apiKey: string
): Promise<{ data: Partial<EnrichmentResult> | null; fields: string[] }> {
  try {
    const searchBody: Record<string, unknown> = {
      api_key: apiKey,
      q_organization_domains: input.domain,
      page: 1,
      per_page: 5,
    };
    
    if (input.target_titles?.length) {
      searchBody.person_titles = input.target_titles;
    }
    
    const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody),
    });
    
    const data = await response.json();
    
    if (data.people?.length) {
      // Find best match (prefer owner/CEO)
      const priorityTitles = ['owner', 'ceo', 'founder', 'president'];
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
  } catch (error) {
    console.error('Apollo waterfall error:', error);
  }
  
  return { data: null, fields: [] };
}

// Hunter enrichment
async function enrichWithHunter(
  input: EnrichmentInput,
  currentData: Partial<EnrichmentResult>,
  apiKey: string
): Promise<{ data: Partial<EnrichmentResult> | null; fields: string[] }> {
  try {
    // If we have a name, try email finder
    if (currentData.full_name) {
      const nameParts = currentData.full_name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      
      const response = await fetch(
        `https://api.hunter.io/v2/email-finder?domain=${input.domain}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&api_key=${apiKey}`
      );
      const data = await response.json();
      
      if (data.data?.email) {
        return {
          data: { email: data.data.email },
          fields: ['email'],
        };
      }
    }
    
    // Fall back to domain search
    const response = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${input.domain}&api_key=${apiKey}&limit=5`
    );
    const data = await response.json();
    
    if (data.data?.emails?.[0]) {
      const bestEmail = data.data.emails[0];
      const fields: string[] = ['email'];
      
      const result: Partial<EnrichmentResult> = {
        email: bestEmail.value,
      };
      
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
  } catch (error) {
    console.error('Hunter waterfall error:', error);
  }
  
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
    
    if (Object.keys(params).length === 0) {
      return { data: null, fields: [] };
    }
    
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
    
    if (!response.ok) return { data: null, fields: [] };
    
    const data = await response.json();
    
    if (data.status === 200 && data.data) {
      const person = data.data;
      const fields: string[] = [];
      const result: Partial<EnrichmentResult> = {};
      
      if (!currentData.full_name && person.full_name) {
        result.full_name = person.full_name;
        fields.push('full_name');
      }
      if (!currentData.email && (person.work_email || person.personal_emails?.[0])) {
        result.email = person.work_email || person.personal_emails[0];
        fields.push('email');
      }
      if (!currentData.phone && person.phone_numbers?.[0]) {
        result.phone = person.phone_numbers[0];
        fields.push('phone');
      }
      if (!currentData.mobile_phone && person.mobile_phone) {
        result.mobile_phone = person.mobile_phone;
        fields.push('mobile_phone');
      }
      if (!currentData.job_title && person.job_title) {
        result.job_title = person.job_title;
        fields.push('job_title');
      }
      if (!currentData.linkedin_url && person.linkedin_url) {
        result.linkedin_url = person.linkedin_url;
        fields.push('linkedin_url');
      }
      if (!currentData.company_name && person.job_company_name) {
        result.company_name = person.job_company_name;
        fields.push('company_name');
      }
      if (!currentData.industry && person.job_company_industry) {
        result.industry = person.job_company_industry;
        fields.push('industry');
      }
      
      return { data: result, fields };
    }
  } catch (error) {
    console.error('PDL waterfall error:', error);
  }
  
  return { data: null, fields: [] };
}

// Clearbit enrichment (if API key available)
async function enrichWithClearbit(
  input: EnrichmentInput,
  currentData: Partial<EnrichmentResult>,
  apiKey: string
): Promise<{ data: Partial<EnrichmentResult> | null; fields: string[] }> {
  try {
    // Try company lookup first
    const response = await fetch(
      `https://company.clearbit.com/v2/companies/find?domain=${input.domain}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );
    
    if (!response.ok) return { data: null, fields: [] };
    
    const company = await response.json();
    const fields: string[] = [];
    const result: Partial<EnrichmentResult> = {};
    
    if (!currentData.company_name && company.name) {
      result.company_name = company.name;
      fields.push('company_name');
    }
    if (!currentData.industry && company.category?.industry) {
      result.industry = company.category.industry;
      fields.push('industry');
    }
    if (!currentData.employee_count && company.metrics?.employees) {
      result.employee_count = company.metrics.employees;
      fields.push('employee_count');
    }
    if (!currentData.annual_revenue && company.metrics?.estimatedAnnualRevenue) {
      result.annual_revenue = parseInt(company.metrics.estimatedAnnualRevenue.replace(/[^0-9]/g, ''));
      fields.push('annual_revenue');
    }
    if (!currentData.company_linkedin_url && company.linkedin?.handle) {
      result.company_linkedin_url = `https://www.linkedin.com/company/${company.linkedin.handle}`;
      fields.push('company_linkedin_url');
    }
    if (!currentData.headquarters_city && company.geo?.city) {
      result.headquarters_city = company.geo.city;
      fields.push('headquarters_city');
    }
    if (!currentData.headquarters_state && company.geo?.stateCode) {
      result.headquarters_state = company.geo.stateCode;
      fields.push('headquarters_state');
    }
    
    return { data: result, fields };
  } catch (error) {
    console.error('Clearbit waterfall error:', error);
  }
  
  return { data: null, fields: [] };
}

// ZeroBounce email validation
async function validateEmailWithZeroBounce(
  email: string,
  apiKey: string
): Promise<{ valid: boolean; status: string; sub_status?: string }> {
  try {
    const response = await fetchWithRetry(
      `https://api.zerobounce.net/v2/validate?api_key=${apiKey}&email=${encodeURIComponent(email)}`,
      { method: 'GET' }
    );
    
    if (!response.ok) {
      console.error('ZeroBounce API error:', response.status);
      return { valid: true, status: 'api_error' }; // Don't block on API errors
    }
    
    const data = await response.json();
    
    // ZeroBounce statuses: valid, invalid, catch-all, unknown, spamtrap, abuse, do_not_mail
    const validStatuses = ['valid', 'catch-all'];
    const isValid = validStatuses.includes(data.status?.toLowerCase());
    
    return {
      valid: isValid,
      status: data.status || 'unknown',
      sub_status: data.sub_status,
    };
  } catch (error) {
    console.error('ZeroBounce validation error:', error);
    return { valid: true, status: 'validation_error' }; // Don't block on errors
  }
}

// Twilio phone validation using Lookup API
async function validatePhoneWithTwilio(
  phone: string,
  accountSid: string,
  authToken: string
): Promise<{ valid: boolean; line_type: string | null; carrier: string | null }> {
  try {
    // Clean phone number
    const cleanedPhone = phone.replace(/[^0-9+]/g, '');
    if (cleanedPhone.length < 10) {
      return { valid: false, line_type: null, carrier: null };
    }
    
    const response = await fetchWithRetry(
      `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(cleanedPhone)}?Fields=line_type_intelligence`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        },
      }
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('Twilio: Phone number not found');
        return { valid: false, line_type: null, carrier: null };
      }
      console.error('Twilio Lookup API error:', response.status);
      return { valid: true, line_type: null, carrier: null }; // Don't block on API errors
    }
    
    const data = await response.json();
    
    // Extract line type info
    const lineTypeInfo = data.line_type_intelligence || {};
    const lineType = lineTypeInfo.type || null;
    const carrier = lineTypeInfo.carrier_name || null;
    
    // Mobile and landline are valid, voip may be valid
    const validTypes = ['mobile', 'landline', 'fixedVoip', 'nonFixedVoip'];
    const isValid = data.valid !== false && (!lineType || validTypes.includes(lineType));
    
    return {
      valid: isValid,
      line_type: lineType,
      carrier: carrier,
    };
  } catch (error) {
    console.error('Twilio validation error:', error);
    return { valid: true, line_type: null, carrier: null }; // Don't block on errors
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get all API keys
    const apolloApiKey = Deno.env.get('APOLLO_API_KEY');
    const hunterApiKey = Deno.env.get('HUNTER_API_KEY');
    const pdlApiKey = Deno.env.get('PDL_API_KEY');
    const clearbitApiKey = Deno.env.get('CLEARBIT_API_KEY');
    
    const availableProviders: string[] = [];
    if (apolloApiKey) availableProviders.push('apollo');
    if (hunterApiKey) availableProviders.push('hunter');
    if (pdlApiKey) availableProviders.push('pdl');
    if (clearbitApiKey) availableProviders.push('clearbit');
    
    if (availableProviders.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No enrichment providers configured. Add APOLLO_API_KEY, HUNTER_API_KEY, PDL_API_KEY, or CLEARBIT_API_KEY.' 
        }),
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
      full_name: null,
      email: null,
      phone: null,
      mobile_phone: null,
      direct_phone: null,
      job_title: null,
      seniority_level: null,
      department: null,
      linkedin_url: null,
      company_name: null,
      company_linkedin_url: null,
      employee_count: null,
      annual_revenue: null,
      industry: null,
      founded_year: null,
      headquarters_city: null,
      headquarters_state: null,
      providers_used: [],
      waterfall_log: [],
    };
    
    const waterfallLog: WaterfallStep[] = [];
    
    // Step 1: Apollo
    if (apolloApiKey && !hasCompleteData(result)) {
      const startTime = Date.now();
      const apollo = await enrichWithApollo(input, apolloApiKey);
      const duration = Date.now() - startTime;
      
      waterfallLog.push({
        provider: 'apollo',
        success: !!apollo.data,
        fields_found: apollo.fields,
        fields_missing: getMissingFields({ ...result, ...apollo.data }),
        duration_ms: duration,
      });
      
      if (apollo.data) {
        result = { ...result, ...apollo.data };
        (result.providers_used as string[]).push('apollo');
      }
      
      console.log(`Apollo: ${apollo.fields.length} fields found`);
    }
    
    // Step 2: Hunter (if still missing email)
    if (hunterApiKey && !result.email) {
      const startTime = Date.now();
      const hunter = await enrichWithHunter(input, result, hunterApiKey);
      const duration = Date.now() - startTime;
      
      waterfallLog.push({
        provider: 'hunter',
        success: !!hunter.data,
        fields_found: hunter.fields,
        fields_missing: getMissingFields({ ...result, ...hunter.data }),
        duration_ms: duration,
      });
      
      if (hunter.data) {
        result = { ...result, ...hunter.data };
        (result.providers_used as string[]).push('hunter');
      }
      
      console.log(`Hunter: ${hunter.fields.length} fields found`);
    }
    
    // Step 3: PDL (if still missing data)
    if (pdlApiKey && !hasCompleteData(result)) {
      const startTime = Date.now();
      const pdl = await enrichWithPDL(input, result, pdlApiKey);
      const duration = Date.now() - startTime;
      
      waterfallLog.push({
        provider: 'pdl',
        success: !!pdl.data,
        fields_found: pdl.fields,
        fields_missing: getMissingFields({ ...result, ...pdl.data }),
        duration_ms: duration,
      });
      
      if (pdl.data) {
        result = { ...result, ...pdl.data };
        (result.providers_used as string[]).push('pdl');
      }
      
      console.log(`PDL: ${pdl.fields.length} fields found`);
    }
    
    // Step 4: Clearbit (for company data if still missing)
    if (clearbitApiKey && (!result.company_name || !result.industry || !result.employee_count)) {
      const startTime = Date.now();
      const clearbit = await enrichWithClearbit(input, result, clearbitApiKey);
      const duration = Date.now() - startTime;
      
      waterfallLog.push({
        provider: 'clearbit',
        success: !!clearbit.data,
        fields_found: clearbit.fields,
        fields_missing: getMissingFields({ ...result, ...clearbit.data }),
        duration_ms: duration,
      });
      
      if (clearbit.data) {
        result = { ...result, ...clearbit.data };
        (result.providers_used as string[]).push('clearbit');
      }
      
      console.log(`Clearbit: ${clearbit.fields.length} fields found`);
    }
    
    // Step 5: ZeroBounce email validation (if we have an email)
    const zerobounceApiKey = Deno.env.get('ZEROBOUNCE_API_KEY');
    if (zerobounceApiKey && result.email) {
      const startTime = Date.now();
      const zbResult = await validateEmailWithZeroBounce(result.email, zerobounceApiKey);
      const duration = Date.now() - startTime;
      
      waterfallLog.push({
        provider: 'zerobounce',
        success: zbResult.valid,
        fields_found: zbResult.valid ? ['email_validated'] : [],
        fields_missing: [],
        duration_ms: duration,
      });
      
      if (zbResult.valid) {
        (result.providers_used as string[]).push('zerobounce');
        console.log(`ZeroBounce: Email validated - ${zbResult.status}`);
      } else {
        console.log(`ZeroBounce: Email invalid - ${zbResult.status}. Clearing email.`);
        // Clear invalid email so we don't use bad data
        result.email = null;
      }
    }
    
    // Step 6: Twilio phone validation (if we have a phone)
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    if (twilioAccountSid && twilioAuthToken && result.phone) {
      const startTime = Date.now();
      const twilioResult = await validatePhoneWithTwilio(result.phone, twilioAccountSid, twilioAuthToken);
      const duration = Date.now() - startTime;
      
      waterfallLog.push({
        provider: 'twilio',
        success: twilioResult.valid,
        fields_found: twilioResult.valid ? ['phone_validated', ...(twilioResult.line_type ? ['line_type'] : [])] : [],
        fields_missing: [],
        duration_ms: duration,
      });
      
      if (twilioResult.valid) {
        (result.providers_used as string[]).push('twilio');
        console.log(`Twilio: Phone validated - ${twilioResult.line_type || 'unknown type'}`);
      } else {
        console.log(`Twilio: Phone invalid. Clearing phone.`);
        // Clear invalid phone so we don't use bad data
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
