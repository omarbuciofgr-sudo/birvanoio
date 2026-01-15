import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Supported real estate platforms
const SUPPORTED_PLATFORMS = [
  { name: 'zillow', pattern: /zillow\.com/i, ownerFilter: 'fsbo' },
  { name: 'apartments', pattern: /apartments\.com/i, ownerFilter: 'owner' },
  { name: 'hotpads', pattern: /hotpads\.com/i, ownerFilter: 'owner' },
  { name: 'fsbo', pattern: /fsbo\.com/i, ownerFilter: null },
  { name: 'trulia', pattern: /trulia\.com/i, ownerFilter: 'fsbo' },
  { name: 'redfin', pattern: /redfin\.com/i, ownerFilter: 'fsbo' },
  { name: 'craigslist', pattern: /craigslist\.(org|com)/i, ownerFilter: null },
  { name: 'facebook', pattern: /facebook\.com\/marketplace/i, ownerFilter: null },
  { name: 'realtor', pattern: /realtor\.com/i, ownerFilter: 'fsbo' },
];

// FSBO/FRBO extraction schema
const FSBO_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    listings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Full property address including street, city, state, zip' },
          bedrooms: { type: 'number', description: 'Number of bedrooms' },
          bathrooms: { type: 'number', description: 'Number of bathrooms' },
          price: { type: 'string', description: 'Listing price or rent amount with $ symbol' },
          days_on_market: { type: 'number', description: 'Days listed or time on market' },
          favorites_count: { type: 'number', description: 'Number of saves/favorites/likes' },
          views_count: { type: 'number', description: 'Number of views' },
          listing_type: { type: 'string', description: 'for_sale, for_rent, fsbo, frbo' },
          property_type: { type: 'string', description: 'house, condo, apartment, townhouse' },
          square_feet: { type: 'number', description: 'Square footage' },
          year_built: { type: 'number', description: 'Year built' },
          owner_name: { type: 'string', description: 'Property owner or landlord name if shown on page' },
          owner_phone: { type: 'string', description: 'Owner phone number if shown on page' },
          owner_email: { type: 'string', description: 'Owner email address if shown on page' },
          listing_url: { type: 'string', description: 'Direct URL to this listing' },
          listing_id: { type: 'string', description: 'Unique listing identifier' },
          description: { type: 'string', description: 'Listing description (first 500 chars)' },
        },
      },
    },
  },
};

const FSBO_EXTRACTION_PROMPT = `Extract all For Sale By Owner (FSBO) and For Rent By Owner (FRBO) property listings from this page.

For EACH listing found, extract:
- Full property address (street, city, state, zip) - THIS IS CRITICAL
- Number of bedrooms and bathrooms
- Price or monthly rent (include $ symbol)
- Days on market, favorites, views counts if shown
- Listing type (for_sale, for_rent, fsbo, frbo)
- Property type (house, condo, apartment, townhouse)
- Square footage and year built if shown
- Owner/landlord name, phone, email if shown on page
- Direct link to the listing
- Listing ID or reference number

IMPORTANT: Extract the FULL ADDRESS including street number, street name, city, state, and zip code.
Only extract listings where the seller/landlord is the OWNER, not a real estate agent.
Look for keywords: "FSBO", "For Sale By Owner", "Owner", "Landlord", "No Agent", "Private Sale".`;

interface SkipTraceResult {
  success: boolean;
  data?: {
    fullName: string | null;
    firstName: string | null;
    lastName: string | null;
    phones: Array<{ number: string; type: string; lineType?: string }>;
    emails: Array<{ address: string; type?: string }>;
    mailingAddress?: { street: string; city: string; state: string; zip: string };
    confidence?: number;
  };
  error?: string;
  message?: string;
}

interface EnrichedListing {
  // Scraped data
  address?: string;
  bedrooms?: number;
  bathrooms?: number;
  price?: string;
  days_on_market?: number;
  favorites_count?: number;
  views_count?: number;
  listing_type?: string;
  property_type?: string;
  square_feet?: number;
  year_built?: number;
  listing_url?: string;
  listing_id?: string;
  description?: string;
  source_url?: string;
  source_platform?: string;
  scraped_at?: string;
  
