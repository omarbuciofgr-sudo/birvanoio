import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Supported real estate platforms with scraping strategies
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
    case 'trulia':
      return listingType === 'sale'
        ? `https://www.trulia.com/for_sale/${decodedLocation.toLowerCase().replace(/,/g, '').replace(/\s+/g, '_')}/fsbo_lt/`
        : `https://www.trulia.com/for_rent/${decodedLocation.toLowerCase().replace(/,/g, '').replace(/\s+/g, '_')}/`;
    case 'redfin': {
      const { city, state } = parseCityState(decodedLocation);
      const cityPath = city.replace(/\s+/g, '-');
      const stateAbbrev = getStateAbbreviation(state || '');
      return `https://www.redfin.com/${stateAbbrev}/${cityPath}/filter/include=fsbo`;
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

// Scrape using Zyte API with browser rendering
async function scrapeWithZyte(url: string, zyteApiKey: string): Promise<{ html: string; success: boolean; error?: string }> {
  console.log(`[Zyte] Scraping: ${url}`);
  try {
    const response = await fetch('https://api.zyte.com/v1/extract', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(zyteApiKey + ':')}`,
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        url: url,
        browserHtml: true,
        actions: [
          { action: 'waitForSelector', selector: { type: 'css', value: 'body' }, timeout: 10 },
          { action: 'waitForTimeout', timeout: 3 }
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

// ==================== PLATFORM-SPECIFIC EXTRACTORS ====================

// Extract Zillow listings from #__NEXT_DATA__ JSON (proven pattern from scrapy)
function extractZillowListings(html: string, sourceUrl: string, listingType: 'sale' | 'rent'): any[] {
  const listings: any[] = [];
  
  try {
    // Extract __NEXT_DATA__ JSON
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
      
      const listing: any = {
        address: home.address || '',
        bedrooms: home.beds || home.bedrooms || null,
        bathrooms: home.baths || home.bathrooms || null,
        price: home.price || home.unformattedPrice ? `$${home.unformattedPrice || home.price}` : null,
        square_feet: home.area || home.sqft || null,
        listing_url: fullUrl,
        listing_id: home.zpid?.toString() || home.id || null,
        property_type: home.homeType?.replace('_', ' ').replace('HOME_TYPE', '').trim() || null,
        listing_type: listingType === 'sale' ? 'fsbo' : 'frbo',
        source_url: sourceUrl,
        source_platform: 'zillow',
        scraped_at: new Date().toISOString(),
      };

      // Try to get zpid for later agent lookup
      listing._zpid = home.zpid || null;
      
      listings.push(listing);
    }
  } catch (error) {
    console.error('[Zillow] Error parsing __NEXT_DATA__:', error);
  }

  return listings;
}

// Extract Apartments.com listings from JSON-LD and HTML (proven pattern from scrapy)
function extractApartmentsListings(html: string, sourceUrl: string): any[] {
  const listings: any[] = [];
  
  try {
    // Try to find all JSON-LD scripts (there may be multiple)
    const jsonLdMatches = html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    let records: any[] = [];
    
    for (const match of jsonLdMatches) {
      try {
        const jsonData = JSON.parse(match[1]);
        
        // Check for ItemList structure (newer format)
        if (jsonData['@type'] === 'ItemList' && jsonData.itemListElement) {
          for (const item of jsonData.itemListElement) {
            if (item.item) {
              records.push(item.item);
            } else if (item['@type'] && item['@type'] !== 'ListItem') {
              records.push(item);
            }
          }
        }
        // Check for about array (older format)
        else if (jsonData.about && Array.isArray(jsonData.about)) {
          records = records.concat(jsonData.about);
        }
        // Check for SearchResultsPage with mainEntity
        else if (jsonData['@type'] === 'SearchResultsPage' && jsonData.mainEntity) {
          const mainEntity = Array.isArray(jsonData.mainEntity) ? jsonData.mainEntity : [jsonData.mainEntity];
          records = records.concat(mainEntity);
        }
        // Direct array of properties
        else if (Array.isArray(jsonData)) {
          records = records.concat(jsonData.filter(item => item.address || item.Address));
        }
      } catch (e) {
        // Continue to next JSON-LD block
      }
    }

    console.log(`[Apartments] Found ${records.length} listings in JSON-LD`);

    // If no JSON-LD records, try HTML extraction
    if (records.length === 0) {
      console.log('[Apartments] No JSON-LD listings, trying HTML extraction');
      return extractApartmentsFromHTML(html, sourceUrl);
    }

    for (const record of records) {
      const address = record.Address || record.address || {};
      
      const streetAddress = (address.streetAddress || address.street || '')?.trim() || '';
      const addressLocality = (address.addressLocality || address.city || '')?.trim() || '';
      const addressRegion = (address.addressRegion || address.state || '')?.trim() || '';
      const postalCode = (address.postalCode || address.zip || '')?.trim() || '';
      const fullAddress = [streetAddress, addressLocality, `${addressRegion} ${postalCode}`]
        .filter(Boolean).join(', ').trim();

      if (!fullAddress) continue;

      // Get price from offers if available
      let price = record.offers?.price || record.offers?.lowPrice || record.priceRange || null;
      if (price && typeof price === 'number') {
        price = `$${price.toLocaleString()}`;
      }

      const listing: any = {
        address: fullAddress,
        owner_name: record.name || null,
        owner_phone: cleanPhone(record.telephone),
        listing_url: record.url || null,
        price: price,
        listing_type: 'frbo',
        source_url: sourceUrl,
        source_platform: 'apartments',
        scraped_at: new Date().toISOString(),
      };

      // Extract beds/baths from numberOfRooms or description
      if (record.numberOfRooms) {
        listing.bedrooms = typeof record.numberOfRooms === 'number' ? record.numberOfRooms : parseInt(record.numberOfRooms);
      }
      if (record.numberOfBathroomsTotal) {
        listing.bathrooms = typeof record.numberOfBathroomsTotal === 'number' ? record.numberOfBathroomsTotal : parseFloat(record.numberOfBathroomsTotal);
      }

      listings.push(listing);
    }
  } catch (error) {
    console.error('[Apartments] Error parsing JSON-LD:', error);
    // Try HTML fallback on error
    return extractApartmentsFromHTML(html, sourceUrl);
  }

  // If still no listings, try HTML fallback
  if (listings.length === 0) {
    return extractApartmentsFromHTML(html, sourceUrl);
  }

  return listings;
}

// Fallback: Extract Apartments.com listings from HTML structure
function extractApartmentsFromHTML(html: string, sourceUrl: string): any[] {
  const listings: any[] = [];
  
  try {
    // Match property cards - multiple possible class patterns
    const cardPatterns = [
      /<article[^>]*class="[^"]*placard[^"]*"[^>]*>([\s\S]*?)<\/article>/gi,
      /<li[^>]*class="[^"]*mortar-wrapper[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
      /<div[^>]*class="[^"]*property-card[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    ];

    let cards: string[] = [];
    for (const pattern of cardPatterns) {
      const matches = html.match(pattern) || [];
      if (matches.length > 0) {
        cards = matches;
        break;
      }
    }

    console.log(`[Apartments] Found ${cards.length} property cards in HTML`);

    for (const card of cards.slice(0, 50)) {
      // Extract address
      const addressMatch = card.match(/class="[^"]*property-address[^"]*"[^>]*>([^<]+)</i) ||
                          card.match(/class="[^"]*address[^"]*"[^>]*>([^<]+)</i) ||
                          card.match(/<span[^>]*title="([^"]+)"/i);
      
      // Extract price
      const priceMatch = card.match(/\$[\d,]+(?:\s*-\s*\$[\d,]+)?/);
      
      // Extract phone
      const phoneMatch = card.match(/tel:([^"]+)"/i) ||
                        card.match(/>(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})</);
      
      // Extract URL
      const urlMatch = card.match(/href="(https:\/\/www\.apartments\.com\/[^"]+)"/i) ||
                      card.match(/href="(\/[^"]+)"/i);

      // Extract beds/baths
      const bedsMatch = card.match(/(\d+)\s*(?:bed|br)/i);
      const bathsMatch = card.match(/(\d+(?:\.\d)?)\s*(?:bath|ba)/i);

      if (addressMatch || urlMatch) {
        const listing: any = {
          address: addressMatch?.[1]?.trim() || 'Unknown Address',
          price: priceMatch?.[0] || null,
          owner_phone: phoneMatch ? cleanPhone(phoneMatch[1]) : null,
          listing_url: urlMatch?.[1]?.startsWith('http') ? urlMatch[1] : urlMatch?.[1] ? `https://www.apartments.com${urlMatch[1]}` : null,
          listing_type: 'frbo',
          source_url: sourceUrl,
          source_platform: 'apartments',
          scraped_at: new Date().toISOString(),
        };

        if (bedsMatch) listing.bedrooms = parseInt(bedsMatch[1]);
        if (bathsMatch) listing.bathrooms = parseFloat(bathsMatch[1]);

        listings.push(listing);
      }
    }
  } catch (error) {
    console.error('[Apartments] Error extracting from HTML:', error);
  }

  return listings;
}

