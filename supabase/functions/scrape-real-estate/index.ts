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
  { name: 'trulia', pattern: /trulia\.com/i, ownerFilter: 'fsbo', requiresZyte: true, strategy: 'trulia' },
  { name: 'redfin', pattern: /redfin\.com/i, ownerFilter: 'fsbo', requiresZyte: true, strategy: 'redfin' },
  { name: 'craigslist', pattern: /craigslist\.(org|com)/i, ownerFilter: null, requiresZyte: false, strategy: 'generic' },
  { name: 'realtor', pattern: /realtor\.com/i, ownerFilter: 'fsbo', requiresZyte: true, strategy: 'realtor' },
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

// Extract Zillow listings from #__NEXT_DATA__ JSON and gdpClientCache (proven patterns)
function extractZillowListings(html: string, sourceUrl: string, listingType: 'sale' | 'rent'): any[] {
  const listings: any[] = [];
  
  try {
    // Method 1: Extract __NEXT_DATA__ JSON
    const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        const jsonData = JSON.parse(nextDataMatch[1]);
        
        // Try multiple paths for search results (Zillow changes these frequently)
        const possiblePaths = [
          jsonData?.props?.pageProps?.searchPageState?.cat1?.searchResults?.listResults,
          jsonData?.props?.pageProps?.searchPageState?.cat2?.searchResults?.listResults,
          jsonData?.props?.pageProps?.searchPageState?.cat1?.searchResults?.mapResults,
          jsonData?.props?.pageProps?.initialReduxState?.search?.results?.results,
          jsonData?.props?.pageProps?.componentProps?.searchResults?.listResults,
          jsonData?.props?.pageProps?.listResults,
          jsonData?.props?.pageProps?.searchResults,
        ];
        
        let searchResults: any[] = [];
        for (const path of possiblePaths) {
          if (Array.isArray(path) && path.length > 0) {
            searchResults = path;
            console.log(`[Zillow] Found ${searchResults.length} listings in __NEXT_DATA__`);
            break;
          }
        }

        for (const home of searchResults) {
          const detailUrl = home.detailUrl || home.hdpUrl || home.url || '';
          const fullUrl = detailUrl.startsWith('https') ? detailUrl : `https://www.zillow.com${detailUrl}`;
          
          // Extract days on market
          const daysOnMarket = home.daysOnZillow || home.timeOnZillow || 
            (home.dateSold ? Math.floor((Date.now() - new Date(home.dateSold).getTime()) / (1000 * 60 * 60 * 24)) : null);
          
          const listing: any = {
            address: home.address || home.streetAddress || '',
            bedrooms: home.beds || home.bedrooms || home.bd || null,
            bathrooms: home.baths || home.bathrooms || home.ba || null,
            price: formatPrice(home.price || home.unformattedPrice),
            square_feet: home.area || home.sqft || home.livingArea || null,
            listing_url: fullUrl,
            listing_id: home.zpid?.toString() || home.id?.toString() || null,
            property_type: formatPropertyType(home.homeType || home.propertyType),
            listing_type: listingType === 'sale' ? 'fsbo' : 'frbo',
            days_on_market: daysOnMarket,
            favorites_count: home.favoriteCount || null,
            views_count: home.viewCount || null,
            year_built: home.yearBuilt || null,
            source_url: sourceUrl,
            source_platform: 'zillow',
            scraped_at: new Date().toISOString(),
            _zpid: home.zpid || null,
          };
          
          listings.push(listing);
        }
      } catch (parseError) {
        console.error('[Zillow] Error parsing __NEXT_DATA__:', parseError);
      }
    }
    
    // Method 2: Try gdpClientCache (older Zillow format)
    if (listings.length === 0) {
      const gdpMatch = html.match(/gdpClientCache"\s*:\s*({[^}]+})/);
      if (gdpMatch) {
        try {
          const gdpData = JSON.parse(gdpMatch[1]);
          for (const key in gdpData) {
            if (gdpData[key]?.property) {
              const prop = gdpData[key].property;
              listings.push({
                address: `${prop.streetAddress || ''}, ${prop.city || ''}, ${prop.state || ''} ${prop.zipcode || ''}`.trim(),
                bedrooms: prop.bedrooms || null,
                bathrooms: prop.bathrooms || null,
                price: formatPrice(prop.price),
                square_feet: prop.livingArea || null,
                listing_url: `https://www.zillow.com/homedetails/${prop.zpid}_zpid/`,
                listing_id: prop.zpid?.toString() || null,
                property_type: formatPropertyType(prop.homeType),
                listing_type: listingType === 'sale' ? 'fsbo' : 'frbo',
                days_on_market: prop.daysOnZillow || null,
                year_built: prop.yearBuilt || null,
                source_url: sourceUrl,
                source_platform: 'zillow',
                scraped_at: new Date().toISOString(),
                _zpid: prop.zpid || null,
              });
            }
          }
          console.log(`[Zillow] Found ${listings.length} listings from gdpClientCache`);
        } catch (e) {
          console.error('[Zillow] Error parsing gdpClientCache:', e);
        }
      }
    }
    
    // Method 3: Try property card HTML extraction as fallback
    if (listings.length === 0) {
      console.log('[Zillow] No JSON data found, trying HTML card extraction');
      const cardPatterns = [
        /<article[^>]*data-test="property-card"[^>]*>([\s\S]*?)<\/article>/gi,
        /<div[^>]*class="[^"]*property-card[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<li[^>]*class="[^"]*ListItem[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
      ];
      
      for (const pattern of cardPatterns) {
        const cards = html.match(pattern) || [];
        if (cards.length > 0) {
          console.log(`[Zillow] Found ${cards.length} property cards in HTML`);
          for (const card of cards.slice(0, 50)) {
            const addressMatch = card.match(/address[^>]*>([^<]+)</i) || 
                                card.match(/data-test="property-card-addr"[^>]*>([^<]+)</i);
            const priceMatch = card.match(/\$[\d,]+/);
            const bedsMatch = card.match(/(\d+)\s*(?:bd|bed|br)/i);
            const bathsMatch = card.match(/(\d+(?:\.\d)?)\s*(?:ba|bath)/i);
            const sqftMatch = card.match(/([\d,]+)\s*(?:sqft|sq\s*ft)/i);
            const zpidMatch = card.match(/zpid[=_]?(\d+)/i) || card.match(/homedetails\/(\d+)/i);
            
            if (addressMatch || priceMatch) {
              listings.push({
                address: addressMatch?.[1]?.trim() || 'Address not found',
                bedrooms: bedsMatch ? parseInt(bedsMatch[1]) : null,
                bathrooms: bathsMatch ? parseFloat(bathsMatch[1]) : null,
                price: priceMatch?.[0] || null,
                square_feet: sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, '')) : null,
                listing_url: zpidMatch ? `https://www.zillow.com/homedetails/${zpidMatch[1]}_zpid/` : sourceUrl,
                listing_id: zpidMatch?.[1] || null,
                listing_type: listingType === 'sale' ? 'fsbo' : 'frbo',
                source_url: sourceUrl,
                source_platform: 'zillow',
                scraped_at: new Date().toISOString(),
              });
            }
          }
          break;
        }
      }
    }
    
    console.log(`[Zillow] Total extracted: ${listings.length} listings`);
  } catch (error) {
    console.error('[Zillow] Error in extraction:', error);
  }

  return listings;
}

