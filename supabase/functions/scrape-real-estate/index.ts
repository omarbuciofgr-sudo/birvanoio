import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Supported real estate platforms
const SUPPORTED_PLATFORMS = [
  { name: 'zillow', pattern: /zillow\.com/i, ownerFilter: 'fsbo', requiresZyte: true },
  { name: 'apartments', pattern: /apartments\.com/i, ownerFilter: 'owner', requiresZyte: false },
  { name: 'hotpads', pattern: /hotpads\.com/i, ownerFilter: 'owner', requiresZyte: false },
  { name: 'fsbo', pattern: /fsbo\.com/i, ownerFilter: null, requiresZyte: false },
  { name: 'trulia', pattern: /trulia\.com/i, ownerFilter: 'fsbo', requiresZyte: true },
  { name: 'redfin', pattern: /redfin\.com/i, ownerFilter: 'fsbo', requiresZyte: true },
  { name: 'craigslist', pattern: /craigslist\.(org|com)/i, ownerFilter: null, requiresZyte: false },
  { name: 'facebook', pattern: /facebook\.com\/marketplace/i, ownerFilter: null, requiresZyte: true },
  { name: 'realtor', pattern: /realtor\.com/i, ownerFilter: 'fsbo', requiresZyte: true },
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
          address: { type: 'string', description: 'Full property address' },
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
          owner_name: { type: 'string', description: 'Property owner or landlord name' },
          owner_phone: { type: 'string', description: 'Owner phone number' },
          owner_email: { type: 'string', description: 'Owner email address' },
          listing_url: { type: 'string', description: 'Direct URL to this listing' },
          listing_id: { type: 'string', description: 'Unique listing identifier' },
          description: { type: 'string', description: 'Listing description (first 500 chars)' },
        },
      },
    },
  },
};

// AI prompt for extracting FSBO/FRBO listings
const FSBO_EXTRACTION_PROMPT = `Extract all For Sale By Owner (FSBO) and For Rent By Owner (FRBO) property listings from this page.

For EACH listing found, extract:
- Full property address (street, city, state, zip)
- Number of bedrooms (bed count)
- Number of bathrooms (bath count)  
- Price or monthly rent (include $ symbol)
- Days on market (how long listed)
- Number of favorites/saves/hearts
- Number of views
- Listing type (for_sale, for_rent, fsbo, frbo)
- Property type (house, condo, apartment, townhouse, multi-family)
- Square footage
- Year built if shown
- Owner/landlord name (if shown, not agent name)
- Owner phone number (if shown)
- Owner email (if shown)
- Direct link to the listing
- Listing ID or reference number

IMPORTANT: Only extract listings where the seller/landlord is the OWNER, not a real estate agent or property manager. Look for keywords like "FSBO", "For Sale By Owner", "Owner", "Landlord", "No Agent", "Private Sale", "For Rent By Owner".

Return empty values for fields not found on the page.`;

function detectPlatform(url: string): { name: string; ownerFilter: string | null; requiresZyte: boolean } | null {
  for (const platform of SUPPORTED_PLATFORMS) {
    if (platform.pattern.test(url)) {
      return { name: platform.name, ownerFilter: platform.ownerFilter, requiresZyte: platform.requiresZyte };
    }
  }
  return null;
}

function safeDecodeURIComponent(value: string): string {
  try {
    // Only decode if it looks encoded; otherwise leave as-is
    return /%[0-9A-Fa-f]{2}/.test(value) ? decodeURIComponent(value) : value;
  } catch {
    return value;
  }
}

