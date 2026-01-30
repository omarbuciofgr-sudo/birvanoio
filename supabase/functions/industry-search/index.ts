import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Industry/Company Search - Find companies by industry, size, location
 * Uses Apollo.io organization search API
 */

interface CompanySearchInput {
  industry?: string;
  employee_count_min?: number;
  employee_count_max?: number;
  location?: string;
  keywords?: string;
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
  annual_revenue: number | null;
  founded_year: number | null;
  description: string | null;
  headquarters_city: string | null;
  headquarters_state: string | null;
  headquarters_country: string | null;
  technologies: string[];
  keywords: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const apolloApiKey = Deno.env.get('APOLLO_API_KEY');

  if (!apolloApiKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'Apollo API key not configured. Add APOLLO_API_KEY to secrets.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Authentication check
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ success: false, error: 'Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid authentication' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: CompanySearchInput = await req.json();
    
    const {
      industry,
      employee_count_min,
      employee_count_max,
      location,
      keywords,
      limit = 25,
    } = body;

    console.log(`Industry search: industry=${industry}, location=${location}, employees=${employee_count_min}-${employee_count_max}`);

    // Build Apollo organization search params
    const searchParams: Record<string, unknown> = {
      api_key: apolloApiKey,
      page: 1,
      per_page: Math.min(limit, 100),
    };

    // Add industry filter
    if (industry) {
      searchParams.organization_industry_tag_ids = [industry];
      // Also try keyword search for industry
      searchParams.q_organization_keyword_tags = [industry];
    }

    // Add employee count filter
    if (employee_count_min || employee_count_max) {
      const employeeRanges: string[] = [];
      
      if (employee_count_min && employee_count_min < 10) employeeRanges.push('1-10');
      if ((employee_count_min || 0) <= 50 && (employee_count_max || 999999) >= 11) employeeRanges.push('11-50');
      if ((employee_count_min || 0) <= 200 && (employee_count_max || 999999) >= 51) employeeRanges.push('51-200');
      if ((employee_count_min || 0) <= 500 && (employee_count_max || 999999) >= 201) employeeRanges.push('201-500');
      if ((employee_count_min || 0) <= 1000 && (employee_count_max || 999999) >= 501) employeeRanges.push('501-1000');
      if ((employee_count_min || 0) <= 5000 && (employee_count_max || 999999) >= 1001) employeeRanges.push('1001-5000');
      if ((employee_count_min || 0) <= 10000 && (employee_count_max || 999999) >= 5001) employeeRanges.push('5001-10000');
      if ((employee_count_max || 999999) >= 10001) employeeRanges.push('10001+');

      if (employeeRanges.length > 0) {
        searchParams.organization_num_employees_ranges = employeeRanges;
      }
    }

    // Add location filter
    if (location) {
      // Parse location into city/state/country
      const locationParts = location.split(',').map(p => p.trim());
      
      if (locationParts.length >= 2) {
        searchParams.organization_locations = [location];
      } else {
        // Try as state or city
        searchParams.q_organization_locations = location;
      }
    }

    // Add keyword search
    if (keywords) {
      searchParams.q_organization_name = keywords;
    }

    console.log('Apollo search params:', JSON.stringify(searchParams, null, 2));

    // Call Apollo organization search
    const response = await fetch('https://api.apollo.io/v1/mixed_companies/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(searchParams),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Apollo API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || 'Apollo API error' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizations = data.organizations || data.accounts || [];
    console.log(`Found ${organizations.length} companies`);

    const companies: CompanyResult[] = organizations.map((org: any) => ({
      name: org.name || '',
      domain: org.primary_domain || org.domain || '',
      website: org.website_url || org.primary_domain ? `https://${org.primary_domain}` : null,
      linkedin_url: org.linkedin_url || null,
      industry: org.industry || null,
      employee_count: org.estimated_num_employees || null,
      employee_range: org.employee_count_range || null,
      annual_revenue: org.annual_revenue || null,
      founded_year: org.founded_year || null,
      description: org.short_description || null,
      headquarters_city: org.city || null,
      headquarters_state: org.state || null,
      headquarters_country: org.country || null,
      technologies: org.technologies?.slice(0, 20) || [],
      keywords: org.keywords?.slice(0, 10) || [],
    }));

    return new Response(
      JSON.stringify({
        success: true,
        companies,
        total: companies.length,
        pagination: {
          page: data.pagination?.page || 1,
          per_page: data.pagination?.per_page || limit,
          total_entries: data.pagination?.total_entries || companies.length,
          total_pages: data.pagination?.total_pages || 1,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Industry search error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Search failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