function formatPrice(price: number | string | null | undefined): string | null {
  if (!price) return null;
  if (typeof price === 'string' && price.startsWith('$')) return price;
  const num = typeof price === 'string' ? parseInt(price.replace(/[^0-9]/g, '')) : price;
  return num ? `$${num.toLocaleString()}` : null;
}

function formatPropertyType(type: string | null | undefined): string | null {
  if (!type) return null;
  return type.replace(/_/g, ' ').replace('HOME_TYPE', '').replace('PROPERTY_TYPE', '').trim() || null;
}

// Extract Apartments.com listings from JSON-LD, __NEXT_DATA__, and HTML
function extractApartmentsListings(html: string, sourceUrl: string): any[] {
  const listings: any[] = [];
  
  try {
    // Method 1: Try __NEXT_DATA__ JSON (newer React-based pages)
    const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        const jsonData = JSON.parse(nextDataMatch[1]);
        
        // Multiple possible paths for listings data
        const possiblePaths = [
          jsonData?.props?.pageProps?.listings,
          jsonData?.props?.pageProps?.searchResults?.listings,
          jsonData?.props?.pageProps?.properties,
          jsonData?.props?.pageProps?.initialState?.listings?.items,
          jsonData?.props?.pageProps?.data?.listings,
        ];
        
        for (const path of possiblePaths) {
          if (Array.isArray(path) && path.length > 0) {
            console.log(`[Apartments] Found ${path.length} listings in __NEXT_DATA__`);
            
            for (const item of path) {
              const address = item.address || item.location || {};
              let fullAddress = '';
              
              if (typeof address === 'string') {
                fullAddress = address;
              } else {
                fullAddress = [
                  address.streetAddress || address.line1 || item.streetAddress || '',
                  address.city || address.addressLocality || item.city || '',
                  `${address.state || address.addressRegion || item.state || ''} ${address.postalCode || address.zip || item.zipCode || ''}`
                ].filter(Boolean).join(', ').trim();
              }
              
              if (!fullAddress && item.displayAddress) {
                fullAddress = item.displayAddress;
              }
              
              if (!fullAddress) continue;
              
              let price = item.price || item.rent || item.rentRange?.min;
              if (price && typeof price === 'number') {
                price = `$${price.toLocaleString()}`;
              }
              
              const listing: any = {
                address: fullAddress,
                owner_name: item.propertyName || item.name || null,
                owner_phone: cleanPhone(item.phone || item.phoneNumber),
                listing_url: item.url || item.listingUrl || item.propertyUrl || null,
                price: price?.toString() || null,
                bedrooms: item.beds || item.bedrooms || item.minBeds || null,
                bathrooms: item.baths || item.bathrooms || item.minBaths || null,
                square_feet: item.sqft || item.squareFeet || item.minSqft || null,
                listing_type: 'frbo',
                source_url: sourceUrl,
                source_platform: 'apartments',
                scraped_at: new Date().toISOString(),
                favorites_count: item.favoriteCount || item.saves || null,
              };
              
              listings.push(listing);
            }
            
            if (listings.length > 0) return listings;
          }
        }
      } catch (e) {
        console.log('[Apartments] Error parsing __NEXT_DATA__, trying JSON-LD');
      }
    }
    
    // Method 2: Try JSON-LD scripts
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
        // Check for @graph array
        else if (jsonData['@graph'] && Array.isArray(jsonData['@graph'])) {
          for (const item of jsonData['@graph']) {
            if (item.address || item['@type']?.includes('Residence') || item['@type']?.includes('Apartment')) {
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
        // Direct ApartmentComplex or Residence types
        else if (jsonData['@type']?.includes('Apartment') || jsonData['@type']?.includes('Residence')) {
          records.push(jsonData);
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

    // If no records from JSON-LD, try HTML extraction
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

      // Extract beds/baths from numberOfRooms or floorSize
      if (record.numberOfRooms) {
        listing.bedrooms = typeof record.numberOfRooms === 'number' ? record.numberOfRooms : parseInt(record.numberOfRooms);
      }
      if (record.numberOfBathroomsTotal) {
        listing.bathrooms = typeof record.numberOfBathroomsTotal === 'number' ? record.numberOfBathroomsTotal : parseFloat(record.numberOfBathroomsTotal);
      }
      if (record.floorSize?.value) {
        listing.square_feet = parseInt(record.floorSize.value);
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

// Parse address from HotPads URL slug (fallback when JSON-LD fails)
// URLs like: https://hotpads.com/2162-n-bell-ave-chicago-il-60647-1msm73f/building
function parseHotpadsAddressFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    if (pathParts.length === 0) return null;
    
    // The first path segment contains the address slug
    // Format: 2162-n-bell-ave-chicago-il-60647-1msm73f
    const slug = pathParts[0];
    
    // Skip if it's just a city search page
    if (slug.match(/^[a-z-]+-[a-z]{2}$/i)) return null; // e.g., "chicago-il"
    
    // Parse address components from slug
    // Remove the trailing listing ID (alphanumeric code at the end)
    const cleanedSlug = slug.replace(/-[a-z0-9]{6,}$/i, '');
    
    // Match pattern: street-number-street-name-city-state-zip
    const stateZipMatch = cleanedSlug.match(/^(.+?)-([a-z]{2})-(\d{5})$/i);
    if (stateZipMatch) {
      const [, addressPart, state, zip] = stateZipMatch;
      
      // Find where city starts (usually after the last street suffix like ave, st, dr, etc.)
      const streetSuffixes = ['ave', 'st', 'rd', 'dr', 'blvd', 'ln', 'way', 'ct', 'pl', 'cir', 'pkwy', 'ter'];
      let cityStartIndex = -1;
      const words = addressPart.split('-');
      
      for (let i = 0; i < words.length; i++) {
        if (streetSuffixes.includes(words[i].toLowerCase())) {
          cityStartIndex = i + 1;
          break;
        }
      }
      
      if (cityStartIndex > 0 && cityStartIndex < words.length) {
        const streetParts = words.slice(0, cityStartIndex);
        const cityParts = words.slice(cityStartIndex);
        
        // Capitalize properly
        const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
        const street = streetParts.map(capitalize).join(' ');
        const city = cityParts.map(capitalize).join(' ');
        
        return `${street}, ${city}, ${state.toUpperCase()} ${zip}`;
      }
    }
    
    // Fallback: just format the slug nicely
    const formattedAddress = cleanedSlug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    return formattedAddress || null;
  } catch (e) {
    console.error('[HotPads] Error parsing URL for address:', e);
    return null;
  }
}

// Extract HotPads listings from JSON-LD @graph
function extractHotpadsListings(html: string, sourceUrl: string): any[] {
  const listings: any[] = [];
  
  try {
    // First, try to parse address from URL in case JSON-LD fails
    const urlParsedAddress = parseHotpadsAddressFromUrl(sourceUrl);
    console.log(`[HotPads] URL-parsed address fallback: ${urlParsedAddress || 'none'}`);
    
    // Find all JSON-LD blocks
    const jsonLdMatches = html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    
    for (const match of jsonLdMatches) {
      try {
        const jsonData = JSON.parse(match[1]);
        
        // Handle @graph array
        const graph = jsonData['@graph'] || (Array.isArray(jsonData) ? jsonData : [jsonData]);
        
        console.log(`[HotPads] Processing ${graph.length} items from JSON-LD`);
        
        for (const item of graph) {
          // Try mainEntity first (detail pages)
          let entity = item.mainEntity || item;
          
          // Skip non-property types
          const itemType = entity['@type'] || '';
          if (!itemType.includes('Residence') && 
              !itemType.includes('Apartment') && 
              !itemType.includes('House') &&
              !itemType.includes('Product') &&
              !itemType.includes('Place') &&
              itemType !== 'SingleFamilyResidence' &&
              itemType !== 'ApartmentComplex') {
            continue;
          }
          
          const address = entity.address || {};
          let fullAddress = '';
          
          if (typeof address === 'string') {
            fullAddress = address;
          } else {
            const streetAddress = (address.streetAddress || '')?.trim();
            const addressLocality = (address.addressLocality || '')?.trim();
            const addressRegion = (address.addressRegion || '')?.trim();
            const postalCode = (address.postalCode || '')?.trim();
            fullAddress = [streetAddress, addressLocality, `${addressRegion} ${postalCode}`]
              .filter(Boolean).join(', ').trim();
          }
          
          // If no address from JSON-LD, use URL-parsed address
          if (!fullAddress && urlParsedAddress) {
            fullAddress = urlParsedAddress;
            console.log(`[HotPads] Using URL-parsed address: ${fullAddress}`);
          }
          
          if (!fullAddress) continue;
          
          // Get price
          let price = entity.offers?.price || entity.offers?.lowPrice || entity.priceRange;
          if (price && typeof price === 'number') {
            price = `$${price.toLocaleString()}`;
          }
          
          const listing: any = {
            address: fullAddress,
            owner_name: entity.name?.trim() || null,
            owner_phone: cleanPhone(entity.telephone),
            description: entity.description?.trim()?.slice(0, 500) || null,
            price: price?.toString() || null,
            listing_url: entity.url || sourceUrl,
            listing_type: 'frbo',
            source_url: sourceUrl,
            source_platform: 'hotpads',
            scraped_at: new Date().toISOString(),
          };
          
          // Try to get beds/baths
          if (entity.numberOfRooms) {
            listing.bedrooms = typeof entity.numberOfRooms === 'number' 
              ? entity.numberOfRooms 
              : parseInt(entity.numberOfRooms);
          }
          if (entity.numberOfBathroomsTotal) {
            listing.bathrooms = typeof entity.numberOfBathroomsTotal === 'number' 
              ? entity.numberOfBathroomsTotal 
              : parseFloat(entity.numberOfBathroomsTotal);
          }
          
          listings.push(listing);
        }
      } catch (e) {
        // Continue to next JSON-LD block
      }
    }
    
    // If no listings from JSON-LD, try HTML extraction with URL fallback
    if (listings.length === 0) {
      console.log('[HotPads] No JSON-LD listings, trying HTML extraction');
      
      // HotPads listing cards pattern
      const cardPatterns = [
        /<div[^>]*class="[^"]*ListingCard[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<article[^>]*data-testid="[^"]*listing[^"]*"[^>]*>([\s\S]*?)<\/article>/gi,
        /<a[^>]*aria-label="([^"]+)"[^>]*href="([^"]+hotpads[^"]+)"[^>]*>/gi,
      ];
      
      for (const pattern of cardPatterns) {
        const cards = html.match(pattern) || [];
        if (cards.length > 0) {
          console.log(`[HotPads] Found ${cards.length} listing cards in HTML`);
          
          for (const card of cards.slice(0, 50)) {
            // Try to extract address from aria-label or class content
            const ariaMatch = card.match(/aria-label="([^"]+)"/i);
            const addressMatch = card.match(/class="[^"]*address[^"]*"[^>]*>([^<]+)</i) ||
                                card.match(/class="[^"]*location[^"]*"[^>]*>([^<]+)</i);
            const priceMatch = card.match(/\$[\d,]+/);
            const bedsMatch = card.match(/(\d+)\s*(?:bed|br)/i);
            const bathsMatch = card.match(/(\d+(?:\.\d)?)\s*(?:bath|ba)/i);
            const hrefMatch = card.match(/href="([^"]+hotpads\.com[^"]+)"/i);
            
            let address = '';
            
            // Try aria-label first (contains full address info)
            if (ariaMatch && ariaMatch[1] && !ariaMatch[1].toLowerCase().includes('see listing')) {
              address = ariaMatch[1].trim();
            } else if (addressMatch && !addressMatch[1].toLowerCase().includes('see listing')) {
              address = addressMatch[1].trim();
            }
            
            // If still no address, try to parse from href
            if (!address && hrefMatch) {
              address = parseHotpadsAddressFromUrl(hrefMatch[1]) || '';
            }
            
            // Last resort: use URL-parsed address
            if (!address && urlParsedAddress) {
              address = urlParsedAddress;
            }
            
            if (address) {
              const listing: any = {
                address: address,
                price: priceMatch?.[0] || null,
                listing_type: 'frbo',
                listing_url: hrefMatch?.[1] || sourceUrl,
                source_url: sourceUrl,
                source_platform: 'hotpads',
                scraped_at: new Date().toISOString(),
              };
              
              if (bedsMatch) listing.bedrooms = parseInt(bedsMatch[1]);
              if (bathsMatch) listing.bathrooms = parseFloat(bathsMatch[1]);
              
              listings.push(listing);
            }
          }
          break;
        }
      }
    }
    
    // If still no listings but we have a detail page URL, create a single listing from URL
    if (listings.length === 0 && urlParsedAddress && sourceUrl.includes('/pad') || sourceUrl.includes('/building')) {
      console.log('[HotPads] Creating listing from URL-parsed address for detail page');
      
      // Extract any additional info from HTML
      const priceMatch = html.match(/\$[\d,]+(?:\s*\/\s*mo)?/);
      const bedsMatch = html.match(/(\d+)\s*(?:bed|bedroom|br)/i);
      const bathsMatch = html.match(/(\d+(?:\.\d)?)\s*(?:bath|ba)/i);
      const phoneMatch = html.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
      
      listings.push({
        address: urlParsedAddress,
        price: priceMatch?.[0] || null,
        bedrooms: bedsMatch ? parseInt(bedsMatch[1]) : null,
        bathrooms: bathsMatch ? parseFloat(bathsMatch[1]) : null,
        owner_phone: phoneMatch ? cleanPhone(phoneMatch[1]) : null,
        listing_type: 'frbo',
        listing_url: sourceUrl,
        source_url: sourceUrl,
        source_platform: 'hotpads',
        scraped_at: new Date().toISOString(),
      });
    }
    
    console.log(`[HotPads] Extracted ${listings.length} listings`);
  } catch (error) {
    console.error('[HotPads] Error parsing:', error);
  }

  return listings;
}