function parseCityState(location: string): { city: string; state: string } {
  const decoded = safeDecodeURIComponent(location).trim();

  // Prefer explicit "City, State" inputs
  const commaParts = decoded.split(',').map((p) => p.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    return { city: commaParts[0], state: commaParts[1] };
  }

  // Also support "City State" / "City ST" (no comma)
  const tokens = decoded.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return { city: decoded, state: '' };

  const stateMap: Record<string, string> = {
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
    'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
    'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
    'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
    'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
    'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
    'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
    'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
    'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
    'district of columbia': 'DC',
  };

  const last = tokens[tokens.length - 1];
  const lastTwo = tokens.length >= 2 ? `${tokens[tokens.length - 2]} ${tokens[tokens.length - 1]}` : '';

  const lastNorm = last.toLowerCase();
  const lastTwoNorm = lastTwo.toLowerCase();

  // 1) Two-letter abbreviations like "TX"
  if (/^[A-Za-z]{2}$/.test(last)) {
    return { city: tokens.slice(0, -1).join(' '), state: last.toUpperCase() };
  }

  // 2) Full state name (including two-word names)
  if (stateMap[lastTwoNorm]) {
    return { city: tokens.slice(0, -2).join(' '), state: lastTwoNorm };
  }
  if (stateMap[lastNorm]) {
    return { city: tokens.slice(0, -1).join(' '), state: lastNorm };
  }

  return { city: decoded, state: '' };
}