  // Skip traced data
  owner_name?: string;
  owner_phone?: string;
  owner_email?: string;
  all_phones?: Array<{ number: string; type: string }>;
  all_emails?: Array<{ address: string; type?: string }>;
  skip_trace_confidence?: number;
  skip_trace_status?: 'pending' | 'success' | 'not_found' | 'error';
  skip_trace_error?: string;
}

function detectPlatform(url: string): { name: string; ownerFilter: string | null } | null {
  for (const platform of SUPPORTED_PLATFORMS) {
    if (platform.pattern.test(url)) {
      return { name: platform.name, ownerFilter: platform.ownerFilter };
    }
  }
  return null;
}

function normalizeLocation(location: string): string {
  let loc = location.trim();
  try {
    // Handle inputs like "houston%2c%20texas"
    loc = decodeURIComponent(loc);
  } catch {
    // ignore
  }
  return loc;
}

function getStateAbbreviation(state: string): string {
  const s = state.trim().toLowerCase();
  const map: Record<string, string> = {
    alabama: 'al', alaska: 'ak', arizona: 'az', arkansas: 'ar', california: 'ca', colorado: 'co',
    connecticut: 'ct', delaware: 'de', florida: 'fl', georgia: 'ga', hawaii: 'hi', idaho: 'id',
    illinois: 'il', indiana: 'in', iowa: 'ia', kansas: 'ks', kentucky: 'ky', louisiana: 'la',
    maine: 'me', maryland: 'md', massachusetts: 'ma', michigan: 'mi', minnesota: 'mn',
    mississippi: 'ms', missouri: 'mo', montana: 'mt', nebraska: 'ne', nevada: 'nv',
    'new hampshire': 'nh', 'new jersey': 'nj', 'new mexico': 'nm', 'new york': 'ny',
    'north carolina': 'nc', 'north dakota': 'nd', ohio: 'oh', oklahoma: 'ok', oregon: 'or',
    pennsylvania: 'pa', 'rhode island': 'ri', 'south carolina': 'sc', 'south dakota': 'sd',
    tennessee: 'tn', texas: 'tx', utah: 'ut', vermont: 'vt', virginia: 'va', washington: 'wa',
    'west virginia': 'wv', wisconsin: 'wi', wyoming: 'wy',
    'district of columbia': 'dc',
  };

  if (/^[a-z]{2}$/.test(s)) return s;
  return map[s] || s.slice(0, 2);
}

function parseCityState(location: string): { city: string; state: string } {
  const loc = normalizeLocation(location);

  // Prefer explicit "City, State" inputs
  const commaParts = loc.split(',').map((p) => p.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    return { city: commaParts[0], state: commaParts[1] };
  }

  // Also support "City State" / "City ST" (no comma)
  const tokens = loc.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return { city: loc, state: '' };

  const last = tokens[tokens.length - 1];
  const lastTwo = tokens.length >= 2 ? `${tokens[tokens.length - 2]} ${tokens[tokens.length - 1]}` : '';

  if (/^[A-Za-z]{2}$/.test(last)) {
    return { city: tokens.slice(0, -1).join(' '), state: last.toUpperCase() };
  }

  const lastTwoNorm = lastTwo.toLowerCase();
  const lastNorm = last.toLowerCase();

  // If it's a known full state name (including two-word names)
  if (getStateAbbreviation(lastTwoNorm) !== lastTwoNorm.slice(0, 2)) {
    return { city: tokens.slice(0, -2).join(' '), state: lastTwoNorm };
  }
  if (getStateAbbreviation(lastNorm) !== lastNorm.slice(0, 2)) {
    return { city: tokens.slice(0, -1).join(' '), state: lastNorm };
  }

  return { city: loc, state: '' };
}

function toHyphenSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/_+/g, '-')
    .replace(/-+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-|-$/g, '');
}

function hotpadsLocationSlug(location: string): string {
  const { city, state } = parseCityState(location);
  const citySlug = toHyphenSlug(city);

  // HotPads strongly prefers city-state like "houston-tx".
  if (state) {
    const abbrev = getStateAbbreviation(state);
    return `${citySlug}-${abbrev}`;
  }

  return toHyphenSlug(normalizeLocation(location));
}

function buildSearchUrl(platform: string, location: string, listingType: 'sale' | 'rent'): string | null {
  const normalizedLocation = normalizeLocation(location);
  const encodedLocation = encodeURIComponent(normalizedLocation);

  switch (platform) {
    case 'zillow':
      return listingType === 'sale'
        ? `https://www.zillow.com/${encodedLocation.toLowerCase().replace(/\s+/g, '-')}/fsbo/`
        : `https://www.zillow.com/${encodedLocation.toLowerCase().replace(/\s+/g, '-')}/rentals/`;
    case 'fsbo':
      return `https://www.fsbo.com/search/?location=${encodedLocation}`;
    case 'trulia':
      return listingType === 'sale'
        ? `https://www.trulia.com/${encodedLocation.toLowerCase().replace(/\s+/g, '_')}/fsbo/`
        : `https://www.trulia.com/for_rent/${encodedLocation.toLowerCase().replace(/\s+/g, '_')}/`;
    case 'redfin':
      return `https://www.redfin.com/city/search?q=${encodedLocation}`;
    case 'hotpads': {
      // IMPORTANT: HotPads expects a path slug (not URL-encoded commas/spaces), e.g. "houston-tx".
      // Also: for an owner-focused view, use /for-rent-by-owner.
      const slug = hotpadsLocationSlug(normalizedLocation);
      return `https://hotpads.com/${slug}/for-rent-by-owner?isListedByOwner=true&listingTypes=rental`;
    }
    case 'apartments':
      return `https://www.apartments.com/${encodedLocation.toLowerCase().replace(/\s+/g, '-')}/`;
    default:
      return null;
  }
}

