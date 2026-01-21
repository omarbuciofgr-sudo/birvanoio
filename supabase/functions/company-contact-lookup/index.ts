import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Company Contact Lookup - Find specific decision-makers at a company
 * 
 * Like ZoomInfo/Apollo "Company Search" - enter a company name/domain
 * and get all matching contacts by role (CEO, CFO, CTO, VP Sales, etc.)
 */

interface CompanyLookupParams {
  // Company identifier (one required)
  company_name?: string;
  company_domain?: string;
  
  // Target roles/titles to find
  target_roles?: string[];
  
  // How many contacts per role
  contacts_per_role?: number;
  
  // Total limit
  limit?: number;
  
  // Include org chart / all employees
  include_all_employees?: boolean;
}

interface ContactResult {
  full_name: string | null;
  email: string | null;
  email_status: 'verified' | 'likely_valid' | 'unverified' | null;
  phone: string | null;
  mobile_phone: string | null;
  direct_phone: string | null;
  job_title: string | null;
  seniority_level: string | null;
  department: string | null;
  linkedin_url: string | null;
  headline: string | null;
  photo_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  confidence_score: number;
  source: string;
}

interface CompanyInfo {
  name: string | null;
  domain: string | null;
  website: string | null;
  industry: string | null;
  employee_count: number | null;
  annual_revenue: number | null;
  founded_year: number | null;
  linkedin_url: string | null;
  description: string | null;
  headquarters_city: string | null;
  headquarters_state: string | null;
  headquarters_country: string | null;
  phone: string | null;
  technologies: string[];
}

interface CompanyLookupResponse {
  success: boolean;
  company: CompanyInfo | null;
  contacts: ContactResult[];
  total_contacts_found: number;
  roles_searched: string[];
  contacts_by_role: Record<string, ContactResult[]>;
  error?: string;
}

// Default executive roles to search
const EXECUTIVE_ROLES = [
  'CEO', 'Chief Executive Officer',
  'CFO', 'Chief Financial Officer', 
  'CTO', 'Chief Technology Officer',
  'COO', 'Chief Operating Officer',
  'CMO', 'Chief Marketing Officer',
  'Owner', 'Founder', 'Co-Founder',
  'President', 'Partner', 'Managing Partner',
];

const SALES_ROLES = [
  'VP of Sales', 'Vice President of Sales',
  'Sales Director', 'Director of Sales',
  'Head of Sales', 'Sales Manager',
  'Business Development Director',
];

const MARKETING_ROLES = [
  'VP of Marketing', 'Vice President of Marketing',
  'Marketing Director', 'Director of Marketing',
  'Head of Marketing', 'Marketing Manager',
  'Growth Director', 'Head of Growth',
];

const OPERATIONS_ROLES = [
  'VP of Operations', 'Vice President of Operations',
  'Operations Director', 'Director of Operations',
  'General Manager', 'Plant Manager',
];

const TECH_ROLES = [
  'VP of Engineering', 'Vice President of Engineering',
  'Engineering Director', 'Director of Engineering',
  'Head of Product', 'Product Director',
  'IT Director', 'CIO', 'CISO',
];

const HR_ROLES = [
  'VP of HR', 'VP of Human Resources',
  'HR Director', 'Director of Human Resources',
  'Head of People', 'Chief People Officer',
  'Talent Acquisition Director',
];

// Role category mapping
const ROLE_CATEGORIES: Record<string, string[]> = {
  'executives': EXECUTIVE_ROLES,
  'sales': SALES_ROLES,
  'marketing': MARKETING_ROLES,
  'operations': OPERATIONS_ROLES,
  'technology': TECH_ROLES,
  'hr': HR_ROLES,
};

