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
        // FSBO for sale listings
        return `https://www.zillow.com/${formattedLocation}/fsbo/`;
      } else {
        // For rent by owner - use the proper filter parameters
        // Zillow uses lotId filter: 43094 = For Rent By Owner
        return `https://www.zillow.com/${formattedLocation}/rentals/?searchQueryState=%7B%22filterState%22%3A%7B%22fsbo%22%3A%7B%22value%22%3Atrue%7D%2C%22fsba%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22nc%22%3A%7B%22value%22%3Afalse%7D%2C%22cmsn%22%3A%7B%22value%22%3Afalse%7D%2C%22fr%22%3A%7B%22value%22%3Atrue%7D%7D%7D`;
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
    return { html: data.browserHtml || '', success: true };
  } catch (error) {
    console.error(`[Zyte] Error:`, error);
    return { html: '', success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ==================== PLATFORM-SPECIFIC EXTRACTORS ====================

// Extract Zillow listing URLs from search results page (matching Python parse method)
function extractZillowListingUrls(html: string): string[] {
  const urls: string[] = [];
  
  try {
    // Python: json.loads(response.css("#__NEXT_DATA__::text").get(''))
    const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/i);
    if (!nextDataMatch) {
      console.log('[Zillow] No __NEXT_DATA__ found');
      return urls;
    }

    const jsonData = JSON.parse(nextDataMatch[1]);
    
    // Python: json_data.get('props', {}).get('pageProps', {}).get('searchPageState', {}).get('cat1', {}).get('searchResults', {}).get('listResults', [])
    // or cat2 if cat1 is empty
    const homesListing = 
      jsonData?.props?.pageProps?.searchPageState?.cat1?.searchResults?.listResults ||
      jsonData?.props?.pageProps?.searchPageState?.cat2?.searchResults?.listResults ||
      [];

    console.log(`[Zillow] Found ${homesListing.length} listings in __NEXT_DATA__`);
    
    for (const home of homesListing) {
      // Python: url = home.get('detailUrl', '')
      const url = home.detailUrl || '';
      if (url) {
        // Python: if not url.startswith("https"): new_detailUrl = f'https://www.zillow.com{url}'
        const fullUrl = url.startsWith('https') ? url : `https://www.zillow.com${url}`;
        urls.push(fullUrl);
      }
    }
    
    console.log(`[Zillow] Extracted ${urls.length} listing URLs`);
  } catch (error) {
    console.error('[Zillow] Error extracting URLs:', error);
  }
  
  return [...new Set(urls)];
}

// Extract next page URL from Zillow search results (matching Python pagination)
function extractZillowNextPage(html: string, baseUrl: string): string | null {
  try {
    // Python: response.xpath("//a[@title='Next page']/@href").get('')
    const nextPageMatch = html.match(/<a[^>]*title=["']Next page["'][^>]*href=["']([^"']+)["'][^>]*>/i) ||
                         html.match(/<a[^>]*href=["']([^"']+)["'][^>]*title=["']Next page["'][^>]*>/i);
    
    if (nextPageMatch?.[1]) {
      const href = nextPageMatch[1];
      // Python: response.urljoin(next_page)
      if (href.startsWith('http')) {
        return href;
      } else if (href.startsWith('/')) {
        return `https://www.zillow.com${href}`;
      } else {
        // Relative URL - join with base
        const urlObj = new URL(baseUrl);
        return `${urlObj.origin}/${href}`;
      }
    }
  } catch (error) {
    console.error('[Zillow] Error extracting next page:', error);
  }
  
  return null;
}

// Extract Zillow detail page data (matching Python detail_page method)
function extractZillowDetailPage(html: string, sourceUrl: string, listingType: 'sale' | 'rent'): EnrichedListing | null {
  try {
    // Python: json_data = json.loads(response.css("#__NEXT_DATA__::text").get(''))
    const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/i);
    if (!nextDataMatch) {
      console.log('[Zillow Detail] No __NEXT_DATA__ found');
      return null;
    }

    const jsonData = JSON.parse(nextDataMatch[1]);
    
    // Python: detail = json_data.get('props', {}).get('pageProps', {}).get('componentProps')
    const detail = jsonData?.props?.pageProps?.componentProps || {};
    
    // Python: home_detail = detail.get('gdpClientCache', '')
    const homeDetail = detail.gdpClientCache || '';
    
    let home: Record<string, any> = {};
    
    if (homeDetail) {
      // Python: home_data = json.loads(home_detail)
      // Python: detail_key = list(home_data.keys())[0]
      // Python: home = home_data.get(detail_key, {}).get('property', '')
      try {
        const homeData = JSON.parse(homeDetail);
        const detailKey = Object.keys(homeData)[0];
        if (detailKey) {
          home = homeData[detailKey]?.property || {};
        }
      } catch (e) {
        console.log('[Zillow Detail] Error parsing gdpClientCache:', e);
      }
    } else {
      // Python: home = detail.get('initialReduxState', {}).get('gdp', {}).get('building', {})
      home = detail.initialReduxState?.gdp?.building || {};
    }
    
    // Python: detail1 = json_data.get('props', {}).get('pageProps', {}).get('componentProps', {})
    const detail1 = jsonData?.props?.pageProps?.componentProps || {};
    
    // Python: zpid = detail1.get('initialReduxState', {}).get('gdp', {}).get('building', {}).get('zpid', '')
    // if not zpid: zpid = detail1.get('zpid', '')
    let zpid = detail1.initialReduxState?.gdp?.building?.zpid || '';
    if (!zpid) {
      zpid = detail1.zpid || '';
    }
    
    // Python: address extraction with XPath
    // //div[@data-test-id="bdp-building-address"]//text() | //div[contains(@class,"styles__AddressWrapper")]/h1//text()
    let address = '';
    
    // Try data-test-id="bdp-building-address"
    const bdpAddressMatch = html.match(/<[^>]*data-test-id=["']bdp-building-address["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
    if (bdpAddressMatch) {
      address = bdpAddressMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    
    // Fallback: styles__AddressWrapper h1
    if (!address) {
      const addressWrapperMatch = html.match(/<div[^>]*class=["'][^"']*styles__AddressWrapper[^"']*["'][^>]*>[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (addressWrapperMatch) {
        address = addressWrapperMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }
    
    // Python: item["Address"] = address.replace(',',', ')
    if (address) {
      address = address.replace(/,/g, ', ').replace(/,\s+,/g, ',').replace(/\s+/g, ' ').trim();
    }
    
    // Python: item['Bedrooms'] = home.get('bedrooms', '')
    const bedrooms = home.bedrooms;
    
    // Python: item['Bathrooms'] = home.get('bathrooms', '')
    const bathrooms = home.bathrooms;
    
    // Python: item['Price'] = response.xpath('//span[@data-testid="price"]//span//text()').get('').strip()
    let price = '';
    const priceMatch = html.match(/<span[^>]*data-testid=["']price["'][^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i) ||
                      html.match(/<span[^>]*data-testid=["']price["'][^>]*>([^<]+)</i);
    if (priceMatch) {
      price = priceMatch[1].trim();
    }
    
    // Python: item['Home_Type'] = home.get('homeType', '').replace('_',' ').replace('HOME_TYPE','').strip()
    const homeType = (home.homeType || '').replace(/_/g, ' ').replace(/HOME_TYPE/gi, '').trim();
    
    // Python: item['Year_Build'] = response.xpath("//span[contains(text(),'Built in')]//text()").get('').strip()
    let yearBuilt = '';
    const yearMatch = html.match(/<span[^>]*>[^<]*Built in[^<]*<\/span>/i);
    if (yearMatch) {
      yearBuilt = yearMatch[0].replace(/<[^>]+>/g, '').trim();
    }
    
    // Python: item['HOA'] = response.xpath("//span[contains(text(),'HOA')]//text()").get('').strip()
    let hoa = '';
    const hoaMatch = html.match(/<span[^>]*>[^<]*HOA[^<]*<\/span>/i);
    if (hoaMatch) {
      hoa = hoaMatch[0].replace(/<[^>]+>/g, '').trim();
    }
    
    // Python: item['Days_On_Zillow'] = home.get('daysOnZillow', '')
    const daysOnZillow = home.daysOnZillow;
    
    // Python: item['Page_View_Count'] = home.get('pageViewCount', '')
    const pageViewCount = home.pageViewCount;
    
    // Python: item['Favorite_Count'] = home.get('favoriteCount', '')
    const favoriteCount = home.favoriteCount;
    
    // Python: Extract Phone_Number from listedBy array (lines 105-113 in Python spider)
    // listed = home.get('listedBy')
    // for b in listed:
    //     owner = b.get('id')
    //     if owner == 'PROPERTY_OWNER':
    //         elements = b.get('elements')
    //         for phone in elements:
    //             phone_id = phone.get('id')
    //             if phone_id == 'PHONE':
    //                 item['Phone_Number'] = phone.get('text', '')
    let ownerPhone = '';
    const listedBy = home.listedBy || [];
    for (const b of listedBy) {
      const owner = b.id;
      if (owner === 'PROPERTY_OWNER') {
        const elements = b.elements || [];
        for (const phone of elements) {
          const phoneId = phone.id;
          if (phoneId === 'PHONE') {
            ownerPhone = phone.text || '';
            break;
          }
        }
        if (ownerPhone) break;
      }
    }
    
    if (!address) {
      console.log('[Zillow Detail] No address found');
      return null;
    }
    
    const listing: EnrichedListing = {
      address,
      bedrooms: bedrooms !== undefined && bedrooms !== '' ? Number(bedrooms) : undefined,
      bathrooms: bathrooms !== undefined && bathrooms !== '' ? Number(bathrooms) : undefined,
      price: price || undefined,
      property_type: homeType || undefined,
      year_built: yearBuilt ? parseInt(yearBuilt.replace(/\D/g, '')) || undefined : undefined,
      days_on_market: daysOnZillow !== undefined && daysOnZillow !== '' ? Number(daysOnZillow) : undefined,
      views_count: pageViewCount !== undefined && pageViewCount !== '' ? Number(pageViewCount) : undefined,
      favorites_count: favoriteCount !== undefined && favoriteCount !== '' ? Number(favoriteCount) : undefined,
      listing_url: sourceUrl,
      listing_id: zpid?.toString() || undefined,
      listing_type: listingType === 'sale' ? 'fsbo' : 'frbo',
      source_url: sourceUrl,
      source_platform: 'zillow',
      scraped_at: new Date().toISOString(),
      skip_trace_status: 'pending',
      description: hoa ? `HOA: ${hoa}` : undefined,
      owner_phone: cleanPhone(ownerPhone) || undefined,
    };
    
    return listing;
  } catch (error) {
    console.error('[Zillow Detail] Error parsing:', error);
    return null;
  }
}

// Legacy function for backward compatibility - extracts from search results only
function extractZillowListings(html: string, sourceUrl: string, listingType: 'sale' | 'rent'): EnrichedListing[] {
  const listings: EnrichedListing[] = [];
  
  try {
    const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/i);
    if (!nextDataMatch) {
      console.log('[Zillow] No __NEXT_DATA__ found');
      return listings;
    }

    const jsonData = JSON.parse(nextDataMatch[1]);
    
    // Try multiple paths where search results might be stored
    const searchResults = 
      jsonData?.props?.pageProps?.searchPageState?.cat1?.searchResults?.listResults ||
      jsonData?.props?.pageProps?.searchPageState?.cat2?.searchResults?.listResults ||
      jsonData?.props?.pageProps?.searchResults?.listResults ||
      jsonData?.props?.pageProps?.componentProps?.searchResults?.listResults ||
      [];

    console.log(`[Zillow] Found ${searchResults.length} listings in __NEXT_DATA__`);
    
    // Log first result structure for debugging
    if (searchResults.length > 0) {
      const sample = searchResults[0];
      console.log('[Zillow] Sample listing fields:', Object.keys(sample));
      console.log('[Zillow] Sample data:', JSON.stringify({
        address: sample.address,
        price: sample.price,
        unformattedPrice: sample.unformattedPrice,
        beds: sample.beds,
        baths: sample.baths,
        area: sample.area,
        detailUrl: sample.detailUrl,
        zpid: sample.zpid,
        hdpData: sample.hdpData ? 'present' : 'missing',
      }));
    }

    for (const home of searchResults) {
      // Zillow nests some data in hdpData
      const hdpData = home.hdpData?.homeInfo || {};
      
      const detailUrl = home.detailUrl || hdpData.homeDetailUrl || '';
      const fullUrl = detailUrl.startsWith('https') ? detailUrl : detailUrl ? `https://www.zillow.com${detailUrl}` : undefined;
      
      // For FSBO/FRBO, check listedBy for PROPERTY_OWNER
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

      // Get price - check multiple possible fields
      let price = home.price || hdpData.price;
      if (!price && home.unformattedPrice) {
        price = `$${Number(home.unformattedPrice).toLocaleString()}`;
      }
      if (!price && hdpData.priceForHDP) {
        price = hdpData.priceForHDP;
      }

      // Get beds/baths - check multiple fields
      const beds = home.beds ?? home.bedrooms ?? hdpData.bedrooms ?? hdpData.beds;
      const baths = home.baths ?? home.bathrooms ?? hdpData.bathrooms ?? hdpData.baths;
      const sqft = home.area ?? home.sqft ?? home.livingArea ?? hdpData.livingArea ?? hdpData.sqft;

      const listing: EnrichedListing = {
        address: home.address || hdpData.streetAddress || '',
        bedrooms: beds !== undefined ? Number(beds) : undefined,
        bathrooms: baths !== undefined ? Number(baths) : undefined,
        price: price?.toString(),
        square_feet: sqft !== undefined ? Number(sqft) : undefined,
        listing_url: fullUrl,
        listing_id: (home.zpid || hdpData.zpid)?.toString(),
        property_type: (home.homeType || hdpData.homeType)?.replace('_', ' ').replace('HOME_TYPE', '').trim() || undefined,
        listing_type: listingType === 'sale' ? 'fsbo' : 'frbo',
        days_on_market: home.daysOnZillow ?? hdpData.daysOnZillow,
        favorites_count: home.favoriteCount,
        views_count: home.pageViewCount,
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

// Extract Apartments.com listing URLs from search results (for detail page scraping)
function extractApartmentsListingUrls(html: string): string[] {
  const urls: string[] = [];
  
  try {
    // Python: JSON-LD data.get('about', []) -> record.get('url', '')
    const jsonLdMatch = html.match(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const jsonData = JSON.parse(jsonLdMatch[1]);
        const records = jsonData.about || [];
        for (const record of records) {
          if (record.url) {
            urls.push(record.url);
          }
        }
      } catch (e) {
        // Continue to HTML extraction
      }
    }
    
    // Also try HTML extraction for listing URLs
    const placardMatches = html.matchAll(/<section[^>]*class=["'][^"']*placard-content[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi);
    for (const match of placardMatches) {
      const urlMatch = match[1].match(/href=["'](https:\/\/www\.apartments\.com\/[^"']+)["']/i);
      if (urlMatch?.[1]) {
        urls.push(urlMatch[1]);
      }
    }
    
    console.log(`[Apartments] Found ${urls.length} listing URLs`);
  } catch (error) {
    console.error('[Apartments] Error extracting URLs:', error);
  }
  
  return [...new Set(urls)];
}

// Extract beds/baths and price from HTML cards (matching Python XPath selectors)
function extractApartmentsHTMLData(html: string): { bedsBaths: string[]; prices: string[]; phones: string[] } {
  const bedsBaths: string[] = [];
  const prices: string[] = [];
  const phones: string[] = [];
  
  try {
    // Python: response.xpath("//section[@class='placard-content']//div[@class='property-wrapper']")
    const placardSections = html.matchAll(/<section[^>]*class=["'][^"']*placard-content[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi);
    
    for (const section of placardSections) {
      const content = section[1];
      
      // Python: li.xpath(".//div[@class='bed-range']/text()")
      const bedRangeMatch = content.match(/<div[^>]*class=["'][^"']*bed-range[^"']*["'][^>]*>([^<]+)<\/div>/i);
      bedsBaths.push(bedRangeMatch?.[1]?.trim() || '');
      
      // Python: li.xpath(".//div[@class='price-range']/text()")
      const priceRangeMatch = content.match(/<div[^>]*class=["'][^"']*price-range[^"']*["'][^>]*>([^<]+)<\/div>/i);
      prices.push(priceRangeMatch?.[1]?.trim() || '');
      
      // Python: li.xpath(".//button[@class='phone-link js-phone']/span/text()")
      const phoneMatch = content.match(/<button[^>]*class=["'][^"']*phone-link[^"']*js-phone[^"']*["'][^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i) ||
                        content.match(/<button[^>]*class=["'][^"']*js-phone[^"']*["'][^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i);
      phones.push(phoneMatch?.[1]?.trim() || '');
    }
    
    // Fallback: Try alternative patterns
    if (bedsBaths.length === 0) {
      const allBedRanges = html.matchAll(/<div[^>]*class=["'][^"']*bed-range[^"']*["'][^>]*>([^<]+)<\/div>/gi);
      for (const match of allBedRanges) {
        bedsBaths.push(match[1].trim());
      }
    }
    
    if (prices.length === 0) {
      const allPriceRanges = html.matchAll(/<div[^>]*class=["'][^"']*price-range[^"']*["'][^>]*>([^<]+)<\/div>/gi);
      for (const match of allPriceRanges) {
        prices.push(match[1].trim());
      }
    }
    
    console.log(`[Apartments] HTML extraction: ${bedsBaths.length} beds/baths, ${prices.length} prices, ${phones.length} phones`);
  } catch (error) {
    console.error('[Apartments] Error extracting HTML data:', error);
  }
  
  return { bedsBaths, prices, phones };
}

// Extract Apartments.com detail page data (matching Python parse_detail)
function extractApartmentsDetailPage(html: string, sourceUrl: string): { listingTime: string } {
  let listingTime = '';
  
  try {
    // Python: response.xpath("//div[@class='freshnessContainer']/span[@class='lastUpdated']/span/text()")
    const freshnessMatch = html.match(/<div[^>]*class=["'][^"']*freshnessContainer[^"']*["'][^>]*>[\s\S]*?<span[^>]*class=["'][^"']*lastUpdated[^"']*["'][^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i);
    if (freshnessMatch) {
      listingTime = freshnessMatch[1].trim();
    }
    
    // Fallback: try simpler patterns
    if (!listingTime) {
      const altMatch = html.match(/lastUpdated[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i) ||
                      html.match(/Updated[:\s]*([^<]+)/i);
      if (altMatch) {
        listingTime = altMatch[1].trim();
      }
    }
  } catch (error) {
    console.error('[Apartments] Error extracting detail page:', error);
  }
  
  return { listingTime };
}

// Extract Apartments.com listings from JSON-LD and HTML (matching Python logic)
function extractApartmentsListings(html: string, sourceUrl: string): EnrichedListing[] {
  const listings: EnrichedListing[] = [];
  
  try {
    // First extract HTML data (beds/baths, prices, phones from placards)
    const htmlData = extractApartmentsHTMLData(html);
    
    // Python: script_content = response.xpath("//script[@type='application/ld+json']/text()").get()
    const jsonLdMatch = html.match(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    
    if (jsonLdMatch) {
      try {
        const data = JSON.parse(jsonLdMatch[1]);
        // Python: records = data.get('about', [])
        const records = data.about || [];
        
        console.log(`[Apartments] Found ${records.length} listings in JSON-LD 'about' array`);
        
        for (let idx = 0; idx < records.length; idx++) {
          const record = records[idx];
          
          const url = record.url || '';
          const telephone = cleanPhone(record.telephone || '');
          const name = (record.name || '').trim();
          
          // Python: address = record.get('Address', {}) - note capital A
          const address = record.Address || record.address || {};
          const streetAddress = (address.streetAddress || '').trim();
          const addressLocality = (address.addressLocality || '').trim();
          const addressRegion = (address.addressRegion || '').trim();
          const postalCode = (address.postalCode || '').trim();
          const addressCountry = (address.addressCountry || '').trim();
          
          const fullAddress = `${streetAddress}, ${addressLocality}, ${addressRegion} ${postalCode} ${addressCountry}`
            .replace(/^[,\s]+/, '')
            .replace(/[,\s]+$/, '')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (!fullAddress) continue;
          
          // Get beds/baths and price from HTML data (by index, matching Python logic)
          const bedsBaths = htmlData.bedsBaths[idx] || '';
          const price = htmlData.prices[idx] || '';
          const htmlPhone = htmlData.phones[idx] || '';
          
          // Parse beds/baths string
          let bedrooms: number | undefined;
          let bathrooms: number | undefined;
          if (bedsBaths) {
            const bedsMatch = bedsBaths.match(/(\d+)\s*(?:bed|br)/i);
            const bathsMatch = bedsBaths.match(/(\d+(?:\.\d)?)\s*(?:bath|ba)/i);
            if (bedsMatch) bedrooms = parseInt(bedsMatch[1]);
            if (bathsMatch) bathrooms = parseFloat(bathsMatch[1]);
          }
          
          const listing: EnrichedListing = {
            address: fullAddress,
            owner_name: name || undefined,
            owner_phone: telephone || htmlPhone || undefined,
            listing_url: url || undefined,
            price: price || undefined,
            bedrooms,
            bathrooms,
            listing_type: 'frbo',
            source_url: sourceUrl,
            source_platform: 'apartments',
            scraped_at: new Date().toISOString(),
            skip_trace_status: 'pending',
          };
          
          listings.push(listing);
        }
      } catch (e) {
        console.error('[Apartments] JSON-LD parse error:', e);
      }
    }
    
    // If no JSON-LD listings, try HTML card fallback
    if (listings.length === 0) {
      console.log('[Apartments] No JSON-LD listings, trying HTML extraction');
      return extractApartmentsFromHTML(html, sourceUrl);
    }
    
    console.log(`[Apartments] Extracted ${listings.length} listings`);
  } catch (error) {
    console.error('[Apartments] Error parsing:', error);
    return extractApartmentsFromHTML(html, sourceUrl);
  }

  return listings;
}

// Fallback: Extract Apartments.com listings from HTML structure (matching Python selectors)
function extractApartmentsFromHTML(html: string, sourceUrl: string): EnrichedListing[] {
  const listings: EnrichedListing[] = [];
  
  try {
    // Match property placard sections (matching Python selectors)
    // Python: response.xpath("//section[@class='placard-content']")
    const placardPattern = /<section[^>]*class=["'][^"']*placard-content[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi;
    const placardMatches = [...html.matchAll(placardPattern)];
    
    // Convert to array of [full, content] tuples
    let placards: Array<[string, string]> = placardMatches.map(m => [m[0], m[1] || m[0]]);
    
    // Also try article placard pattern
    if (placards.length === 0) {
      const articlePattern = /<article[^>]*class=["'][^"']*placard[^"']*"[^>]*>([\s\S]*?)<\/article>/gi;
      const articles = html.match(articlePattern) || [];
      for (const article of articles) {
        placards.push([article, article]);
      }
    }
    
    console.log(`[Apartments] Found ${placards.length} property placards in HTML`);

    for (const [fullMatch, content] of placards.slice(0, 100)) {
      // Extract address from title or address element
      const addressMatch = content.match(/class=["'][^"']*property-address[^"']*["'][^>]*>([^<]+)</i) ||
                          content.match(/class=["'][^"']*address[^"']*["'][^>]*>([^<]+)</i) ||
                          content.match(/title=["']([^"']+)["']/i);
      
      // Python: li.xpath(".//div[@class='price-range']/text()")
      const priceMatch = content.match(/<div[^>]*class=["'][^"']*price-range[^"']*["'][^>]*>([^<]+)<\/div>/i) ||
                        content.match(/\$[\d,]+(?:\s*-\s*\$[\d,]+)?/);
      
      // Python: li.xpath(".//button[@class='phone-link js-phone']/span/text()")
      const phoneMatch = content.match(/<button[^>]*class=["'][^"']*phone-link[^"']*["'][^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i) ||
                        content.match(/tel:([^"]+)"/i);
      
      // Extract URL
      const urlMatch = content.match(/href=["'](https:\/\/www\.apartments\.com\/[^"']+)["']/i);

      // Python: li.xpath(".//div[@class='bed-range']/text()")
      const bedsBathsMatch = content.match(/<div[^>]*class=["'][^"']*bed-range[^"']*["'][^>]*>([^<]+)<\/div>/i);
      let bedrooms: number | undefined;
      let bathrooms: number | undefined;
      if (bedsBathsMatch) {
        const text = bedsBathsMatch[1];
        const bedsMatch = text.match(/(\d+)\s*(?:bed|br)/i);
        const bathsMatch = text.match(/(\d+(?:\.\d)?)\s*(?:bath|ba)/i);
        if (bedsMatch) bedrooms = parseInt(bedsMatch[1]);
        if (bathsMatch) bathrooms = parseFloat(bathsMatch[1]);
      }

      if (addressMatch || urlMatch) {
        const listing: EnrichedListing = {
          address: addressMatch?.[1]?.trim() || 'See listing',
          price: typeof priceMatch?.[1] === 'string' ? priceMatch[1].trim() : priceMatch?.[0] || undefined,
          owner_phone: phoneMatch ? cleanPhone(phoneMatch[1]) || undefined : undefined,
          listing_url: urlMatch?.[1] || undefined,
          bedrooms,
          bathrooms,
          listing_type: 'frbo',
          source_url: sourceUrl,
          source_platform: 'apartments',
          scraped_at: new Date().toISOString(),
          skip_trace_status: 'pending',
        };

        listings.push(listing);
      }
    }
    
    // Additional fallback: try mortar-wrapper cards
    if (listings.length === 0) {
      const cardPattern = /<li[^>]*class=["'][^"']*mortar-wrapper[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
      const cards = html.match(cardPattern) || [];
      
      console.log(`[Apartments] Trying mortar-wrapper fallback: ${cards.length} cards`);
      
      for (const card of cards.slice(0, 100)) {
        const addressMatch = card.match(/class=["'][^"']*address[^"']*["'][^>]*>([^<]+)</i);
        const priceMatch = card.match(/\$[\d,]+/);
        const urlMatch = card.match(/href=["'](https:\/\/www\.apartments\.com\/[^"']+)["']/i);
        
        if (addressMatch || urlMatch) {
          const listing: EnrichedListing = {
            address: addressMatch?.[1]?.trim() || 'See listing',
            price: priceMatch?.[0] || undefined,
            listing_url: urlMatch?.[1] || undefined,
            listing_type: 'frbo',
            source_url: sourceUrl,
            source_platform: 'apartments',
            scraped_at: new Date().toISOString(),
            skip_trace_status: 'pending',
          };
          listings.push(listing);
        }
      }
    }
  } catch (error) {
    console.error('[Apartments] Error extracting from HTML:', error);
  }

  return listings;
}

// Extract HotPads listing URLs from the search results page (matching Python logic)
function extractHotpadsListingUrls(html: string): string[] {
  const urls: string[] = [];
  
  try {
    // Match listing card anchors: <a data-name="ListingCardAnchor" href="...">
    // Python: record.xpath(".//a[@data-name='ListingCardAnchor']/@href")
    const anchorPattern = /<a[^>]*data-name=["']ListingCardAnchor["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = anchorPattern.exec(html)) !== null) {
      const href = match[1];
      if (href && href.startsWith('/')) {
        urls.push(`https://hotpads.com${href}`);
      } else if (href && href.startsWith('http')) {
        urls.push(href);
      }
    }
    
    // Also try alternative pattern (href before data-name)
    if (urls.length === 0) {
      const altPattern = /<a[^>]*href=["']([^"']+)["'][^>]*data-name=["']ListingCardAnchor["'][^>]*>/gi;
      while ((match = altPattern.exec(html)) !== null) {
        const href = match[1];
        if (href && href.startsWith('/')) {
          urls.push(`https://hotpads.com${href}`);
        } else if (href && href.startsWith('http')) {
          urls.push(href);
        }
      }
    }
    
    // Fallback: Look for listing links in AreaListingsContainer
    // Python: response.xpath("//ul[@class='AreaListingsContainer-listings']/li")
    if (urls.length === 0) {
      const containerMatch = html.match(/<ul[^>]*class=["'][^"']*AreaListingsContainer-listings[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i);
      if (containerMatch) {
        const listItems = containerMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi);
        for (const li of listItems) {
          const linkMatch = li[1].match(/<a[^>]*href=["']([^"']+)["'][^>]*>/i);
          if (linkMatch?.[1]) {
            const href = linkMatch[1];
            if (href.includes('hotpads.com') || href.startsWith('/')) {
              urls.push(href.startsWith('/') ? `https://hotpads.com${href}` : href);
            }
          }
        }
      }
    }
    
    console.log(`[HotPads] Found ${urls.length} listing URLs on search page`);
  } catch (error) {
    console.error('[HotPads] Error extracting URLs:', error);
  }
  
  return [...new Set(urls)]; // Remove duplicates
}

// Extract HotPads detail page data (matching Python parse_detail logic)
function extractHotpadsDetailPage(html: string, sourceUrl: string): EnrichedListing | null {
  try {
    // Extract beds using Python's XPath logic:
    // response.xpath("//div[@class='HdpSummaryDetails']//div[@class='d_flex flex-d_column jc_center ai_flex-start c_hpxBlue600 mr_32px md:mr_60px'][1]/div/span/text()")
    let beds = '';
    let baths = '';
    
    // Try to find HdpSummaryDetails section
    const summaryMatch = html.match(/<div[^>]*class=["'][^"']*HdpSummaryDetails[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i);
    if (summaryMatch) {
      const summaryContent = summaryMatch[1];
      
      // Find all value columns (beds, baths, sqft order)
      const valueBlocks = summaryContent.matchAll(/<div[^>]*class=["'][^"']*d_flex[^"']*flex-d_column[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi);
      const values: string[] = [];
      for (const block of valueBlocks) {
        // Extract text from span elements
        const spanMatch = block[1].match(/<span[^>]*>([^<]+)<\/span>/gi);
        if (spanMatch) {
          const text = spanMatch.map(s => s.replace(/<[^>]+>/g, '').trim()).join('');
          if (text) values.push(text);
        }
      }
      
      if (values.length >= 1) beds = values[0];
      if (values.length >= 2) baths = values[1];
    }
    
    // Fallback: Look for bed/bath patterns in the HTML
    if (!beds) {
      const bedsMatch = html.match(/(\d+)\s*(?:bed|bedroom|br)/i);
      if (bedsMatch) beds = bedsMatch[1];
    }
    if (!baths) {
      const bathsMatch = html.match(/(\d+(?:\.\d)?)\s*(?:bath|bathroom|ba)/i);
      if (bathsMatch) baths = bathsMatch[1];
    }
    
    // Extract contact name (Python: //div[@class='ContactListedBy-name']/h2/text()[2])
    let contactName = '';
    const contactMatch = html.match(/<div[^>]*class=["'][^"']*ContactListedBy-name[^"']*["'][^>]*>[\s\S]*?<h2[^>]*>[\s\S]*?<[^>]+>[^<]*<\/[^>]+>([^<]*)<\/h2>/i);
    if (contactMatch) {
      contactName = contactMatch[1].trim();
    }
    // Fallback for contact name
    if (!contactName) {
      const altContactMatch = html.match(/ContactListedBy-name[^>]*>[\s\S]*?<h2[^>]*>([^<]+)/i);
      if (altContactMatch) contactName = altContactMatch[1].trim();
    }
    
    // Extract listing time (Python: //li[...]/span[contains(text(),'Listed')]/text())
    let listingTime = '';
    const listingTimeMatch = html.match(/<span[^>]*>([^<]*Listed[^<]*)<\/span>/i);
    if (listingTimeMatch) {
      listingTime = listingTimeMatch[1].trim();
    }
    
    // Extract from JSON-LD (Python's main extraction method)
    const jsonLdMatch = html.match(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const jsonData = JSON.parse(jsonLdMatch[1]);
        const graph = jsonData['@graph'] || [jsonData];
        
        for (const detail of graph) {
          const mainEntity = detail.mainEntity || detail;
          
          // Skip if no mainEntity and not a property type
          if (!detail.mainEntity && 
              !mainEntity['@type']?.includes?.('Residence') && 
              !mainEntity['@type']?.includes?.('Apartment') &&
              !mainEntity['@type']?.includes?.('House')) {
            continue;
          }
          
          const name = (mainEntity.name || '').trim();
          const phone = (mainEntity.telephone || '').trim();
          const address = mainEntity.address || {};
          
          const streetAddress = (address.streetAddress || '').trim();
          const addressLocality = (address.addressLocality || '').trim();
          const addressRegion = (address.addressRegion || '').trim();
          const postalCode = (address.postalCode || '').trim();
          const fullAddress = `${streetAddress}, ${addressLocality}, ${addressRegion} ${postalCode}`.replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
          
          if (!fullAddress || fullAddress === ', ') continue;
          
          const description = (mainEntity.description || '').trim();
          
          const listing: EnrichedListing = {
            address: fullAddress,
            owner_name: name || contactName || undefined,
            owner_phone: cleanPhone(phone) || undefined,
            description: description?.slice(0, 500) || undefined,
            bedrooms: beds ? parseInt(beds) : undefined,
            bathrooms: baths ? parseFloat(baths) : undefined,
            listing_url: sourceUrl,
            listing_type: 'frbo',
            source_url: sourceUrl,
            source_platform: 'hotpads',
            scraped_at: new Date().toISOString(),
            skip_trace_status: 'pending',
          };
          
          // Calculate days on market from listing time
          if (listingTime) {
            const daysMatch = listingTime.match(/(\d+)\s*day/i);
            if (daysMatch) {
              listing.days_on_market = parseInt(daysMatch[1]);
            }
          }
          
          return listing;
        }
      } catch (e) {
        console.error('[HotPads] JSON-LD parse error:', e);
      }
    }
    
    return null;
  } catch (error) {
    console.error('[HotPads] Error parsing detail page:', error);
    return null;
  }
}

// Extract HotPads listings from JSON-LD @graph (for search results without visiting detail pages)
function extractHotpadsListings(html: string, sourceUrl: string): EnrichedListing[] {
  const listings: EnrichedListing[] = [];
  
  try {
    // First, try to extract listing URLs for detail page scraping
    const listingUrls = extractHotpadsListingUrls(html);
    console.log(`[HotPads] Found ${listingUrls.length} listing URLs to process`);
    
    // For now, we'll extract what we can from the search page JSON-LD
    // Find all JSON-LD blocks
    const jsonLdMatches = html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    
    for (const match of jsonLdMatches) {
      try {
        const jsonData = JSON.parse(match[1]);
        
        // Handle @graph array (detail pages)
        const graph = jsonData['@graph'] || (Array.isArray(jsonData) ? jsonData : [jsonData]);
        
        console.log(`[HotPads] Processing ${graph.length} items from JSON-LD`);
        
        for (const item of graph) {
          // Try mainEntity first (detail pages)
          let entity = item.mainEntity || item;
          
          // Skip non-property types
          const itemType = entity['@type'] || '';
          const isProperty = itemType.includes('Residence') || 
                            itemType.includes('Apartment') || 
                            itemType.includes('House') ||
                            itemType.includes('Product') ||
                            itemType.includes('Place') ||
                            itemType === 'SingleFamilyResidence' ||
                            itemType === 'ApartmentComplex';
          
          if (!isProperty && !item.mainEntity) {
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
          
          if (!fullAddress) continue;
          
          // Get price
          let price = entity.offers?.price || entity.offers?.lowPrice || entity.priceRange;
          if (price && typeof price === 'number') {
            price = `$${price.toLocaleString()}`;
          }
          
          const listing: EnrichedListing = {
            address: fullAddress,
            owner_name: entity.name?.trim() || undefined,
            owner_phone: cleanPhone(entity.telephone) || undefined,
            description: entity.description?.trim()?.slice(0, 500) || undefined,
            price: price?.toString() || undefined,
            listing_url: entity.url || sourceUrl,
            listing_type: 'frbo',
            source_url: sourceUrl,
            source_platform: 'hotpads',
            scraped_at: new Date().toISOString(),
            skip_trace_status: 'pending',
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
    
    // If no listings from JSON-LD, try HTML extraction
    if (listings.length === 0) {
      console.log('[HotPads] No JSON-LD listings, trying HTML card extraction');
      
      // Extract from listing cards (search results page)
      // Python: response.xpath("//ul[@class='AreaListingsContainer-listings']/li")
      const containerMatch = html.match(/<ul[^>]*class=["'][^"']*AreaListingsContainer-listings[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i);
      if (containerMatch) {
        const listItems = [...containerMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
        console.log(`[HotPads] Found ${listItems.length} listing cards in HTML`);
        
        for (const li of listItems.slice(0, 100)) {
          const card = li[1];
          
          // Get listing URL
          const urlMatch = card.match(/href=["']([^"']+)["']/i);
          let listingUrl = '';
          if (urlMatch?.[1]) {
            listingUrl = urlMatch[1].startsWith('/') ? `https://hotpads.com${urlMatch[1]}` : urlMatch[1];
          }
          
          // Extract address from card
          const addressMatch = card.match(/class=["'][^"']*(?:address|location)[^"']*["'][^>]*>([^<]+)</i) ||
                              card.match(/<span[^>]*>(\d+[^<]+(?:St|Ave|Rd|Dr|Blvd|Ln|Way|Ct)[^<]*)</i);
          
          // Extract price
          const priceMatch = card.match(/\$[\d,]+/);
          
          // Extract beds/baths
          const bedsMatch = card.match(/(\d+)\s*(?:bed|br)/i);
          const bathsMatch = card.match(/(\d+(?:\.\d)?)\s*(?:bath|ba)/i);
          
          if (addressMatch || listingUrl) {
            const listing: EnrichedListing = {
              address: addressMatch?.[1]?.trim() || 'See listing',
              price: priceMatch?.[0] || undefined,
              listing_url: listingUrl || undefined,
              listing_type: 'frbo',
              source_url: sourceUrl,
              source_platform: 'hotpads',
              scraped_at: new Date().toISOString(),
              skip_trace_status: 'pending',
            };
            
            if (bedsMatch) listing.bedrooms = parseInt(bedsMatch[1]);
            if (bathsMatch) listing.bathrooms = parseFloat(bathsMatch[1]);
            
            listings.push(listing);
          }
        }
      }
      
      // Additional fallback: Look for any property card patterns
      if (listings.length === 0) {
        const cardPatterns = [
          /<div[^>]*class="[^"]*ListingCard[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi,
          /<article[^>]*data-testid="[^"]*listing[^"]*"[^>]*>([\s\S]*?)<\/article>/gi,
        ];
        
        for (const pattern of cardPatterns) {
          const cards = html.match(pattern) || [];
          if (cards.length > 0) {
            console.log(`[HotPads] Found ${cards.length} listing cards via fallback pattern`);
            
            for (const card of cards.slice(0, 50)) {
              const addressMatch = card.match(/class="[^"]*address[^"]*"[^>]*>([^<]+)</i) ||
                                  card.match(/class="[^"]*location[^"]*"[^>]*>([^<]+)</i);
              const priceMatch = card.match(/\$[\d,]+/);
              const bedsMatch = card.match(/(\d+)\s*(?:bed|br)/i);
              const bathsMatch = card.match(/(\d+(?:\.\d)?)\s*(?:bath|ba)/i);
              const urlMatch = card.match(/href=["']([^"']+)["']/i);
              
              if (addressMatch) {
                const listing: EnrichedListing = {
                  address: addressMatch[1].trim(),
                  price: priceMatch?.[0] || undefined,
                  listing_url: urlMatch?.[1]?.startsWith('/') ? `https://hotpads.com${urlMatch[1]}` : urlMatch?.[1] || undefined,
                  listing_type: 'frbo',
                  source_url: sourceUrl,
                  source_platform: 'hotpads',
                  scraped_at: new Date().toISOString(),
                  skip_trace_status: 'pending',
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
    }
    
    // Store listing URLs for potential detail page scraping
    if (listings.length === 0 && listingUrls.length > 0) {
      console.log(`[HotPads] Creating placeholder listings from ${listingUrls.length} URLs`);
      for (const url of listingUrls.slice(0, 100)) {
        listings.push({
          address: 'See listing',
          listing_url: url,
          listing_type: 'frbo',
          source_url: sourceUrl,
          source_platform: 'hotpads',
          scraped_at: new Date().toISOString(),
          skip_trace_status: 'pending',
        });
      }
    }
    
    console.log(`[HotPads] Extracted ${listings.length} listings total`);
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

// Skip trace a single address using Tracerfy or BatchData
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

  // Try BatchData API first (more reliable)
  const batchDataKey = Deno.env.get('BATCHDATA_API_KEY');
  if (batchDataKey) {
    try {
      const response = await fetch('https://api.batchdata.com/api/v1/property/skip-trace', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${batchDataKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{
            streetAddress: addressData.street,
            city: addressData.city || '',
            state: addressData.state || '',
            zipCode: addressData.zip || '',
          }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const result = data.results?.[0];
        if (result?.persons?.[0]) {
          const person = result.persons[0];
          return {
            success: true,
            data: {
              fullName: person.names?.[0]?.fullName || null,
              firstName: person.names?.[0]?.firstName || null,
              lastName: person.names?.[0]?.lastName || null,
              phones: (person.phones || []).map((p: any) => ({
                number: p.phoneNumber || p.number,
                type: p.phoneType || 'unknown',
                lineType: p.carrierType,
              })),
              emails: (person.emails || []).map((e: any) => ({
                address: e.emailAddress || e.email,
                type: e.emailType,
              })),
              confidence: result.confidenceScore || 0,
            },
          };
        }
        return {
          success: true,
          data: { fullName: null, firstName: null, lastName: null, phones: [], emails: [], confidence: 0 },
          message: 'No owner information found',
        };
      }
    } catch (error) {
      console.error('[BatchData] Error:', error);
    }
  }

  // Fallback to Tracerfy - using correct endpoint
  try {
    // Tracerfy API v2 endpoint
    const response = await fetch('https://www.tracerfy.com/api/v2/trace', {
      method: 'POST',
      headers: {
        'x-api-key': tracerfyApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        street: addressData.street,
        city: addressData.city || '',
        state: addressData.state || '',
        zip: addressData.zip || '',
      }),
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 422) {
        return {
          success: true,
          data: { fullName: null, firstName: null, lastName: null, phones: [], emails: [], confidence: 0 },
          message: 'No owner information found',
        };
      }
      const errorText = await response.text();
      console.error('[Tracerfy] API error:', response.status, errorText);
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
            // First try to extract from search page (for basic info)
            listings = extractZillowListings(html, formattedUrl, listingType);
            
            // Get listing URLs for detail page scraping (matching Python's two-phase approach)
            const zillowDetailUrls = extractZillowListingUrls(html);
            
            // If we have detail URLs, scrape them for richer data (Python's detail_page method)
            if (zillowDetailUrls.length > 0) {
              console.log(`[Zillow] Scraping ${Math.min(zillowDetailUrls.length, 50)} detail pages...`);
              const uniqueUrls = new Set<string>();
              const zillowDetailListings: EnrichedListing[] = [];
              
              for (const detailUrl of zillowDetailUrls.slice(0, 50)) {
                // Skip duplicates (matching Python's unique_list check)
                if (uniqueUrls.has(detailUrl)) continue;
                uniqueUrls.add(detailUrl);
                
                try {
                  console.log(`[Zillow Detail] ${detailUrl}`);
                  let detailHtml = '';
                  
                  // Zillow requires Zyte for detail pages
                  if (zyteApiKey) {
                    const zyteResult = await scrapeWithZyte(detailUrl, zyteApiKey);
                    if (zyteResult.success) {
                      detailHtml = zyteResult.html;
                      zyteUsed++;
                    }
                  } else if (firecrawlApiKey) {
                    const resp = await fetch('https://api.firecrawl.dev/v1/scrape', {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${firecrawlApiKey}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        url: detailUrl,
                        formats: ['rawHtml'],
                        onlyMainContent: false,
                        waitFor: 3000,
                      }),
                    });
                    const respData = await resp.json();
                    if (resp.ok) {
                      detailHtml = respData.data?.rawHtml || respData.rawHtml || '';
                    }
                  }
                  
                  if (detailHtml) {
                    const detailListing = extractZillowDetailPage(detailHtml, detailUrl, listingType);
                    if (detailListing && detailListing.address) {
                      zillowDetailListings.push(detailListing);
                    }
                  }
                  
                  // Delay between requests (matching Python's DOWNLOAD_DELAY: 0.8)
                  await new Promise(resolve => setTimeout(resolve, 800));
                } catch (detailError) {
                  console.error(`[Zillow Detail] Error scraping ${detailUrl}:`, detailError);
                }
              }
              
              // Use detail listings if we got data
              if (zillowDetailListings.length > 0) {
                console.log(`[Zillow] Got ${zillowDetailListings.length} listings from detail pages`);
                listings = zillowDetailListings;
              }
            }
            break;
          case 'apartments':
            listings = extractApartmentsListings(html, formattedUrl);
            break;
          case 'hotpads':
            // First extract what we can from the search page
            listings = extractHotpadsListings(html, formattedUrl);
            
            // If we got placeholder listings (only URLs), scrape detail pages
            const detailUrls = extractHotpadsListingUrls(html);
            if (detailUrls.length > 0 && listings.every(l => l.address === 'See listing' || !l.owner_phone)) {
              console.log(`[HotPads] Scraping ${Math.min(detailUrls.length, 50)} detail pages...`);
              const detailListings: EnrichedListing[] = [];
              
              for (const detailUrl of detailUrls.slice(0, 50)) {
                try {
                  console.log(`[HotPads Detail] ${detailUrl}`);
                  let detailHtml = '';
                  
                  if (zyteApiKey) {
                    const zyteResult = await scrapeWithZyte(detailUrl, zyteApiKey);
                    if (zyteResult.success) {
                      detailHtml = zyteResult.html;
                    }
                  } else if (firecrawlApiKey) {
                    const resp = await fetch('https://api.firecrawl.dev/v1/scrape', {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${firecrawlApiKey}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        url: detailUrl,
                        formats: ['rawHtml'],
                        onlyMainContent: false,
                        waitFor: 2000,
                      }),
                    });
                    const respData = await resp.json();
                    if (resp.ok) {
                      detailHtml = respData.data?.rawHtml || respData.rawHtml || '';
                    }
                  }
                  
                  if (detailHtml) {
                    const detailListing = extractHotpadsDetailPage(detailHtml, detailUrl);
                    if (detailListing && detailListing.address && detailListing.address !== 'See listing') {
                      detailListings.push(detailListing);
                    }
                  }
                  
                  // Delay between requests (matching Python's DOWNLOAD_DELAY: 0.5)
                  await new Promise(resolve => setTimeout(resolve, 500));
                } catch (detailError) {
                  console.error(`[HotPads Detail] Error scraping ${detailUrl}:`, detailError);
                }
              }
              
              // Use detail listings if we got more data
              if (detailListings.length > 0) {
                console.log(`[HotPads] Got ${detailListings.length} listings from detail pages`);
                listings = detailListings;
              }
            }
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
