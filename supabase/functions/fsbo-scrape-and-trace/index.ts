import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Supported platforms with scraping strategies
const SUPPORTED_PLATFORMS = [
  { name: 'zillow', pattern: /zillow\.com/i, ownerFilter: 'fsbo', requiresZyte: true, strategy: 'zillow' },
  { name: 'apartments', pattern: /apartments\.com/i, ownerFilter: 'owner', requiresZyte: false, strategy: 'apartments' },
  { name: 'hotpads', pattern: /hotpads\.com/i, ownerFilter: 'owner', requiresZyte: true, strategy: 'hotpads' },
  { name: 'fsbo', pattern: /fsbo\.com/i, ownerFilter: null, requiresZyte: false, strategy: 'generic' },
  { name: 'trulia', pattern: /trulia\.com/i, ownerFilter: 'fsbo', requiresZyte: true, strategy: 'generic' },
  { name: 'redfin', pattern: /redfin\.com/i, ownerFilter: 'fsbo', requiresZyte: true, strategy: 'generic' },
  { name: 'craigslist', pattern: /craigslist\.(org|com)/i, ownerFilter: null, requiresZyte: false, strategy: 'generic' },
  { name: 'realtor', pattern: /realtor\.com/i, ownerFilter: 'fsbo', requiresZyte: true, strategy: 'generic' },
];

// State abbreviation mapping
const STATE_MAP: Record<string, string> = {
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
  scraped_via?: string;
  owner_name?: string;
  owner_phone?: string;
  owner_email?: string;
  all_phones?: Array<{ number: string; type: string }>;
  all_emails?: Array<{ address: string; type?: string }>;
  skip_trace_confidence?: number;
  skip_trace_status?: 'pending' | 'success' | 'not_found' | 'error';
  skip_trace_error?: string;
}

function getStateAbbreviation(state: string): string {
  const normalized = state.toLowerCase().trim();
  if (normalized.length === 2) return normalized.toUpperCase();
  return STATE_MAP[normalized] || normalized.toUpperCase().slice(0, 2);
}

function safeDecodeURIComponent(value: string): string {
  try {
    return /%[0-9A-Fa-f]{2}/.test(value) ? decodeURIComponent(value) : value;
  } catch {
    return value;
  }
}

function parseCityState(location: string): { city: string; state: string } {
  const decoded = safeDecodeURIComponent(location).trim();
  const commaParts = decoded.split(',').map((p) => p.trim()).filter(Boolean);
  
  if (commaParts.length >= 2) {
    return { city: commaParts[0], state: commaParts[1] };
  }

  const tokens = decoded.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return { city: decoded, state: '' };

  const last = tokens[tokens.length - 1];
  const lastTwo = tokens.length >= 2 ? `${tokens[tokens.length - 2]} ${tokens[tokens.length - 1]}` : '';

  if (/^[A-Za-z]{2}$/.test(last)) {
    return { city: tokens.slice(0, -1).join(' '), state: last.toUpperCase() };
  }

  const lastTwoNorm = lastTwo.toLowerCase();
  const lastNorm = last.toLowerCase();

  if (STATE_MAP[lastTwoNorm]) {
    return { city: tokens.slice(0, -2).join(' '), state: lastTwoNorm };
  }
  if (STATE_MAP[lastNorm]) {
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
  if (city && !addr.includes(city)) return false;
  if (expectedStateAbbrev) {
    const st = expectedStateAbbrev.toUpperCase();
    const stateRe = new RegExp(`(^|[^A-Z])${st}([^A-Z]|$)`);
    if (!stateRe.test(listingAddress.toUpperCase())) return false;
  }
  return true;
}

function cleanPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/[^0-9+]/g, '').replace(/^[-=]+/, '');
}

function buildSearchUrl(platform: string, location: string, listingType: 'sale' | 'rent'): string | null {
  const decodedLocation = safeDecodeURIComponent(location);
  const formattedLocation = decodedLocation.toLowerCase().replace(/,/g, '').replace(/\s+/g, '-');
  const cityStateSlug = buildCityStateSlug(decodedLocation);

  switch (platform) {
    case 'zillow':
      if (listingType === 'sale') {
        return `https://www.zillow.com/${formattedLocation}/fsbo/`;
      } else {
        return `https://www.zillow.com/homes/for_rent/${formattedLocation}/`;
      }
    case 'fsbo': {
      const { city } = parseCityState(decodedLocation);
      const fsboCity = city.trim().toLowerCase().replace(/\s+/g, '-');
      return `https://www.forsalebyowner.com/search/list/${fsboCity}`;
    }
    case 'hotpads':
      return `https://hotpads.com/${cityStateSlug}/for-rent-by-owner?isListedByOwner=true&listingTypes=rental`;
    case 'apartments':
      return `https://www.apartments.com/${cityStateSlug}/for-rent-by-owner/`;
    default:
      return null;
  }
}