// Map seniority from title
function mapSeniority(title: string | null): string {
  if (!title) return 'unknown';
  const t = title.toLowerCase();
  
  if (/\b(owner|co-owner|partner)\b/i.test(t)) return 'owner';
  if (/\b(ceo|cto|cfo|coo|cmo|chief)\b/i.test(t)) return 'c_suite';
  if (/\b(founder|co-founder)\b/i.test(t)) return 'founder';
  if (/\b(vp|vice president|svp|evp)\b/i.test(t)) return 'vp';
  if (/\b(director|head of)\b/i.test(t)) return 'director';
  if (/\b(manager|lead)\b/i.test(t)) return 'manager';
  return 'individual_contributor';
}

// Map department from title
function mapDepartment(title: string | null): string {
  if (!title) return 'unknown';
  const t = title.toLowerCase();
  
  if (/\b(sales|business development|account|revenue)\b/i.test(t)) return 'sales';
  if (/\b(marketing|growth|brand|content|seo|demand gen)\b/i.test(t)) return 'marketing';
  if (/\b(engineer|developer|product|tech|it|cto)\b/i.test(t)) return 'engineering';
  if (/\b(finance|accounting|cfo)\b/i.test(t)) return 'finance';
  if (/\b(hr|human|people|talent|recruiting)\b/i.test(t)) return 'hr';
  if (/\b(operations|ops|supply|logistics|coo)\b/i.test(t)) return 'operations';
  if (/\b(ceo|owner|founder|president|partner)\b/i.test(t)) return 'executive';
  return 'other';
}

// Extract domain from company name or clean domain string
function normalizeDomain(input: string): string {
  // Remove protocol and www
  let domain = input.toLowerCase().trim();
  domain = domain.replace(/^https?:\/\//, '');
  domain = domain.replace(/^www\./, '');
  domain = domain.split('/')[0]; // Remove path
  
  // If it looks like a domain (has dot), return it
  if (domain.includes('.')) {
    return domain;
  }
  
  return '';
}

// Search Apollo for company and contacts
async function searchApollo(
  params: CompanyLookupParams,
  apolloApiKey: string
): Promise<{ company: CompanyInfo | null; contacts: ContactResult[] }> {
  const contacts: ContactResult[] = [];
  let companyInfo: CompanyInfo | null = null;
  
  // First, search for the company/organization
  const domain = params.company_domain ? normalizeDomain(params.company_domain) : '';
  
  try {
    // Organization enrichment if we have domain
    if (domain) {
      console.log(`Enriching organization: ${domain}`);
      const orgResponse = await fetch('https://api.apollo.io/v1/organizations/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({
          api_key: apolloApiKey,
          domain: domain,
        }),
      });
      
      const orgData = await orgResponse.json();
      
      if (orgData.organization) {
        const org = orgData.organization;
        companyInfo = {
          name: org.name,
          domain: org.primary_domain || domain,
          website: org.website_url,
          industry: org.industry,
          employee_count: org.estimated_num_employees,
          annual_revenue: org.annual_revenue,
          founded_year: org.founded_year,
          linkedin_url: org.linkedin_url,
          description: org.short_description,
          headquarters_city: org.city,
          headquarters_state: org.state,
          headquarters_country: org.country,
          phone: org.phone,
          technologies: org.technologies?.map((t: any) => t.name) || [],
        };
      }
    }
    
    // Expand role categories to individual titles
    let titlesToSearch: string[] = [];
    for (const role of (params.target_roles || ['executives'])) {
      const lowerRole = role.toLowerCase();
      if (ROLE_CATEGORIES[lowerRole]) {
        titlesToSearch.push(...ROLE_CATEGORIES[lowerRole]);
      } else {
        // Treat as specific title
        titlesToSearch.push(role);
      }
    }
    
    // Deduplicate
    titlesToSearch = [...new Set(titlesToSearch)];
    console.log(`Searching for ${titlesToSearch.length} role titles at ${domain || params.company_name}`);
    
    // Search for people at this company
    const searchBody: Record<string, unknown> = {
      api_key: apolloApiKey,
      page: 1,
      per_page: Math.min(params.limit || 25, 100),
    };
    
    if (domain) {
      searchBody.q_organization_domains = domain;
    } else if (params.company_name) {
      searchBody.organization_name = params.company_name;
    }
    
    // Add title filter unless looking for all employees
    if (!params.include_all_employees && titlesToSearch.length > 0) {
      searchBody.person_titles = titlesToSearch;
    }
    
    const peopleResponse = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify(searchBody),
    });
    
    const peopleData = await peopleResponse.json();
    
    if (peopleData.people?.length) {
      console.log(`Found ${peopleData.people.length} contacts`);
      
      // If we didn't get company info from org enrichment, get it from first person
      if (!companyInfo && peopleData.people[0]?.organization) {
        const org = peopleData.people[0].organization;
        companyInfo = {
          name: org.name,
          domain: org.primary_domain,
          website: org.website_url,
          industry: org.industry,
          employee_count: org.estimated_num_employees,
          annual_revenue: org.annual_revenue,
          founded_year: org.founded_year,
          linkedin_url: org.linkedin_url,
          description: org.short_description,
          headquarters_city: org.city,
          headquarters_state: org.state,
          headquarters_country: org.country,
          phone: org.phone,
          technologies: org.technologies?.map((t: any) => t.name) || [],
        };
      }
      
      for (const person of peopleData.people) {
        const directPhone = person.phone_numbers?.find((p: any) => p.type === 'direct_dial')?.number;
        const mobilePhone = person.phone_numbers?.find((p: any) => p.type === 'mobile')?.number;
        const anyPhone = person.phone_numbers?.[0]?.number;
        
        contacts.push({
          full_name: person.name,
          email: person.email,
          email_status: person.email_status === 'verified' ? 'verified' : 
                       person.email_status === 'likely_to_engage' ? 'likely_valid' : 'unverified',
          phone: anyPhone || null,
          mobile_phone: mobilePhone || null,
          direct_phone: directPhone || null,
          job_title: person.title,
          seniority_level: person.seniority || mapSeniority(person.title),
          department: person.departments?.[0] || mapDepartment(person.title),
          linkedin_url: person.linkedin_url,
          headline: person.headline,
          photo_url: person.photo_url,
          city: person.city,
          state: person.state,
          country: person.country,
          confidence_score: calculateConfidence(person),
          source: 'apollo',
        });
      }
    }
  } catch (error) {
    console.error('Apollo search error:', error);
  }
  
  return { company: companyInfo, contacts };
}