function buildCityStateSlug(location: string): string {
  const { city, state } = parseCityState(location);
  const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const stateAbbrev = state ? getStateAbbreviation(state).toLowerCase() : '';
  return stateAbbrev ? `${citySlug}-${stateAbbrev}` : citySlug;
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function listingMatchesLocation(listingAddress: unknown, expectedCity: string, expectedStateAbbrev?: string): boolean {
  if (typeof listingAddress !== 'string') return false;

  const addr = normalizeForMatch(listingAddress);
  const city = normalizeForMatch(expectedCity);

  // If the city isn't even present, it's almost certainly the wrong market.
  if (city && !addr.includes(city)) return false;

  if (expectedStateAbbrev) {
    // Match " TX " or ", TX" or " TX," or end-of-string. Keep it loose but safe.
    const st = expectedStateAbbrev.toUpperCase();
    const stateRe = new RegExp(`(^|[^A-Z])${st}([^A-Z]|$)`);
    if (!stateRe.test(listingAddress.toUpperCase())) return false;
  }

  return true;
}

function buildSearchUrl(platform: string, location: string, listingType: 'sale' | 'rent'): string | null {
  const decodedLocation = safeDecodeURIComponent(location);

  // Default: lowercase, remove commas, replace spaces with hyphens (kept for platforms that accept full state names)
  const formattedLocation = decodedLocation.toLowerCase().replace(/,/g, '').replace(/\s+/g, '-');
  // Trulia: uses underscores
  const truliaLocation = decodedLocation.toLowerCase().replace(/,/g, '').replace(/\s+/g, '_');
  // City-state abbreviation slug (e.g. houston-tx)
  const cityStateSlug = buildCityStateSlug(decodedLocation);

  switch (platform) {
    case 'zillow':
      // Zillow uses searchQueryState with JSON params for FSBO/FRBO filtering
      if (listingType === 'sale') {
        const searchState = {
          isMapVisible: true,
          filterState: {
            sort: { value: 'globalrelevanceex' },
            nc: { value: false },
            fore: { value: false },
            auc: { value: false },
            fsba: { value: false },
            fsbo: { value: true },
          },
          isListVisible: true,
          usersSearchTerm: decodedLocation,
        };
        return `https://www.zillow.com/${formattedLocation}/fsbo/?searchQueryState=${encodeURIComponent(JSON.stringify(searchState))}`;
      } else {
        const searchState = {
          isMapVisible: true,
          filterState: {
            nc: { value: false },
            fore: { value: false },
            auc: { value: false },
            fsba: { value: false },
            fr: { value: true },
            fsbo: { value: false },
            cmsn: { value: false },
            att: { value: 'by owner' },
          },
          isListVisible: true,
          usersSearchTerm: decodedLocation,
        };
        return `https://www.zillow.com/${formattedLocation}/rentals/?searchQueryState=${encodeURIComponent(JSON.stringify(searchState))}`;
      }

    case 'fsbo': {
      // ForSaleByOwner.com: /search/list/{city}
      const { city } = parseCityState(decodedLocation);
      const fsboCity = city.trim().toLowerCase().replace(/\s+/g, '-');
      return `https://www.forsalebyowner.com/search/list/${fsboCity}`;
    }

    case 'trulia':
      return listingType === 'sale'
        ? `https://www.trulia.com/for_sale/${truliaLocation}/fsbo_lt/`
        : `https://www.trulia.com/for_rent/${truliaLocation}/`;

    case 'redfin': {
      // Redfin: /{STATE}/{City}/filter/include=fsbo
      const { city, state } = parseCityState(decodedLocation);
      const cityPath = city.replace(/\s+/g, '-');
      const stateAbbrev = getStateAbbreviation(state || '');
      return `https://www.redfin.com/${stateAbbrev}/${cityPath}/filter/include=fsbo`;
    }

    case 'hotpads':
      // HotPads is strict about city/state format; prefer city-stateAbbrev (houston-tx) to avoid 400s
      return `https://hotpads.com/${cityStateSlug}/for-rent-by-owner?isListedByOwner=true&listingTypes=rental`;

    case 'apartments':
      // Apartments.com also commonly uses city-stateAbbrev slugs
      return `https://www.apartments.com/${cityStateSlug}/for-rent-by-owner/`;

    default:
      return null;
  }
}

// Helper to get state abbreviation
function getStateAbbreviation(state: string): string {
  const stateMap: Record<string, string> = {
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
    'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
    'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
    'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
    'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
    'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
    'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
    'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
    'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
    'district of columbia': 'DC'
  };
  
  const normalized = state.toLowerCase().trim();
  // If already an abbreviation (2 chars), return uppercase
  if (normalized.length === 2) {
    return normalized.toUpperCase();
  }
  return stateMap[normalized] || normalized.toUpperCase().slice(0, 2);
}

// Zyte API scraping function with browser rendering
async function scrapeWithZyte(url: string, zyteApiKey: string): Promise<{ html: string; success: boolean; error?: string }> {
  console.log(`[Zyte] Attempting to scrape: ${url}`);
  
  try {
    const response = await fetch('https://api.zyte.com/v1/extract', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(zyteApiKey + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        browserHtml: true,
        javascript: true,
        actions: [
          { action: 'waitForTimeout', timeout: 5000 }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Zyte] API error: ${response.status}`, errorText);
      return { html: '', success: false, error: `Zyte API error: ${response.status}` };
    }

    const data = await response.json();
    console.log(`[Zyte] Successfully scraped ${url}`);
    return { html: data.browserHtml || '', success: true };
  } catch (error) {
    console.error(`[Zyte] Error:`, error);
    return { html: '', success: false, error: error instanceof Error ? error.message : 'Unknown Zyte error' };
  }
}

// Check if error indicates blocking
function isBlockedError(status: number, errorMessage: string): boolean {
  const blockedStatuses = [403, 429, 451, 503];
  const blockedMessages = ['blocked', 'captcha', 'rate limit', 'forbidden', 'access denied', 'bad request'];
  
  if (blockedStatuses.includes(status)) return true;
  
  const lowerError = errorMessage.toLowerCase();
  return blockedMessages.some(msg => lowerError.includes(msg));
}

// Extract listings from HTML content (basic parser for Zyte HTML responses)
function extractListingsFromHtml(html: string, sourceUrl: string): any[] {
  const listings: any[] = [];
  
  try {
    // Common patterns for real estate listing cards
    // This is a best-effort extraction that works across multiple platforms
    
    // Pattern 1: Look for price patterns like $XXX,XXX
    const priceRegex = /\$[\d,]+(?:\.\d{2})?/g;
    const prices = html.match(priceRegex) || [];
    
    // Pattern 2: Look for address patterns
    const addressRegex = /\d+\s+[\w\s]+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Ln|Lane|Way|Ct|Court)[\s,]+[\w\s]+,?\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s*\d{5}/gi;
    const addresses = html.match(addressRegex) || [];
    
    // Pattern 3: Look for bed/bath patterns
    const bedroomRegex = /(\d+)\s*(?:bed|br|bedroom)/gi;
    const bathroomRegex = /(\d+(?:\.\d)?)\s*(?:bath|ba|bathroom)/gi;
    
    // Pattern 4: Look for sqft patterns
    const sqftRegex = /([\d,]+)\s*(?:sq\s*ft|sqft|square\s*feet)/gi;
    
    // If we found addresses, create listings
    for (let i = 0; i < Math.min(addresses.length, 50); i++) {
      const listing: any = {
        address: addresses[i]?.trim(),
        price: prices[i] || null,
        source_url: sourceUrl,
      };
      
      // Try to extract bed/bath for this listing section
      const bedroomMatch = html.match(bedroomRegex);
      if (bedroomMatch && bedroomMatch[i]) {
        const bedNum = bedroomMatch[i].match(/(\d+)/);
        if (bedNum) listing.bedrooms = parseInt(bedNum[1]);
      }
      
      const bathroomMatch = html.match(bathroomRegex);
      if (bathroomMatch && bathroomMatch[i]) {
        const bathNum = bathroomMatch[i].match(/(\d+(?:\.\d)?)/);
        if (bathNum) listing.bathrooms = parseFloat(bathNum[1]);
      }
      
      const sqftMatch = html.match(sqftRegex);
      if (sqftMatch && sqftMatch[i]) {
        const sqft = sqftMatch[i].match(/([\d,]+)/);
        if (sqft) listing.square_feet = parseInt(sqft[1].replace(/,/g, ''));
      }
      
      // Determine listing type based on URL and content
      if (sourceUrl.includes('fsbo') || html.toLowerCase().includes('for sale by owner')) {
        listing.listing_type = 'fsbo';
      } else if (sourceUrl.includes('rent') || html.toLowerCase().includes('for rent')) {
        listing.listing_type = 'for_rent';
      } else {
        listing.listing_type = 'for_sale';
      }
      
      listings.push(listing);
    }
    
    // If no structured data found, try to extract at least some content
    if (listings.length === 0 && prices.length > 0) {
      for (let i = 0; i < Math.min(prices.length, 20); i++) {
        listings.push({
          price: prices[i],
          source_url: sourceUrl,
          listing_type: sourceUrl.includes('rent') ? 'for_rent' : 'for_sale',
        });
      }
    }
    
    console.log(`[extractListingsFromHtml] Found ${addresses.length} addresses, ${prices.length} prices, extracted ${listings.length} listings`);
  } catch (error) {
    console.error('[extractListingsFromHtml] Error parsing HTML:', error);
  }
  
  return listings;
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
      saveToJob,
      jobId,
    } = await req.json();

    const expectedLocation = location ? parseCityState(location) : null;
    const expectedCity = expectedLocation?.city || '';
    const expectedStateAbbrev = expectedLocation?.state ? getStateAbbreviation(expectedLocation.state) : '';

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const zyteApiKey = Deno.env.get('ZYTE_API_KEY');
    
    if (!firecrawlApiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Collect all URLs to scrape
    let urlsToScrape: string[] = [];

    if (url) {
      urlsToScrape.push(url);
    } else if (urls && Array.isArray(urls)) {
      urlsToScrape = urls;
    } else if (location && requestedPlatform) {
      // Build search URL for the platform
      const searchUrl = buildSearchUrl(requestedPlatform, location, listingType);
      if (searchUrl) {
        urlsToScrape.push(searchUrl);
      } else {
        return new Response(
          JSON.stringify({ success: false, error: `Platform ${requestedPlatform} not supported for search` }),
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

    console.log(`Scraping ${urlsToScrape.length} real estate URLs`);

    const allListings: any[] = [];
    const errors: { url: string; error: string }[] = [];
    let zyteUsed = 0;

    for (const targetUrl of urlsToScrape) {
      try {
        // Format URL
        let formattedUrl = targetUrl.trim();
        if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
          formattedUrl = `https://${formattedUrl}`;
        }

        const platform = detectPlatform(formattedUrl);
        console.log(`Scraping ${formattedUrl} (platform: ${platform?.name || 'unknown'}, requiresZyte: ${platform?.requiresZyte})`);

        let listings: any[] = [];
        let usedZyte = false;

        // Check if this platform is known to require Zyte
        const shouldTryZyteFirst = platform?.requiresZyte && zyteApiKey;

        if (shouldTryZyteFirst) {
          // For platforms known to block (Zillow, Redfin, etc.), try Zyte first
          console.log(`[${platform?.name}] Using Zyte API directly (known blocking site)`);
          const zyteResult = await scrapeWithZyte(formattedUrl, zyteApiKey!);
          
          if (zyteResult.success && zyteResult.html) {
            usedZyte = true;
            zyteUsed++;
            // Parse HTML to extract listings (basic extraction from HTML)
            listings = extractListingsFromHtml(zyteResult.html, formattedUrl);
            console.log(`[Zyte] Extracted ${listings.length} listings from ${formattedUrl}`);
          } else {
            console.error(`[Zyte] Failed for ${formattedUrl}: ${zyteResult.error}`);
            errors.push({ url: formattedUrl, error: `Zyte: ${zyteResult.error}` });
            continue;
          }
        } else {
          // Try Firecrawl first
          const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: formattedUrl,
              // IMPORTANT: Firecrawl only returns structured extraction when `json` is included in formats.
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
            const errorMessage = data.error || `HTTP ${response.status}`;
            console.error(`Firecrawl error for ${formattedUrl}:`, errorMessage);
            
            // Check if we should fallback to Zyte
            if (isBlockedError(response.status, errorMessage) && zyteApiKey) {
              console.log(`[Fallback] Firecrawl blocked, trying Zyte for ${formattedUrl}`);
              
              const zyteResult = await scrapeWithZyte(formattedUrl, zyteApiKey);
              
              if (zyteResult.success && zyteResult.html) {
                usedZyte = true;
                zyteUsed++;
                listings = extractListingsFromHtml(zyteResult.html, formattedUrl);
                console.log(`[Zyte Fallback] Extracted ${listings.length} listings from ${formattedUrl}`);
              } else {
                errors.push({ url: formattedUrl, error: `Both Firecrawl and Zyte failed: ${zyteResult.error}` });
                continue;
              }
            } else if (isBlockedError(response.status, errorMessage) && !zyteApiKey) {
              errors.push({ url: formattedUrl, error: `${errorMessage} (Zyte API not configured for fallback)` });
              continue;
            } else {
              errors.push({ url: formattedUrl, error: errorMessage });
              continue;
            }
          } else {
            // Firecrawl succeeded
            const extractedData = data.data?.json || data.json || {};
            listings = extractedData.listings || [];
          }
        }
        
        // Enrich each listing with source info
        for (const listing of listings) {
          // When searching by location, drop obviously out-of-market results.
          // This prevents "fallback"/cross-market cards (e.g. IL/NE) from being returned.
          if (location && !listingMatchesLocation((listing as any)?.address, expectedCity, expectedStateAbbrev)) {
            continue;
          }

          allListings.push({
            ...listing,
            source_url: formattedUrl,
            source_platform: platform?.name || 'unknown',
            scraped_at: new Date().toISOString(),
            scraped_via: usedZyte ? 'zyte' : 'firecrawl',
          });
        }

        console.log(`Found ${listings.length} listings from ${formattedUrl} (via ${usedZyte ? 'Zyte' : 'Firecrawl'})`);

        // Rate limiting between requests
        if (urlsToScrape.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Error scraping ${targetUrl}:`, error);
        errors.push({ url: targetUrl, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    // Optionally save to scrape job
    if (saveToJob && jobId && allListings.length > 0) {
      console.log(`Saving ${allListings.length} listings to job ${jobId}`);
      
      for (const listing of allListings) {
        try {
          await adminSupabase.from('scraped_leads').insert({
            job_id: jobId,
            domain: new URL(listing.source_url).hostname,
            source_url: listing.source_url,
            full_name: listing.owner_name || null,
            best_email: listing.owner_email || null,
            best_phone: listing.owner_phone || null,
            address: listing.address || null,
            lead_type: listing.listing_type || 'fsbo',
            status: 'pending',
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
              description: listing.description,
              source_platform: listing.source_platform,
            },
          });
        } catch (insertError) {
          console.error('Error inserting listing:', insertError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        listings: allListings,
        total: allListings.length,
        urls_scraped: urlsToScrape.length,
        zyte_fallback_used: zyteUsed,
        zyte_available: !!zyteApiKey,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in real estate scraper:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