// Extract Redfin listings
function extractRedfinListings(html: string, sourceUrl: string): any[] {
  const listings: any[] = [];
  
  try {
    // Try __NEXT_DATA__ first (Redfin uses Next.js)
    const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        const jsonData = JSON.parse(nextDataMatch[1]);
        const homes = jsonData?.props?.pageProps?.homes || 
                     jsonData?.props?.pageProps?.searchResults?.homes ||
                     jsonData?.props?.pageProps?.reactServerState?.QueryClientState?.queries?.[0]?.state?.data?.homes || [];
        
        console.log(`[Redfin] Found ${homes.length} homes in __NEXT_DATA__`);
        
        for (const home of homes) {
          const listing: any = {
            address: home.streetAddress?.assembledAddress || home.address || '',
            bedrooms: home.beds || null,
            bathrooms: home.baths || null,
            price: formatPrice(home.price?.value || home.listingPrice),
            square_feet: home.sqFt?.value || home.sqft || null,
            listing_url: home.url ? `https://www.redfin.com${home.url}` : null,
            listing_id: home.listingId || home.propertyId || null,
            property_type: home.propertyType || null,
            listing_type: home.listingType?.includes('fsbo') ? 'fsbo' : 'for_sale',
            days_on_market: home.dom || home.daysOnMarket || null,
            year_built: home.yearBuilt || null,
            source_url: sourceUrl,
            source_platform: 'redfin',
            scraped_at: new Date().toISOString(),
          };
          
          if (listing.address) listings.push(listing);
        }
      } catch (e) {
        console.error('[Redfin] Error parsing __NEXT_DATA__:', e);
      }
    }
    
    // HTML fallback
    if (listings.length === 0) {
      const cardPatterns = [
        /<div[^>]*class="[^"]*HomeCard[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<article[^>]*class="[^"]*homecard[^"]*"[^>]*>([\s\S]*?)<\/article>/gi,
      ];
      
      for (const pattern of cardPatterns) {
        const cards = html.match(pattern) || [];
        if (cards.length > 0) {
          console.log(`[Redfin] Found ${cards.length} property cards`);
          for (const card of cards.slice(0, 50)) {
            const addressMatch = card.match(/class="[^"]*address[^"]*"[^>]*>([^<]+)</i);
            const priceMatch = card.match(/\$[\d,]+/);
            const bedsMatch = card.match(/(\d+)\s*(?:bed|br)/i);
            const bathsMatch = card.match(/(\d+(?:\.\d)?)\s*(?:bath|ba)/i);
            
            if (addressMatch) {
              listings.push({
                address: addressMatch[1].trim(),
                price: priceMatch?.[0] || null,
                bedrooms: bedsMatch ? parseInt(bedsMatch[1]) : null,
                bathrooms: bathsMatch ? parseFloat(bathsMatch[1]) : null,
                listing_type: 'for_sale',
                source_url: sourceUrl,
                source_platform: 'redfin',
                scraped_at: new Date().toISOString(),
              });
            }
          }
          break;
        }
      }
    }
    
    console.log(`[Redfin] Extracted ${listings.length} listings`);
  } catch (error) {
    console.error('[Redfin] Error:', error);
  }
  
  return listings;
}