// Try Hunter.io for additional emails
async function searchHunter(
  domain: string,
  hunterApiKey: string
): Promise<ContactResult[]> {
  const contacts: ContactResult[] = [];
  
  try {
    const response = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${hunterApiKey}&limit=20`
    );
    
    const data = await response.json();
    
    if (data.data?.emails?.length) {
      for (const entry of data.data.emails) {
        contacts.push({
          full_name: `${entry.first_name || ''} ${entry.last_name || ''}`.trim() || null,
          email: entry.value,
          email_status: entry.verification?.status === 'valid' ? 'verified' : 'unverified',
          phone: null,
          mobile_phone: null,
          direct_phone: null,
          job_title: entry.position,
          seniority_level: entry.seniority || mapSeniority(entry.position),
          department: entry.department || mapDepartment(entry.position),
          linkedin_url: entry.linkedin,
          headline: null,
          photo_url: null,
          city: null,
          state: null,
          country: null,
          confidence_score: entry.confidence || 50,
          source: 'hunter',
        });
      }
    }
  } catch (error) {
    console.error('Hunter search error:', error);
  }
  
  return contacts;
}

function calculateConfidence(person: any): number {
  let score = 20;
  if (person.name) score += 10;
  if (person.email) score += 25;
  if (person.email_status === 'verified') score += 10;
  if (person.phone_numbers?.length) score += 15;
  if (person.title) score += 10;
  if (person.linkedin_url) score += 5;
  return Math.min(score, 100);
}

// Merge and deduplicate contacts from multiple sources
function mergeContacts(
  apolloContacts: ContactResult[],
  hunterContacts: ContactResult[]
): ContactResult[] {
  const contactMap = new Map<string, ContactResult>();
  
  // Add Apollo contacts (higher priority)
  for (const contact of apolloContacts) {
    const key = contact.email?.toLowerCase() || contact.full_name?.toLowerCase() || '';
    if (key) {
      contactMap.set(key, contact);
    }
  }
  
  // Add Hunter contacts only if not already present
  for (const contact of hunterContacts) {
    const emailKey = contact.email?.toLowerCase();
    const nameKey = contact.full_name?.toLowerCase();
    
    if (emailKey && !contactMap.has(emailKey)) {
      // Check if we have this person by name
      const existingByName = nameKey ? contactMap.get(nameKey) : null;
      if (existingByName && !existingByName.email && contact.email) {
        // Merge email into existing contact
        existingByName.email = contact.email;
        existingByName.email_status = contact.email_status;
        existingByName.confidence_score = Math.min(existingByName.confidence_score + 15, 100);
      } else if (!existingByName) {
        contactMap.set(emailKey, contact);
      }
    }
  }
  
  // Sort by confidence score and seniority
  const seniorityOrder: Record<string, number> = {
    'owner': 1,
    'founder': 2,
    'c_suite': 3,
    'vp': 4,
    'director': 5,
    'manager': 6,
    'individual_contributor': 7,
    'unknown': 8,
  };
  
  return Array.from(contactMap.values()).sort((a, b) => {
    const seniorityDiff = (seniorityOrder[a.seniority_level || 'unknown'] || 8) - 
                          (seniorityOrder[b.seniority_level || 'unknown'] || 8);
    if (seniorityDiff !== 0) return seniorityDiff;
    return b.confidence_score - a.confidence_score;
  });
}

// Group contacts by role/department
function groupContactsByRole(contacts: ContactResult[]): Record<string, ContactResult[]> {
  const groups: Record<string, ContactResult[]> = {};
  
  for (const contact of contacts) {
    const dept = contact.department || 'other';
    if (!groups[dept]) {
      groups[dept] = [];
    }
    groups[dept].push(contact);
  }
  
  return groups;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Admin check
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Administrator access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get API keys
    const apolloApiKey = Deno.env.get('APOLLO_API_KEY');
    const hunterApiKey = Deno.env.get('HUNTER_API_KEY');
    
    if (!apolloApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Apollo API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const params: CompanyLookupParams = await req.json();
    
    // Validate input
    if (!params.company_name && !params.company_domain) {
      return new Response(
        JSON.stringify({ success: false, error: 'Company name or domain required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Company lookup: ${params.company_name || params.company_domain}`);
    console.log(`Target roles: ${params.target_roles?.join(', ') || 'executives'}`);

    // Search Apollo
    const { company, contacts: apolloContacts } = await searchApollo(params, apolloApiKey);
    
    // If we have domain and Hunter API key, get additional emails
    let hunterContacts: ContactResult[] = [];
    const domain = params.company_domain ? normalizeDomain(params.company_domain) : company?.domain;
    if (domain && hunterApiKey) {
      hunterContacts = await searchHunter(domain, hunterApiKey);
    }
    
    // Merge and deduplicate
    let allContacts = mergeContacts(apolloContacts, hunterContacts);
    
    // Apply limit
    const limit = params.limit || 25;
    allContacts = allContacts.slice(0, limit);
    
    // Group by role
    const contactsByRole = groupContactsByRole(allContacts);
    
    const response: CompanyLookupResponse = {
      success: true,
      company,
      contacts: allContacts,
      total_contacts_found: allContacts.length,
      roles_searched: params.target_roles || ['executives'],
      contacts_by_role: contactsByRole,
    };

    console.log(`Returning ${allContacts.length} contacts for ${company?.name || 'unknown company'}`);
    
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Company lookup error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Company lookup failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