// Skip trace a single address using Tracerfy
async function skipTraceAddress(
  address: string,
  tracerfyApiKey: string
): Promise<SkipTraceResult> {
  if (!address || address.trim().length < 5) {
    return { success: false, error: 'Invalid address' };
  }

  // Parse address into components
  const parts = address.split(',').map(p => p.trim());
  let addressData: Record<string, string> = {};
  
  if (parts.length >= 3) {
    addressData.street = parts[0];
    addressData.city = parts[1];
    const stateZip = parts[parts.length - 1].trim().split(/\s+/);
    addressData.state = stateZip[0];
    if (stateZip.length > 1) {
      addressData.zip = stateZip[stateZip.length - 1];
    }
  } else if (parts.length === 2) {
    addressData.street = parts[0];
    const stateZip = parts[1].trim().split(/\s+/);
    addressData.city = '';
    addressData.state = stateZip[0];
    if (stateZip.length > 1) {
      addressData.zip = stateZip[stateZip.length - 1];
    }
  } else {
    addressData.street = address;
  }

  try {
    const response = await fetch('https://api.tracerfy.com/v1/skip-trace', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tracerfyApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: addressData.street,
        city: addressData.city || '',
        state: addressData.state || '',
        zip: addressData.zip || '',
      }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: true,
          data: { fullName: null, firstName: null, lastName: null, phones: [], emails: [], confidence: 0 },
          message: 'No owner information found',
        };
      }
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    
    return {
      success: true,
      data: {
        fullName: data.full_name || data.name || null,
        firstName: data.first_name || null,
        lastName: data.last_name || null,
        phones: (data.phones || data.phone_numbers || []).map((p: any) => ({
          number: typeof p === 'string' ? p : p.number || p.phone,
          type: typeof p === 'string' ? 'unknown' : p.type || 'unknown',
          lineType: typeof p === 'string' ? undefined : p.line_type,
        })),
        emails: (data.emails || data.email_addresses || []).map((e: any) => ({
          address: typeof e === 'string' ? e : e.address || e.email,
          type: typeof e === 'string' ? undefined : e.type,
        })),
        mailingAddress: data.mailing_address,
        confidence: data.confidence_score || data.confidence,
      },
    };
  } catch (error) {
    console.error('Skip trace error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Skip trace failed' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(
      supabaseUrl,
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

    const userId = claimsData.user.id;
    console.log('Authenticated user:', userId);

    // Check admin role
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: hasAdminRole } = await adminSupabase.rpc('has_role', { 
      _user_id: userId, 
      _role: 'admin' 
    });

    if (!hasAdminRole) {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      url, 
      urls,
      location, 
      platform: requestedPlatform,
      listingType = 'sale',
      enableSkipTrace = true,
      saveToDatabase = false,
      jobId,
    } = await req.json();

    // Check API keys
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tracerfyApiKey = Deno.env.get('TRACERFY_API_KEY');
    if (enableSkipTrace && !tracerfyApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tracerfy API key not configured for skip tracing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Collect URLs to scrape
    let urlsToScrape: string[] = [];

    if (url) {
      urlsToScrape.push(url);
    } else if (urls && Array.isArray(urls)) {
      urlsToScrape = urls;
    } else if (location && requestedPlatform && requestedPlatform !== 'all') {
      const searchUrl = buildSearchUrl(requestedPlatform, location, listingType);
      if (searchUrl) {
        urlsToScrape.push(searchUrl);
      } else {
        return new Response(
          JSON.stringify({ success: false, error: `Platform ${requestedPlatform} not supported` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (location) {
      // Search all supported platforms
      for (const platform of SUPPORTED_PLATFORMS) {
        const searchUrl = buildSearchUrl(platform.name, location, listingType);
        if (searchUrl) {
          urlsToScrape.push(searchUrl);
        }
      }
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Either url, urls, or location is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting FSBO scrape + skip trace workflow for ${urlsToScrape.length} URLs`);

    const allListings: EnrichedListing[] = [];
    const errors: { url: string; error: string }[] = [];
    let skipTraceCount = 0;
    let skipTraceSuccessCount = 0;

    // Step 1: Scrape all URLs
    for (const targetUrl of urlsToScrape) {
      try {
        let formattedUrl = targetUrl.trim();
        if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
          formattedUrl = `https://${formattedUrl}`;
        }

        const platform = detectPlatform(formattedUrl);
        console.log(`Scraping ${formattedUrl} (platform: ${platform?.name || 'unknown'})`);

        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: formattedUrl,
            // Include 'json' format when using jsonOptions for extraction
            formats: ['markdown', 'links', 'json'],
            jsonOptions: {
              prompt: FSBO_EXTRACTION_PROMPT,
              schema: FSBO_EXTRACTION_SCHEMA,
            },
            onlyMainContent: true,
            waitFor: 3000,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error(`Firecrawl error for ${formattedUrl}:`, data);
          errors.push({ url: formattedUrl, error: data.error || `HTTP ${response.status}` });
          continue;
        }

        const extractedData = data.data?.json || data.json || {};
        const listings = extractedData.listings || [];
        
        for (const listing of listings) {
          allListings.push({
            ...listing,
            source_url: formattedUrl,
            source_platform: platform?.name || 'unknown',
            scraped_at: new Date().toISOString(),
            skip_trace_status: 'pending',
          });
        }

        console.log(`Found ${listings.length} listings from ${formattedUrl}`);

        // Rate limiting between requests
        if (urlsToScrape.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Error scraping ${targetUrl}:`, error);
        errors.push({ url: targetUrl, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    console.log(`Scraped ${allListings.length} total listings`);

    // Step 2: Skip trace each listing that has an address but no owner info
    if (enableSkipTrace && tracerfyApiKey && allListings.length > 0) {
      console.log('Starting skip trace for listings...');
      
      for (const listing of allListings) {
        // Skip if we already have owner info from scraping or no address
        if (!listing.address) {
          listing.skip_trace_status = 'error';
          listing.skip_trace_error = 'No address available';
          continue;
        }

        if (listing.owner_name && listing.owner_phone) {
          listing.skip_trace_status = 'success';
          listing.skip_trace_confidence = 100;
          continue;
        }

        skipTraceCount++;
        
        try {
          console.log(`Skip tracing: ${listing.address}`);
          const traceResult = await skipTraceAddress(listing.address, tracerfyApiKey);
          
          if (traceResult.success && traceResult.data) {
            const data = traceResult.data;
            
            // Update listing with skip trace data
            if (data.fullName && !listing.owner_name) {
              listing.owner_name = data.fullName;
            }
            
            if (data.phones && data.phones.length > 0) {
              listing.owner_phone = data.phones[0].number;
              listing.all_phones = data.phones;
            }
            
            if (data.emails && data.emails.length > 0) {
              listing.owner_email = data.emails[0].address;
              listing.all_emails = data.emails;
            }
            
            listing.skip_trace_confidence = data.confidence;
            listing.skip_trace_status = 
              (data.fullName || data.phones?.length || data.emails?.length) 
                ? 'success' 
                : 'not_found';
            
            if (listing.skip_trace_status === 'success') {
              skipTraceSuccessCount++;
            }
          } else {
            listing.skip_trace_status = 'error';
            listing.skip_trace_error = traceResult.error || 'Unknown error';
          }
          
          // Rate limit skip trace calls
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Skip trace error for ${listing.address}:`, error);
          listing.skip_trace_status = 'error';
          listing.skip_trace_error = error instanceof Error ? error.message : 'Unknown error';
        }
      }
      
      console.log(`Skip traced ${skipTraceCount} listings, ${skipTraceSuccessCount} successful`);
    }

    // Step 3: Save to database if requested
    let savedCount = 0;
    if (saveToDatabase && allListings.length > 0) {
      console.log(`Saving ${allListings.length} listings to database`);
      
      for (const listing of allListings) {
        try {
          await adminSupabase.from('scraped_leads').insert({
            job_id: jobId || null,
            domain: listing.source_url ? new URL(listing.source_url).hostname : 'unknown',
            source_url: listing.source_url,
            full_name: listing.owner_name || null,
            best_email: listing.owner_email || null,
            best_phone: listing.owner_phone || null,
            all_emails: listing.all_emails || null,
            all_phones: listing.all_phones || null,
            address: listing.address || null,
            lead_type: listing.listing_type || 'fsbo',
            status: 'new',
            confidence_score: listing.skip_trace_confidence || null,
            schema_data: {
              bedrooms: listing.bedrooms,
              bathrooms: listing.bathrooms,
              price: listing.price,
              days_on_market: listing.days_on_market,
              favorites_count: listing.favorites_count,
              views_count: listing.views_count,
              property_type: listing.property_type,
              square_feet: listing.square_feet,
              year_built: listing.year_built,
              listing_id: listing.listing_id,
              listing_url: listing.listing_url,
              description: listing.description,
              source_platform: listing.source_platform,
              skip_trace_status: listing.skip_trace_status,
            },
          });
          savedCount++;
        } catch (insertError) {
          console.error('Error inserting listing:', insertError);
        }
      }
      
      console.log(`Saved ${savedCount} listings to database`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        listings: allListings,
        total: allListings.length,
        urls_scraped: urlsToScrape.length,
        skip_trace_stats: enableSkipTrace ? {
          attempted: skipTraceCount,
          successful: skipTraceSuccessCount,
          rate: skipTraceCount > 0 ? Math.round((skipTraceSuccessCount / skipTraceCount) * 100) : 0,
        } : null,
        saved_to_database: saveToDatabase ? savedCount : null,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in FSBO scrape + skip trace:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