function detectPlatform(url: string): { name: string; ownerFilter: string | null; requiresZyte: boolean; strategy: string } | null {
  for (const platform of SUPPORTED_PLATFORMS) {
    if (platform.pattern.test(url)) {
      return { name: platform.name, ownerFilter: platform.ownerFilter, requiresZyte: platform.requiresZyte, strategy: platform.strategy };
    }
  }
  return null;
}

// Scrape using Zyte API
async function scrapeWithZyte(url: string, zyteApiKey: string): Promise<{ html: string; success: boolean; error?: string }> {
  console.log(`[Zyte] Scraping: ${url}`);
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
        actions: [{ action: 'waitForTimeout', timeout: 5000 }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Zyte] API error: ${response.status}`, errorText);
      return { html: '', success: false, error: `Zyte API error: ${response.status}` };
    }

    const data = await response.json();
    return { html: data.browserHtml || '', success: true };
  } catch (error) {
    console.error(`[Zyte] Error:`, error);
    return { html: '', success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ==================== PLATFORM-SPECIFIC EXTRACTORS ====================

// Extract Zillow listings from #__NEXT_DATA__ JSON
function extractZillowListings(html: string, sourceUrl: string, listingType: 'sale' | 'rent'): EnrichedListing[] {
  const listings: EnrichedListing[] = [];
  
  try {
    const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/i);
    if (!nextDataMatch) {
      console.log('[Zillow] No __NEXT_DATA__ found');
      return listings;
    }

    const jsonData = JSON.parse(nextDataMatch[1]);
    const searchResults = 
      jsonData?.props?.pageProps?.searchPageState?.cat1?.searchResults?.listResults ||
      jsonData?.props?.pageProps?.searchPageState?.cat2?.searchResults?.listResults ||
      [];

    console.log(`[Zillow] Found ${searchResults.length} listings in __NEXT_DATA__`);

    for (const home of searchResults) {
      const detailUrl = home.detailUrl || '';
      const fullUrl = detailUrl.startsWith('https') ? detailUrl : `https://www.zillow.com${detailUrl}`;
      
      // For FSBO, check listedBy for PROPERTY_OWNER
      let ownerPhone = '';
      const listedBy = home.listedBy || [];
      for (const b of listedBy) {
        if (b.id === 'PROPERTY_OWNER') {
          const elements = b.elements || [];
          for (const elem of elements) {
            if (elem.id === 'PHONE') {
              ownerPhone = elem.text || '';
            }
          }
        }
      }

      const listing: EnrichedListing = {
        address: home.address || '',
        bedrooms: home.beds || home.bedrooms || undefined,
        bathrooms: home.baths || home.bathrooms || undefined,
        price: home.price || (home.unformattedPrice ? `$${home.unformattedPrice}` : undefined),
        square_feet: home.area || home.sqft || undefined,
        listing_url: fullUrl,
        listing_id: home.zpid?.toString() || home.id || undefined,
        property_type: home.homeType?.replace('_', ' ').replace('HOME_TYPE', '').trim() || undefined,
        listing_type: listingType === 'sale' ? 'fsbo' : 'frbo',
        days_on_market: home.daysOnZillow || undefined,
        favorites_count: home.favoriteCount || undefined,
        views_count: home.pageViewCount || undefined,
        owner_phone: cleanPhone(ownerPhone) || undefined,
        source_url: sourceUrl,
        source_platform: 'zillow',
        scraped_at: new Date().toISOString(),
        skip_trace_status: 'pending',
      };
      
      listings.push(listing);
    }
  } catch (error) {
    console.error('[Zillow] Error parsing:', error);
  }

  return listings;
}