// Extract Trulia listings
function extractTruliaListings(html: string, sourceUrl: string): any[] {
  const listings: any[] = [];
  
  try {
    // Trulia uses React hydration data
    const stateMatch = html.match(/<script>window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?<\/script>/i) ||
                       html.match(/<script[^>]*>window\["__PRELOADED_STATE__"\]\s*=\s*(\{[\s\S]*?\})<\/script>/i);
    
    if (stateMatch) {
      try {
        const stateData = JSON.parse(stateMatch[1]);
        const homes = stateData?.searchResults?.homes || stateData?.data?.searchResults?.homes || [];
        
        console.log(`[Trulia] Found ${homes.length} homes in state data`);
        
        for (const home of homes) {
          const listing: any = {
            address: home.address?.formattedAddress || home.location?.fullAddress || '',
            bedrooms: home.beds || home.bedrooms || null,
            bathrooms: home.baths || home.bathrooms || null,
            price: formatPrice(home.price || home.listPrice),
            square_feet: home.sqft || home.floorSpace?.value || null,
            listing_url: home.url ? `https://www.trulia.com${home.url}` : null,
            listing_id: home.id || home.listingId || null,
            listing_type: home.listingType?.toLowerCase()?.includes('fsbo') ? 'fsbo' : 'for_sale',
            days_on_market: home.daysOnMarket || home.dom || null,
            source_url: sourceUrl,
            source_platform: 'trulia',
            scraped_at: new Date().toISOString(),
          };
          
          if (listing.address) listings.push(listing);
        }
      } catch (e) {
        console.error('[Trulia] Error parsing state data:', e);
      }
    }
    
    // JSON-LD fallback
    if (listings.length === 0) {
      const jsonLdMatches = html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
      
      for (const match of jsonLdMatches) {
        try {
          const jsonData = JSON.parse(match[1]);
          const items = jsonData['@graph'] || (Array.isArray(jsonData) ? jsonData : [jsonData]);
          
          for (const item of items) {
            if (item['@type']?.includes('Residence') || item['@type']?.includes('Product')) {
              const address = item.address || {};
              const fullAddress = typeof address === 'string' ? address :
                [address.streetAddress, address.addressLocality, address.addressRegion].filter(Boolean).join(', ');
              
              if (fullAddress) {
                listings.push({
                  address: fullAddress,
                  price: formatPrice(item.offers?.price),
                  listing_url: item.url || null,
                  listing_type: 'for_sale',
                  source_url: sourceUrl,
                  source_platform: 'trulia',
                  scraped_at: new Date().toISOString(),
                });
              }
            }
          }
        } catch (e) {
          // Continue to next JSON-LD
        }
      }
    }
    
    console.log(`[Trulia] Extracted ${listings.length} listings`);
  } catch (error) {
    console.error('[Trulia] Error:', error);
  }
  
  return listings;
}