// Extract HotPads listings from JSON-LD @graph (proven pattern from scrapy)
function extractHotpadsListings(html: string, sourceUrl: string): any[] {
  const listings: any[] = [];
  
  try {
    // Extract JSON-LD script
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

      const listing: any = {
        address: fullAddress,
        owner_name: mainEntity.name?.trim() || null,
        owner_phone: cleanPhone(mainEntity.telephone),
        description: mainEntity.description?.trim()?.slice(0, 500) || null,
        listing_type: 'frbo',
        source_url: sourceUrl,
        source_platform: 'hotpads',
        scraped_at: new Date().toISOString(),
      };

      listings.push(listing);
    }

    // Also try to extract beds/baths from HTML if JSON-LD doesn't have them
    // Pattern: HdpSummaryDetails divs
    const bedMatch = html.match(/class="[^"]*HdpSummaryDetails[^"]*"[\s\S]*?(\d+)\s*(?:bed|br)/i);
    const bathMatch = html.match(/class="[^"]*HdpSummaryDetails[^"]*"[\s\S]*?(\d+(?:\.\d)?)\s*(?:bath|ba)/i);
    
    if (listings.length > 0) {
      if (bedMatch) listings[0].bedrooms = parseInt(bedMatch[1]);
      if (bathMatch) listings[0].bathrooms = parseFloat(bathMatch[1]);
    }
  } catch (error) {
    console.error('[HotPads] Error parsing JSON-LD:', error);
  }

  return listings;
}

