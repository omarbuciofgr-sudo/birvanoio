import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

// AI-powered extraction schemas for different niches
const EXTRACTION_SCHEMAS = {
  b2b: {
    type: 'object',
    properties: {
      contacts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            full_name: { type: 'string', description: 'Full name of the business contact' },
            job_title: { type: 'string', description: 'Job title or position (CEO, Director, Manager, etc.)' },
            email: { type: 'string', description: 'Business email address' },
            phone: { type: 'string', description: 'Phone number with area code' },
            department: { type: 'string', description: 'Department (Sales, Marketing, Engineering, etc.)' },
            linkedin_url: { type: 'string', description: 'LinkedIn profile URL' },
          },
        },
      },
      company: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Company or business name' },
          website: { type: 'string', description: 'Company website URL' },
          industry: { type: 'string', description: 'Industry or sector' },
          description: { type: 'string', description: 'Brief company description' },
          employee_count: { type: 'string', description: 'Number of employees or size range' },
          headquarters: { type: 'string', description: 'Headquarters location (city, state, country)' },
        },
      },
    },
  },
  real_estate: {
    type: 'object',
    properties: {
      agents: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            full_name: { type: 'string', description: 'Agent full name' },
            email: { type: 'string', description: 'Email address' },
            phone: { type: 'string', description: 'Phone number' },
            license_number: { type: 'string', description: 'Real estate license number' },
            brokerage: { type: 'string', description: 'Brokerage or agency name' },
            specialization: { type: 'string', description: 'Specialization (residential, commercial, luxury)' },
            service_areas: { type: 'string', description: 'Service areas or regions' },
          },
        },
      },
      office: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          address: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          zip_code: { type: 'string' },
        },
      },
    },
  },
  // FSBO/FRBO - For Sale By Owner / For Rent By Owner listings
  fsbo_frbo: {
    type: 'object',
    properties: {
      listing: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Full property address including street, city, state, zip' },
          bedrooms: { type: 'number', description: 'Number of bedrooms' },
          bathrooms: { type: 'number', description: 'Number of bathrooms (can be decimal like 2.5)' },
          price: { type: 'string', description: 'Listing price or monthly rent (include $ symbol)' },
          days_on_market: { type: 'number', description: 'Number of days the listing has been active' },
          favorites_count: { type: 'number', description: 'Number of saves/favorites/hearts on the listing' },
          views_count: { type: 'number', description: 'Number of views on the listing' },
          listing_type: { type: 'string', description: 'Type: for_sale, for_rent, for_sale_by_owner, for_rent_by_owner' },
          property_type: { type: 'string', description: 'Property type: house, condo, apartment, townhouse, multi-family' },
          square_feet: { type: 'number', description: 'Square footage of the property' },
          lot_size: { type: 'string', description: 'Lot size (acres or sq ft)' },
          year_built: { type: 'number', description: 'Year the property was built' },
          description: { type: 'string', description: 'Listing description text' },
        },
      },
      owner: {
        type: 'object',
        properties: {
          full_name: { type: 'string', description: 'Owner or landlord full name' },
          phone: { type: 'string', description: 'Owner phone number' },
          email: { type: 'string', description: 'Owner email address' },
          is_verified: { type: 'boolean', description: 'Whether owner identity is verified' },
        },
      },
      source: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Source listing URL' },
          platform: { type: 'string', description: 'Source platform name (Zillow, FSBO.com, etc.)' },
          listing_id: { type: 'string', description: 'Unique listing ID from the platform' },
        },
      },
    },
  },
  insurance: {
    type: 'object',
    properties: {
      agents: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            full_name: { type: 'string', description: 'Agent full name' },
            email: { type: 'string', description: 'Email address' },
            phone: { type: 'string', description: 'Phone number' },
            license_number: { type: 'string', description: 'Insurance license or NPN number' },
            agency_name: { type: 'string', description: 'Insurance agency name' },
            insurance_types: { type: 'string', description: 'Types of insurance offered (auto, home, life, commercial)' },
          },
        },
      },
      agency: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          address: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          zip_code: { type: 'string' },
          carriers: { type: 'string', description: 'Insurance carriers represented' },
        },
      },
    },
  },
  healthcare: {
    type: 'object',
    properties: {
      providers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            full_name: { type: 'string', description: 'Provider full name' },
            credentials: { type: 'string', description: 'Credentials (MD, DO, NP, PA, etc.)' },
            specialty: { type: 'string', description: 'Medical specialty' },
            email: { type: 'string', description: 'Email address' },
            phone: { type: 'string', description: 'Phone number' },
            npi_number: { type: 'string', description: 'NPI number if available' },
          },
        },
      },
      practice: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          address: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          zip_code: { type: 'string' },
          services: { type: 'string', description: 'Services offered' },
        },
      },
    },
  },
  legal: {
    type: 'object',
    properties: {
      attorneys: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            full_name: { type: 'string', description: 'Attorney full name' },
            email: { type: 'string', description: 'Email address' },
            phone: { type: 'string', description: 'Phone number' },
            bar_number: { type: 'string', description: 'Bar number or license' },
            practice_areas: { type: 'string', description: 'Practice areas (personal injury, family law, etc.)' },
            title: { type: 'string', description: 'Title (Partner, Associate, Of Counsel)' },
          },
        },
      },
      firm: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          address: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          zip_code: { type: 'string' },
        },
      },
    },
  },
  general: {
    type: 'object',
    properties: {
      contacts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            full_name: { type: 'string', description: 'Full name of the contact person' },
            job_title: { type: 'string', description: 'Job title or role' },
            email: { type: 'string', description: 'Email address' },
            phone: { type: 'string', description: 'Phone number' },
          },
        },
      },
      business: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Business or organization name' },
          address: { type: 'string', description: 'Full address' },
          website: { type: 'string', description: 'Website URL' },
          description: { type: 'string', description: 'Brief description' },
        },
      },
    },
  },
};

