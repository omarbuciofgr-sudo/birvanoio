import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Google Places Search - Find verified local business information
 * 
 * Uses Google Places API to find:
 * - Business name, address, phone
 * - Business hours, website
 * - Reviews and ratings
 * - Business categories
 */

interface PlacesSearchParams {
  query: string;          // e.g., "roofing companies in Houston TX"
  location?: {
    lat: number;
    lng: number;
  };
  radius?: number;        // in meters, default 50000 (50km)
  type?: string;          // e.g., "roofing_contractor", "plumber"
  limit?: number;         // max results to return
}

interface PlaceResult {
  place_id: string;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  business_status: string | null;
  types: string[];
  location: {
    lat: number;
    lng: number;
  } | null;
  hours: string[] | null;
  // Extracted from reviews if available
  owner_mentions: string[];
}

// Text search for businesses
async function searchPlaces(
  params: PlacesSearchParams,
  apiKey: string
): Promise<PlaceResult[]> {
  const results: PlaceResult[] = [];
  
  try {
    // Use Text Search (New) API
    const searchUrl = 'https://places.googleapis.com/v1/places:searchText';
    
    const requestBody: Record<string, unknown> = {
      textQuery: params.query,
      maxResultCount: Math.min(params.limit || 20, 20),
      languageCode: 'en',
    };
    
    if (params.location) {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: params.location.lat,
            longitude: params.location.lng,
          },
          radius: params.radius || 50000,
        },
      };
    }
    
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus,places.types,places.location,places.currentOpeningHours,places.reviews',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Google Places API error:', error);
      return results;
    }
    
    const data = await response.json();
    console.log(`Google Places returned ${data.places?.length || 0} results`);
    
    for (const place of (data.places || [])) {
      // Extract owner mentions from reviews
      const ownerMentions: string[] = [];
      if (place.reviews) {
        for (const review of place.reviews) {
          const text = review.text?.text || '';
          // Look for owner/manager names in reviews
          const ownerPatterns = [
            /(?:owner|manager|ceo|founder)\s+(\w+(?:\s+\w+)?)/gi,
            /(\w+(?:\s+\w+)?)\s+(?:the owner|runs this|manages)/gi,
            /thank(?:s|ed)\s+(\w+)/gi,
          ];
          
          for (const pattern of ownerPatterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
              if (match[1] && match[1].length > 2 && match[1].length < 30) {
                ownerMentions.push(match[1].trim());
              }
            }
          }
        }
      }
      
      results.push({
        place_id: place.id,
        name: place.displayName?.text || '',
        address: place.formattedAddress || '',
        phone: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
        website: place.websiteUri || null,
        rating: place.rating || null,
        review_count: place.userRatingCount || null,
        business_status: place.businessStatus || null,
        types: place.types || [],
        location: place.location ? {
          lat: place.location.latitude,
          lng: place.location.longitude,
        } : null,
        hours: place.currentOpeningHours?.weekdayDescriptions || null,
        owner_mentions: [...new Set(ownerMentions)].slice(0, 3),
      });
    }
  } catch (error) {
    console.error('Google Places search error:', error);
  }
  
  return results;
}

// Get detailed place info including more reviews
async function getPlaceDetails(
  placeId: string,
  apiKey: string
): Promise<PlaceResult | null> {
  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,nationalPhoneNumber,internationalPhoneNumber,websiteUri,rating,userRatingCount,businessStatus,types,location,currentOpeningHours,reviews',
        },
      }
    );
    
    if (!response.ok) return null;
    
    const place = await response.json();
    
    // Extract owner mentions from reviews
    const ownerMentions: string[] = [];
    if (place.reviews) {
      for (const review of place.reviews) {
        const text = review.text?.text || '';
        const ownerPatterns = [
          /(?:owner|manager|ceo|founder)\s+(\w+(?:\s+\w+)?)/gi,
          /(\w+(?:\s+\w+)?)\s+(?:the owner|runs this|manages)/gi,
        ];
        
        for (const pattern of ownerPatterns) {
          const matches = text.matchAll(pattern);
          for (const match of matches) {
            if (match[1] && match[1].length > 2 && match[1].length < 30) {
              ownerMentions.push(match[1].trim());
            }
          }
        }
      }
    }
    
    return {
      place_id: place.id,
      name: place.displayName?.text || '',
      address: place.formattedAddress || '',
      phone: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
      website: place.websiteUri || null,
      rating: place.rating || null,
      review_count: place.userRatingCount || null,
      business_status: place.businessStatus || null,
      types: place.types || [],
      location: place.location ? {
        lat: place.location.latitude,
        lng: place.location.longitude,
      } : null,
      hours: place.currentOpeningHours?.weekdayDescriptions || null,
      owner_mentions: [...new Set(ownerMentions)].slice(0, 3),
    };
  } catch (error) {
    console.error('Place details error:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    
    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Google Places API key not configured. Add GOOGLE_PLACES_API_KEY to secrets.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const body = await req.json();
    const { action = 'search', ...params } = body;
    
    if (action === 'search') {
      if (!params.query) {
        return new Response(
          JSON.stringify({ success: false, error: 'Query is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const results = await searchPlaces(params as PlacesSearchParams, googleApiKey);
      
      return new Response(
        JSON.stringify({
          success: true,
          data: results,
          total: results.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (action === 'details') {
      if (!params.place_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'place_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const result = await getPlaceDetails(params.place_id, googleApiKey);
      
      return new Response(
        JSON.stringify({
          success: !!result,
          data: result,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Google Places function error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