// Extract Apartments.com listings from JSON-LD
function extractApartmentsListings(html: string, sourceUrl: string): EnrichedListing[] {
  const listings: EnrichedListing[] = [];
  
  try {
    const jsonLdMatch = html.match(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (!jsonLdMatch) {
      console.log('[Apartments] No JSON-LD found');
      return listings;
    }

    const jsonData = JSON.parse(jsonLdMatch[1]);
    const records = jsonData.about || [];

    console.log(`[Apartments] Found ${records.length} listings in JSON-LD`);

    // Extract additional data from HTML
    const bedRangeMatches = html.match(/<div[^>]*class="[^"]*bed-range[^"]*"[^>]*>([^<]*)<\/div>/gi) || [];
    const priceRangeMatches = html.match(/<div[^>]*class="[^"]*price-range[^"]*"[^>]*>([^<]*)<\/div>/gi) || [];

    for (let idx = 0; idx < records.length; idx++) {
      const record = records[idx];
      const address = record.Address || {};
      
      const streetAddress = address.streetAddress?.trim() || '';
      const addressLocality = address.addressLocality?.trim() || '';
      const addressRegion = address.addressRegion?.trim() || '';
      const postalCode = address.postalCode?.trim() || '';
      const fullAddress = [streetAddress, addressLocality, `${addressRegion} ${postalCode}`]
        .filter(Boolean).join(', ').trim();

      let bedsBaths = '';
      if (bedRangeMatches[idx]) {
        const match = bedRangeMatches[idx].match(/>([^<]*)</);
        if (match) bedsBaths = match[1].trim();
      }

      let price = '';
      if (priceRangeMatches[idx]) {
        const match = priceRangeMatches[idx].match(/>([^<]*)</);
        if (match) price = match[1].trim();
      }

      const listing: EnrichedListing = {
        address: fullAddress,
        owner_name: record.name || undefined,
        owner_phone: cleanPhone(record.telephone) || undefined,
        listing_url: record.url || undefined,
        price: price || undefined,
        listing_type: 'frbo',
        source_url: sourceUrl,
        source_platform: 'apartments',
        scraped_at: new Date().toISOString(),
        skip_trace_status: 'pending',
      };

      if (bedsBaths) {
        const bedMatch = bedsBaths.match(/(\d+)\s*(?:bed|br)/i);
        const bathMatch = bedsBaths.match(/(\d+(?:\.\d)?)\s*(?:bath|ba)/i);
        if (bedMatch) listing.bedrooms = parseInt(bedMatch[1]);
        if (bathMatch) listing.bathrooms = parseFloat(bathMatch[1]);
      }

      listings.push(listing);
    }
  } catch (error) {
    console.error('[Apartments] Error parsing:', error);
  }

  return listings;
}

// Extract HotPads listings from JSON-LD @graph
function extractHotpadsListings(html: string, sourceUrl: string): EnrichedListing[] {
  const listings: EnrichedListing[] = [];
  
  try {
    const jsonLdMatch = html.match(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (!jsonLdMatch) {
      console.log('[HotPads] No JSON-LD found');
      return listings;
    }

    const jsonData = JSON.parse(jsonLdMatch[1]);
    const graph = jsonData['@graph'] || [];

    console.log(`[HotPads] Found ${graph.length} items in @graph`);

    for (const detail of graph) {
      const mainEntity = detail.mainEntity;
      if (!mainEntity) continue;

      const address = mainEntity.address || {};
      const streetAddress = address.streetAddress?.trim() || '';
      const addressLocality = address.addressLocality?.trim() || '';
      const addressRegion = address.addressRegion?.trim() || '';
      const postalCode = address.postalCode?.trim() || '';
      const fullAddress = [streetAddress, addressLocality, `${addressRegion} ${postalCode}`]
        .filter(Boolean).join(', ').trim();

      const listing: EnrichedListing = {
        address: fullAddress,
        owner_name: mainEntity.name?.trim() || undefined,
        owner_phone: cleanPhone(mainEntity.telephone) || undefined,
        description: mainEntity.description?.trim()?.slice(0, 500) || undefined,
        listing_type: 'frbo',
        source_url: sourceUrl,
        source_platform: 'hotpads',
        scraped_at: new Date().toISOString(),
        skip_trace_status: 'pending',
      };

      listings.push(listing);
    }

    // Extract beds/baths from HTML patterns
    const bedMatch = html.match(/(\d+)\s*(?:bed|bedroom)/i);
    const bathMatch = html.match(/(\d+(?:\.\d)?)\s*(?:bath|bathroom)/i);
    
    if (listings.length > 0) {
      if (bedMatch) listings[0].bedrooms = parseInt(bedMatch[1]);
      if (bathMatch) listings[0].bathrooms = parseFloat(bathMatch[1]);
    }
  } catch (error) {
    console.error('[HotPads] Error parsing:', error);
  }

  return listings;
}

// Generic extraction fallback
function extractGenericListings(html: string, sourceUrl: string): EnrichedListing[] {
  const listings: EnrichedListing[] = [];
  
  try {
    const priceRegex = /\$[\d,]+(?:\.\d{2})?/g;
    const prices = html.match(priceRegex) || [];
    
    const addressRegex = /\d+\s+[\w\s]+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Ln|Lane|Way|Ct|Court)[\s,]+[\w\s]+,?\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s*\d{5}/gi;
    const addresses = html.match(addressRegex) || [];
    
    for (let i = 0; i < Math.min(addresses.length, 50); i++) {
      const listing: EnrichedListing = {
        address: addresses[i]?.trim(),
        price: prices[i] || undefined,
        source_url: sourceUrl,
        source_platform: 'unknown',
        scraped_at: new Date().toISOString(),
        skip_trace_status: 'pending',
        listing_type: sourceUrl.includes('fsbo') ? 'fsbo' : sourceUrl.includes('rent') ? 'frbo' : 'for_sale',
      };
      
      listings.push(listing);
    }

    console.log(`[Generic] Extracted ${listings.length} listings`);
  } catch (error) {
    console.error('[Generic] Error:', error);
  }
  
  return listings;
}

// Skip trace a single address using Tracerfy
async function skipTraceAddress(address: string, tracerfyApiKey: string): Promise<SkipTraceResult> {
  if (!address || address.trim().length < 5) {
    return { success: false, error: 'Invalid address' };
  }

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

// Main handler
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      listingType = 'rent',
      enableSkipTrace = true,
      saveToDatabase = false,
      jobId,
    } = await req.json();

    const expectedLocation = location ? parseCityState(location) : null;
    const expectedCity = expectedLocation?.city || '';
    const expectedStateAbbrev = expectedLocation?.state ? getStateAbbreviation(expectedLocation.state) : '';

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const zyteApiKey = Deno.env.get('ZYTE_API_KEY');
    const tracerfyApiKey = Deno.env.get('TRACERFY_API_KEY');
    
    if (!firecrawlApiKey && !zyteApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'No scraping API configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      const platformsToSearch = ['apartments', 'hotpads', 'zillow'];
      for (const pName of platformsToSearch) {
        const searchUrl = buildSearchUrl(pName, location, listingType);
        if (searchUrl) urlsToScrape.push(searchUrl);
      }
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Either url, urls, or location is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting FSBO scrape + skip trace for ${urlsToScrape.length} URLs`);
    console.log('URLs:', urlsToScrape);

    const allListings: EnrichedListing[] = [];
    const errors: { url: string; error: string }[] = [];
    let skipTraceCount = 0;
    let skipTraceSuccessCount = 0;
    let zyteUsed = 0;

    // Step 1: Scrape all URLs
    for (const targetUrl of urlsToScrape) {
      try {
        let formattedUrl = targetUrl.trim();
        if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
          formattedUrl = `https://${formattedUrl}`;
        }

        const platform = detectPlatform(formattedUrl);
        console.log(`\n[Scraping] ${formattedUrl}`);
        console.log(`[Platform] ${platform?.name || 'unknown'} (strategy: ${platform?.strategy})`);

        let html = '';
        let usedZyte = false;

        // Get HTML content
        if (platform?.requiresZyte && zyteApiKey) {
          const zyteResult = await scrapeWithZyte(formattedUrl, zyteApiKey);
          if (zyteResult.success) {
            html = zyteResult.html;
            usedZyte = true;
            zyteUsed++;
          } else {
            errors.push({ url: formattedUrl, error: zyteResult.error || 'Zyte failed' });
            continue;
          }
        } else if (firecrawlApiKey) {
          const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: formattedUrl,
              formats: ['rawHtml'],
              onlyMainContent: false,
              waitFor: 3000,
            }),
          });

          const data = await response.json();
          if (!response.ok) {
            if (zyteApiKey) {
              console.log('[Firecrawl] Failed, trying Zyte...');
              const zyteResult = await scrapeWithZyte(formattedUrl, zyteApiKey);
              if (zyteResult.success) {
                html = zyteResult.html;
                usedZyte = true;
                zyteUsed++;
              } else {
                errors.push({ url: formattedUrl, error: 'Both Firecrawl and Zyte failed' });
                continue;
              }
            } else {
              errors.push({ url: formattedUrl, error: data.error || `HTTP ${response.status}` });
              continue;
            }
          } else {
            html = data.data?.rawHtml || data.rawHtml || '';
          }
        } else if (zyteApiKey) {
          const zyteResult = await scrapeWithZyte(formattedUrl, zyteApiKey);
          if (zyteResult.success) {
            html = zyteResult.html;
            usedZyte = true;
            zyteUsed++;
          } else {
            errors.push({ url: formattedUrl, error: zyteResult.error || 'Zyte failed' });
            continue;
          }
        }

        if (!html) {
          errors.push({ url: formattedUrl, error: 'No HTML content' });
          continue;
        }

        console.log(`[HTML] Got ${html.length} chars (via ${usedZyte ? 'Zyte' : 'Firecrawl'})`);

        // Extract listings based on platform
        let listings: EnrichedListing[] = [];

        switch (platform?.strategy) {
          case 'zillow':
            listings = extractZillowListings(html, formattedUrl, listingType);
            break;
          case 'apartments':
            listings = extractApartmentsListings(html, formattedUrl);
            break;
          case 'hotpads':
            listings = extractHotpadsListings(html, formattedUrl);
            break;
          default:
            listings = extractGenericListings(html, formattedUrl);
        }

        console.log(`[Extracted] ${listings.length} listings`);

        // Filter by location
        for (const listing of listings) {
          if (location && listing.address && !listingMatchesLocation(listing.address, expectedCity, expectedStateAbbrev)) {
            console.log(`[Filtered] "${listing.address}" doesn't match ${expectedCity}, ${expectedStateAbbrev}`);
            continue;
          }
          listing.scraped_via = usedZyte ? 'zyte' : 'firecrawl';
          allListings.push(listing);
        }

        if (urlsToScrape.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (error) {
        console.error(`Error scraping ${targetUrl}:`, error);
        errors.push({ url: targetUrl, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    console.log(`\n[Scraped] ${allListings.length} total listings`);

    // Step 2: Skip trace listings
    if (enableSkipTrace && tracerfyApiKey && allListings.length > 0) {
      console.log('\n[Skip Trace] Starting...');
      
      for (const listing of allListings) {
        if (!listing.address) {
          listing.skip_trace_status = 'error';
          listing.skip_trace_error = 'No address';
          continue;
        }

        if (listing.owner_name && listing.owner_phone) {
          listing.skip_trace_status = 'success';
          listing.skip_trace_confidence = 100;
          continue;
        }

        skipTraceCount++;
        
        try {
          console.log(`[Skip Trace] ${listing.address}`);
          const traceResult = await skipTraceAddress(listing.address, tracerfyApiKey);
          
          if (traceResult.success && traceResult.data) {
            const data = traceResult.data;
            
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
          
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Skip trace error for ${listing.address}:`, error);
          listing.skip_trace_status = 'error';
          listing.skip_trace_error = error instanceof Error ? error.message : 'Unknown error';
        }
      }
      
      console.log(`[Skip Trace] ${skipTraceCount} attempted, ${skipTraceSuccessCount} successful`);
    }

    // Step 3: Save to database
    let savedCount = 0;
    if (saveToDatabase && allListings.length > 0) {
      console.log(`\n[Saving] ${allListings.length} listings to database`);
      
      for (const listing of allListings) {
        try {
          await adminSupabase.from('scraped_leads').insert({
            job_id: jobId || null,
            domain: listing.source_platform || 'unknown',
            source_url: listing.listing_url || listing.source_url,
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
              scraped_via: listing.scraped_via,
              skip_trace_status: listing.skip_trace_status,
            },
          });
          savedCount++;
        } catch (insertError) {
          console.error('Insert error:', insertError);
        }
      }
      
      console.log(`[Saved] ${savedCount} listings`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        listings: allListings,
        total: allListings.length,
        urls_scraped: urlsToScrape.length,
        zyte_used: zyteUsed,
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