// AI extraction prompts for flexible extraction
const EXTRACTION_PROMPTS = {
  contacts: `Extract all contact information from this page. For each person, extract:
- Full name (first and last name)
- Job title or position
- Email address
- Phone number (with area code)
- Department or role
- LinkedIn profile URL if available
Return ONLY valid, real contact information found on the page.`,
  
  company: `Extract company/business information from this page:
- Company name
- Industry or sector
- Description or about text
- Employee count or company size
- Headquarters location
- Founded year
- Website URL
Return factual information found on the page.`,
  
  decision_makers: `Find decision makers and executives on this page. Focus on:
- C-level executives (CEO, CTO, CFO, CMO, COO)
- Vice Presidents and Directors
- Department heads and managers
- Founders and owners
For each, extract: name, title, email, phone, LinkedIn URL.`,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    const requestedHeaders = req.headers.get('access-control-request-headers');
    return new Response(null, { 
      headers: {
        ...corsHeaders,
        ...(requestedHeaders ? { 'Access-Control-Allow-Headers': requestedHeaders } : {}),
      }
    });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);

    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', claimsData.user.id);

    const { url, options } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Scraping URL:', formattedUrl);

    // Determine extraction mode
    const extractionMode = options?.extractionMode || 'markdown'; // 'markdown', 'json', or 'ai'
    const niche = options?.niche || 'general';

    let requestBody: Record<string, unknown> = {
      url: formattedUrl,
      onlyMainContent: options?.onlyMainContent ?? true,
      waitFor: options?.waitFor,
      location: options?.location,
    };

    if (extractionMode === 'json') {
      // Use structured JSON extraction with schema
      const schema = options?.schema || EXTRACTION_SCHEMAS[niche as keyof typeof EXTRACTION_SCHEMAS] || EXTRACTION_SCHEMAS.general;
      requestBody.formats = [{ type: 'json', schema }];
      console.log('Using JSON extraction with schema for niche:', niche);
    } else if (extractionMode === 'ai') {
      // Use AI-powered prompt extraction
      const prompt = options?.extractionPrompt || EXTRACTION_PROMPTS.contacts;
      requestBody.formats = [{ type: 'json', prompt }];
      console.log('Using AI prompt extraction');
    } else {
      // Default markdown extraction
      requestBody.formats = options?.formats || ['markdown'];
    }

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Request failed with status ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enhance response with extraction mode info
    const enhancedData = {
      ...data,
      extractionMode,
      niche,
    };

    console.log('Scrape successful, mode:', extractionMode);
    return new Response(
      JSON.stringify(enhancedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