// Extract Realtor.com listings
function extractRealtorListings(html: string, sourceUrl: string): any[] {
  const listings: any[] = [];
  
  try {
    // Realtor.com uses __NEXT_DATA__
    const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        const jsonData = JSON.parse(nextDataMatch[1]);
        const homes = jsonData?.props?.pageProps?.properties || 
                     jsonData?.props?.pageProps?.searchResults?.home_search?.results ||
                     jsonData?.props?.pageProps?.homeSearch?.results || [];
        
        console.log(`[Realtor] Found ${homes.length} homes in __NEXT_DATA__`);
        
        for (const home of homes) {
          const location = home.location || {};
          const address = location.address || home.address || {};
          const fullAddress = address.line ? 
            `${address.line}, ${address.city}, ${address.state_code} ${address.postal_code}` :
            `${address.street_address || ''}, ${address.city || ''}, ${address.state || ''}`.trim();
          
          const listing: any = {
            address: fullAddress,
            bedrooms: home.description?.beds || home.beds || null,
            bathrooms: home.description?.baths || home.baths || null,
            price: formatPrice(home.list_price || home.price),
            square_feet: home.description?.sqft || home.sqft || null,
            listing_url: home.permalink ? `https://www.realtor.com/realestateandhomes-detail/${home.permalink}` : null,
            listing_id: home.property_id || home.listing_id || null,
            property_type: home.description?.type || home.prop_type || null,
            listing_type: home.flags?.is_fsbo ? 'fsbo' : 'for_sale',
            days_on_market: home.list_date ? 
              Math.floor((Date.now() - new Date(home.list_date).getTime()) / (1000 * 60 * 60 * 24)) : null,
            year_built: home.description?.year_built || null,
            source_url: sourceUrl,
            source_platform: 'realtor',
            scraped_at: new Date().toISOString(),
          };
          
          if (listing.address && listing.address.length > 5) listings.push(listing);
        }
      } catch (e) {
        console.error('[Realtor] Error parsing __NEXT_DATA__:', e);
      }
    }
    
    // HTML card fallback
    if (listings.length === 0) {
      const cardPatterns = [
        /<div[^>]*data-testid="property-card"[^>]*>([\s\S]*?)<\/div>/gi,
        /<li[^>]*class="[^"]*component_property-card[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
      ];
      
      for (const pattern of cardPatterns) {
        const cards = html.match(pattern) || [];
        if (cards.length > 0) {
          console.log(`[Realtor] Found ${cards.length} property cards`);
          for (const card of cards.slice(0, 50)) {
            const addressMatch = card.match(/class="[^"]*address[^"]*"[^>]*>([^<]+)</i) ||
                                card.match(/data-testid="card-address[^"]*"[^>]*>([^<]+)</i);
            const priceMatch = card.match(/\$[\d,]+/);
            
            if (addressMatch) {
              listings.push({
                address: addressMatch[1].trim(),
                price: priceMatch?.[0] || null,
                listing_type: 'for_sale',
                source_url: sourceUrl,
                source_platform: 'realtor',
                scraped_at: new Date().toISOString(),
              });
            }
          }
          break;
        }
      }
    }
    
    console.log(`[Realtor] Extracted ${listings.length} listings`);
  } catch (error) {
    console.error('[Realtor] Error:', error);
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
          case 'redfin':
            listings = extractRedfinListings(html, formattedUrl);
            break;
          case 'trulia':
            listings = extractTruliaListings(html, formattedUrl);
            break;
          case 'realtor':
            listings = extractRealtorListings(html, formattedUrl);
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
          // Use a sanitized address slug as domain for better identification
          // Instead of just storing "hotpads" or "zillow"
          const addressSlug = listing.address 
            ? listing.address.toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .replace(/\s+/g, '-')
                .slice(0, 100)
            : listing.listing_id || 'unknown';
          
          // Create a meaningful domain identifier: platform + address slug
          const domainIdentifier = `${listing.source_platform}-${addressSlug}`;
          
          await adminSupabase.from('scraped_leads').insert({
            job_id: jobId,
            // Use full address as the primary identifier, platform as secondary
            domain: domainIdentifier,
            source_url: listing.listing_url || listing.source_url,
            source_type: 'real_estate_scraper',
            full_name: listing.owner_name || null,
            best_email: listing.owner_email || null,
            best_phone: listing.owner_phone || null,
            address: listing.address || null,
            lead_type: listing.listing_type || 'fsbo',
            status: 'new',
            // Store comprehensive schema data including all property details
            schema_data: {
              // Property details
              bedrooms: listing.bedrooms,
              bathrooms: listing.bathrooms,
              price: listing.price,
              square_feet: listing.square_feet,
              year_built: listing.year_built,
              property_type: listing.property_type,
              
              // Market data
              days_on_market: listing.days_on_market,
              favorites_count: listing.favorites_count,
              views_count: listing.views_count,
              
              // Listing identification
              listing_id: listing.listing_id,
              listing_url: listing.listing_url,
              description: listing.description?.slice(0, 2000), // Limit description length
              
              // Source tracking
              source_platform: listing.source_platform,
              source_url: listing.source_url,
              scraped_via: listing.scraped_via,
              scraped_at: listing.scraped_at,
              
              // Full address for display (stored in both address column and here)
              full_address: listing.address,
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
