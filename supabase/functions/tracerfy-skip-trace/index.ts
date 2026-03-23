import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

interface SkipTraceRequest {
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  fullAddress?: string;
}

interface SkipTraceResult {
  success: boolean;
  data?: {
    fullName: string | null;
    firstName: string | null;
    lastName: string | null;
    phones: Array<{
      number: string;
      type: string;
      lineType?: string;
    }>;
    emails: Array<{
      address: string;
      type?: string;
    }>;
    mailingAddress?: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    propertyAddress?: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    confidence?: number;
  };
  error?: string;
  message?: string;
  provider?: string;
}

// Try BatchData API - Primary skip trace provider
async function tryBatchData(addressData: Record<string, string>): Promise<SkipTraceResult | null> {
  const batchDataKey = Deno.env.get('BATCHDATA_API_KEY');
  if (!batchDataKey) {
    console.log('[Skip Trace] BatchData API key not configured, skipping');
    return null;
  }

  try {
    console.log('[Skip Trace] Trying BatchData API with address:', JSON.stringify(addressData));
    
    // BatchData Property Skip Trace API
    // Endpoint: https://api.batchdata.com/api/v1/property/skip-trace
    // Docs: https://developer.batchdata.com/docs/batchdata/batchdata-v1/operations/create-a-property-skip-trace
    const requestBody = {
      requests: [{
        street: addressData.street,
        city: addressData.city || '',
        state: addressData.state || '',
        zip: addressData.zip || '',
      }],
    };
    
    console.log('[Skip Trace] BatchData request body:', JSON.stringify(requestBody));
    
    const response = await fetch('https://api.batchdata.com/api/v1/property/skip-trace', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${batchDataKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[Skip Trace] BatchData response status:', response.status);
    const responseText = await response.text();
    console.log('[Skip Trace] BatchData raw response (first 2000 chars):', responseText.slice(0, 2000));

    if (!response.ok) {
      console.error('[Skip Trace] BatchData error status:', response.status, responseText.slice(0, 500));
      
      // Check if it's an auth error
      if (response.status === 401 || response.status === 403) {
        console.error('[Skip Trace] BatchData authentication failed - check API key');
        return null;
      }
      
      // Try the alternate batch endpoint format
      console.log('[Skip Trace] Trying alternate BatchData batch endpoint...');
      const altRequestBody = {
        requests: [{
          propertyAddress: {
            street: addressData.street,
            city: addressData.city || '',
            state: addressData.state || '',
            zip: addressData.zip || '',
          },
        }],
      };
      
      const altResponse = await fetch('https://api.batchdata.com/api/v1/property/skip-trace/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${batchDataKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(altRequestBody),
      });
      
      console.log('[Skip Trace] Alternate BatchData response status:', altResponse.status);
      
      if (!altResponse.ok) {
        const altText = await altResponse.text();
        console.error('[Skip Trace] Alternate BatchData endpoint also failed:', altText.slice(0, 500));
        return null;
      }
      
      const altData = await altResponse.json();
      console.log('[Skip Trace] Alternate BatchData parsed response:', JSON.stringify(altData).slice(0, 1000));
      return parseBatchDataResponse(altData, addressData);
    }

    const data = JSON.parse(responseText);
    console.log('[Skip Trace] BatchData parsed response:', JSON.stringify(data).slice(0, 1000));
    return parseBatchDataResponse(data, addressData);
  } catch (error) {
    console.error('[Skip Trace] BatchData exception:', error);
    return null;
  }
}

// Parse BatchData response - handles multiple response formats
function parseBatchDataResponse(data: any, addressData: Record<string, string>): SkipTraceResult {
  console.log('[Skip Trace] Parsing BatchData response:', JSON.stringify(data).slice(0, 500));
  
  // BatchData returns results in various formats depending on endpoint
  const results = data.results || data.data || data.records || [];
  const firstResult = Array.isArray(results) ? results[0] : results;
  
  if (!firstResult) {
    return {
      success: true,
      data: { fullName: null, firstName: null, lastName: null, phones: [], emails: [], confidence: 0 },
      message: 'No owner information found',
      provider: 'batchdata',
    };
  }

  // Navigate to owner data - BatchData has nested structure
  const owner = firstResult.owner || firstResult.owners?.[0] || firstResult.person || firstResult;
  const phones: Array<{ number: string; type: string; lineType?: string }> = [];
  const emails: Array<{ address: string; type?: string }> = [];

  // Extract phones from various possible locations
  const phoneSources = [
    owner.phones,
    owner.phoneNumbers, 
    firstResult.phones,
    firstResult.phoneNumbers,
    owner.contacts?.phones,
  ];
  
  for (const phoneList of phoneSources) {
    if (Array.isArray(phoneList)) {
      for (const p of phoneList) {
        const number = typeof p === 'string' ? p : 
          (p.phoneNumber || p.number || p.phone || p.value);
        if (number && !phones.some(existing => existing.number === number)) {
          phones.push({
            number: number,
            type: typeof p === 'string' ? 'unknown' : (p.phoneType || p.type || 'unknown'),
            lineType: typeof p === 'string' ? undefined : (p.lineType || p.line_type),
          });
        }
      }
    }
  }
  
  // Check for single phone fields
  if (owner.phoneNumber && !phones.some(p => p.number === owner.phoneNumber)) {
    phones.push({ number: owner.phoneNumber, type: 'primary' });
  }
  if (owner.phone && !phones.some(p => p.number === owner.phone)) {
    phones.push({ number: owner.phone, type: 'primary' });
  }

  // Extract emails from various possible locations
  const emailSources = [
    owner.emails,
    owner.emailAddresses,
    firstResult.emails,
    firstResult.emailAddresses,
    owner.contacts?.emails,
  ];
  
  for (const emailList of emailSources) {
    if (Array.isArray(emailList)) {
      for (const e of emailList) {
        const address = typeof e === 'string' ? e : 
          (e.emailAddress || e.email || e.address || e.value);
        if (address && !emails.some(existing => existing.address === address)) {
          emails.push({ 
            address: address, 
            type: typeof e === 'object' ? e.type : undefined 
          });
        }
      }
    }
  }
  
  // Check for single email fields
  if (owner.emailAddress && !emails.some(e => e.address === owner.emailAddress)) {
    emails.push({ address: owner.emailAddress });
  }
  if (owner.email && !emails.some(e => e.address === owner.email)) {
    emails.push({ address: owner.email });
  }

  // Build full name from various possible fields
  const fullName = owner.fullName || owner.name || owner.full_name ||
    (owner.firstName && owner.lastName ? `${owner.firstName} ${owner.lastName}` : null) ||
    (owner.first_name && owner.last_name ? `${owner.first_name} ${owner.last_name}` : null);

  if (!fullName && phones.length === 0 && emails.length === 0) {
    return {
      success: true,
      data: { fullName: null, firstName: null, lastName: null, phones: [], emails: [], confidence: 0 },
      message: 'No owner information found',
      provider: 'batchdata',
    };
  }

  console.log(`[Skip Trace] BatchData found: name=${fullName}, phones=${phones.length}, emails=${emails.length}`);

  return {
    success: true,
    data: {
      fullName,
      firstName: owner.firstName || owner.first_name || null,
      lastName: owner.lastName || owner.last_name || null,
      phones,
      emails,
      propertyAddress: {
        street: addressData.street,
        city: addressData.city || '',
        state: addressData.state || '',
        zip: addressData.zip || '',
      },
      confidence: owner.confidence || (phones.length > 0 || emails.length > 0 ? 80 : 0),
    },
    provider: 'batchdata',
  };
}

// NOTE: Tracerfy has been removed from the real-estate enrichment process.
// This function remains for backwards compatibility (clients still invoke 'tracerfy-skip-trace'),
// but it will only use BatchData.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    // Echo requested headers for CORS preflight
    const requestedHeaders = req.headers.get('access-control-request-headers');
    return new Response(null, {
      headers: {
        ...corsHeaders,
        ...(requestedHeaders ? { 'Access-Control-Allow-Headers': requestedHeaders } : {}),
      },
    });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - Missing or invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify the user's JWT
    const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await authedClient.auth.getUser();
    if (userError || !user) {
      console.error('tracerfy-skip-trace auth error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log('[Skip Trace] Authenticated user:', userId);

    // Skip trace is allowed for any authenticated user (scraper uses it internally)

    const body: SkipTraceRequest = await req.json();
    
    // Validate input
    if (!body.fullAddress && !body.address) {
      return new Response(
        JSON.stringify({ success: false, error: 'Address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the address components
    let addressData: Record<string, string> = {};
    
    if (body.fullAddress) {
      // Parse full address string into components
      const parts = body.fullAddress.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        addressData.street = parts[0];
        addressData.city = parts[1];
        // Last part might be "STATE ZIP" or just "STATE"
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
        addressData.street = body.fullAddress;
      }
    } else {
      addressData = {
        street: body.address,
        city: body.city || '',
        state: body.state || '',
        zip: body.zip || '',
      };
    }

    console.log('[Skip Trace] Processing address:', addressData);

    // BatchData only
    let result: SkipTraceResult | null = null;

    // 1. Try BatchData first
    result = await tryBatchData(addressData);
    if (result?.data?.fullName || (result?.data?.phones && result.data.phones.length > 0)) {
      console.log('[Skip Trace] Success via BatchData');
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No providers configured or BatchData failed
    const hasAnyKey = Deno.env.get('BATCHDATA_API_KEY');
    if (!hasAnyKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No skip trace providers configured. Add BATCHDATA_API_KEY.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: { fullName: null, firstName: null, lastName: null, phones: [], emails: [], confidence: 0 },
        message: 'No owner information found from available providers',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Skip trace error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Skip trace failed';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