// Generic extraction using regex patterns (fallback)
function extractGenericListings(html: string, sourceUrl: string): any[] {
  const listings: any[] = [];
  
  try {
    // Price patterns
    const priceRegex = /\$[\d,]+(?:\.\d{2})?/g;
    const prices = html.match(priceRegex) || [];
    
    // Address patterns
    const addressRegex = /\d+\s+[\w\s]+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Ln|Lane|Way|Ct|Court)[\s,]+[\w\s]+,?\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s*\d{5}/gi;
    const addresses = html.match(addressRegex) || [];
    
    for (let i = 0; i < Math.min(addresses.length, 50); i++) {
      const listing: any = {
        address: addresses[i]?.trim(),
        price: prices[i] || null,
        source_url: sourceUrl,
        source_platform: 'unknown',
        scraped_at: new Date().toISOString(),
      };
      
      if (sourceUrl.includes('fsbo') || html.toLowerCase().includes('for sale by owner')) {
        listing.listing_type = 'fsbo';
      } else if (sourceUrl.includes('rent') || html.toLowerCase().includes('for rent')) {
        listing.listing_type = 'frbo';
      } else {
        listing.listing_type = 'for_sale';
      }
      
      listings.push(listing);
    }

    console.log(`[Generic] Found ${addresses.length} addresses, extracted ${listings.length} listings`);
  } catch (error) {
    console.error('[Generic] Error parsing HTML:', error);
  }
  
  return listings;
}

