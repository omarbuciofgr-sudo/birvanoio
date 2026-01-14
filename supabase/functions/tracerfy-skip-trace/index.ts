const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SkipTraceRequest {
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  // Alternative: full address string
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
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('TRACERFY_API_KEY');
    if (!apiKey) {
      console.error('TRACERFY_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Skip trace service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        const stateZip = parts[parts.length - 1].trim().split(' ');
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

    console.log('Skip tracing address:', addressData);

    // Tracerfy API call
    // Note: Tracerfy uses a simple REST API - adjust endpoint based on their actual docs
    const tracerfyUrl = 'https://api.tracerfy.com/v1/skip-trace';
    
    const response = await fetch(tracerfyUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: addressData.street,
        city: addressData.city,
        state: addressData.state,
        zip: addressData.zip,
      }),
    });

    const responseText = await response.text();
    console.log('Tracerfy response status:', response.status);

    if (!response.ok) {
      console.error('Tracerfy API error:', responseText);
      
      // Handle specific error codes
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid API key' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 404) {
        // No results found - this is not an error, just no data
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: {
              fullName: null,
              firstName: null,
              lastName: null,
              phones: [],
              emails: [],
              confidence: 0,
            },
            message: 'No owner information found for this address'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: `API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the Tracerfy response
    let tracerfyData;
    try {
      tracerfyData = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse Tracerfy response:', responseText);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid response from skip trace service' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize the response to our standard format
    // Adjust field mappings based on actual Tracerfy API response structure
    const result: SkipTraceResult = {
      success: true,
      data: {
        fullName: tracerfyData.full_name || tracerfyData.name || null,
        firstName: tracerfyData.first_name || null,
        lastName: tracerfyData.last_name || null,
        phones: (tracerfyData.phones || tracerfyData.phone_numbers || []).map((p: any) => ({
          number: typeof p === 'string' ? p : p.number || p.phone,
          type: typeof p === 'string' ? 'unknown' : p.type || 'unknown',
          lineType: typeof p === 'string' ? undefined : p.line_type,
        })),
        emails: (tracerfyData.emails || tracerfyData.email_addresses || []).map((e: any) => ({
          address: typeof e === 'string' ? e : e.address || e.email,
          type: typeof e === 'string' ? undefined : e.type,
        })),
        mailingAddress: tracerfyData.mailing_address ? {
          street: tracerfyData.mailing_address.street,
          city: tracerfyData.mailing_address.city,
          state: tracerfyData.mailing_address.state,
          zip: tracerfyData.mailing_address.zip,
        } : undefined,
        propertyAddress: {
          street: addressData.street,
          city: addressData.city,
          state: addressData.state,
          zip: addressData.zip,
        },
        confidence: tracerfyData.confidence_score || tracerfyData.confidence || undefined,
      },
    };

    console.log('Skip trace successful, found:', {
      hasName: !!result.data?.fullName,
      phoneCount: result.data?.phones.length || 0,
      emailCount: result.data?.emails.length || 0,
    });

    return new Response(
      JSON.stringify(result),
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