// Try to get Zillow agent info via RCF API
async function getZillowAgentInfo(zpid: string): Promise<{ name?: string; phone?: string; agentName?: string }> {
  try {
    const payload = {
      zpid: zpid,
      pageType: 'HDP',
      isInstantTourEnabled: false,
      isCachedInstantTourAvailability: true,
      tourTypes: [],
    };

    const response = await fetch('https://www.zillow.com/rentals/api/rcf/v1/rcf', {
      method: 'POST',
      headers: {
        'accept': '*/*',
        'content-type': 'application/json',
        'origin': 'https://www.zillow.com',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) return {};

    const data = await response.json();
    const agentInfo = data?.propertyInfo?.agentInfo || {};

    return {
      name: agentInfo.businessName || null,
      phone: agentInfo.phoneNumber || null,
      agentName: agentInfo.displayName || null,
    };
  } catch (error) {
    console.error('[Zillow RCF] Error:', error);
    return {};
  }
}

// Main handler
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
      listingType = 'rent',
      saveToJob,
      jobId,
    } = await req.json();

    const expectedLocation = location ? parseCityState(location) : null;
    const expectedCity = expectedLocation?.city || '';
    const expectedStateAbbrev = expectedLocation?.state ? getStateAbbreviation(expectedLocation.state) : '';

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const zyteApiKey = Deno.env.get('ZYTE_API_KEY');
    
    if (!firecrawlApiKey && !zyteApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'No scraping API configured (need Firecrawl or Zyte)' }),
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
      // Search specific owner-focused platforms
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

    console.log(`Scraping ${urlsToScrape.length} real estate URLs`);
    console.log('URLs:', urlsToScrape);

    const allListings: any[] = [];
    const errors: { url: string; error: string }[] = [];
    let zyteUsed = 0;

    for (const targetUrl of urlsToScrape) {
      try {
        let formattedUrl = targetUrl.trim();
        if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
          formattedUrl = `https://${formattedUrl}`;
        }

        const platform = detectPlatform(formattedUrl);
        console.log(`\n[Scraping] ${formattedUrl}`);
        console.log(`[Platform] ${platform?.name || 'unknown'} (strategy: ${platform?.strategy}, requiresZyte: ${platform?.requiresZyte})`);

        let html = '';
        let usedZyte = false;

        // Get HTML content
        if (platform?.requiresZyte && zyteApiKey) {
          // Use Zyte for platforms that require it
          const zyteResult = await scrapeWithZyte(formattedUrl, zyteApiKey);
          if (zyteResult.success) {
            html = zyteResult.html;
            usedZyte = true;
            zyteUsed++;
          } else {
            console.error(`[Zyte] Failed: ${zyteResult.error}`);
            errors.push({ url: formattedUrl, error: zyteResult.error || 'Zyte failed' });
            continue;
          }
        } else if (firecrawlApiKey) {
          // Use Firecrawl
          const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: formattedUrl,
              formats: ['rawHtml', 'markdown'],
              onlyMainContent: false,
              waitFor: 3000,
            }),
          });

          const data = await response.json();
          if (!response.ok) {
            // Try Zyte as fallback
            if (zyteApiKey) {
              console.log('[Firecrawl] Failed, trying Zyte fallback...');
              const zyteResult = await scrapeWithZyte(formattedUrl, zyteApiKey);
              if (zyteResult.success) {
                html = zyteResult.html;
                usedZyte = true;
                zyteUsed++;
              } else {
                errors.push({ url: formattedUrl, error: `Both Firecrawl and Zyte failed` });
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
          errors.push({ url: formattedUrl, error: 'No HTML content retrieved' });
          continue;
        }

        console.log(`[HTML] Got ${html.length} characters (via ${usedZyte ? 'Zyte' : 'Firecrawl'})`);

        // Extract listings based on platform strategy
        let listings: any[] = [];

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

        console.log(`[Extracted] ${listings.length} listings from ${platform?.name || 'unknown'}`);

        // Filter by location if specified
        for (const listing of listings) {
          if (location && listing.address && !listingMatchesLocation(listing.address, expectedCity, expectedStateAbbrev)) {
            console.log(`[Filtered] Address "${listing.address}" doesn't match ${expectedCity}, ${expectedStateAbbrev}`);
            continue;
          }

          listing.scraped_via = usedZyte ? 'zyte' : 'firecrawl';
          allListings.push(listing);
        }

        // Rate limiting
        if (urlsToScrape.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (error) {
        console.error(`Error scraping ${targetUrl}:`, error);
        errors.push({ url: targetUrl, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    console.log(`\n[Total] Scraped ${allListings.length} listings from ${urlsToScrape.length} URLs`);

    // Save to database if requested
    let savedCount = 0;
    if (saveToJob && jobId && allListings.length > 0) {
      console.log(`Saving ${allListings.length} listings to job ${jobId}`);
      
      for (const listing of allListings) {
        try {
          await adminSupabase.from('scraped_leads').insert({
            job_id: jobId,
            domain: listing.source_platform || new URL(listing.source_url).hostname,
            source_url: listing.listing_url || listing.source_url,
            full_name: listing.owner_name || null,
            best_email: listing.owner_email || null,
            best_phone: listing.owner_phone || null,
            address: listing.address || null,
            lead_type: listing.listing_type || 'fsbo',
            status: 'new',
            schema_data: {
              bedrooms: listing.bedrooms,
              bathrooms: listing.bathrooms,
              price: listing.price,
              days_on_market: listing.days_on_market,
              property_type: listing.property_type,
              square_feet: listing.square_feet,
              year_built: listing.year_built,
              listing_id: listing.listing_id,
              description: listing.description,
              source_platform: listing.source_platform,
              scraped_via: listing.scraped_via,
            },
          });
          savedCount++;
        } catch (insertError) {
          console.error('Error inserting listing:', insertError);
        }
      }
      console.log(`Saved ${savedCount} listings`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        listings: allListings,
        total: allListings.length,
        urls_scraped: urlsToScrape.length,
        zyte_used: zyteUsed,
        saved: saveToJob ? savedCount : undefined,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in real estate scraper:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to scrape' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
