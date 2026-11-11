import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { contactFound } from '../_shared/ownerContact.ts';
import { batchDataSkipTrace } from '../_shared/batchData.ts';
import { ownerNameString } from '../_shared/ownerName.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

interface SkipTraceRequest {
  address?: string;
  listingId?: string;
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

// BatchData via the shared client; keeps raw reply for no-match auditing.
let lastProvider: { http_status: number; body: string } | null = null;
async function tryBatchData(addressData: Record<string, string>): Promise<SkipTraceResult | null> {
  const r = await batchDataSkipTrace({ street: addressData.street, city: addressData.city, state: addressData.state, zip: addressData.zip });
  lastProvider = { http_status: r.httpStatus, body: r.rawSummary };
  if (!r.ok) { console.error('[Skip Trace] BatchData failed:', r.error); return null; }
  return { success: true, provider: 'batchdata', data: { fullName: r.fullName, firstName: r.firstName, lastName: r.lastName, phones: r.phones, emails: r.emails } };
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

  let auditId: string | null = null;
  let auditClient: ReturnType<typeof createClient> | null = null;
  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - Missing or invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    if (!supabaseUrl) {
      console.error('tracerfy-skip-trace: SUPABASE_URL is not set');
      return new Response(
        JSON.stringify({ success: false, error: 'Server misconfigured (SUPABASE_URL).' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceKey) {
      console.error('tracerfy-skip-trace: SUPABASE_SERVICE_ROLE_KEY is not set');
      return new Response(
        JSON.stringify({
          success: false,
          error:
            'Server misconfigured: Edge Function needs SUPABASE_SERVICE_ROLE_KEY (normally auto-injected on Supabase).',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !user) {
      console.error('tracerfy-skip-trace auth error:', userError?.message ?? userError);
      return new Response(
        JSON.stringify({
          success: false,
          error:
            'Unauthorized - Sign in again. (If you see this while logged in, the session token was missing or invalid.)',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log('[Skip Trace] Authenticated user:', userId);

    // Skip trace is allowed for any authenticated user (scraper uses it internally)

    const body: SkipTraceRequest = await req.json();
    auditClient = admin;
    let listing: Record<string, any> | null = null;
    if (body.listingId) {
      const { data: saved, error: savedError } = await admin.from('owner_search_results')
        .select('listing_data').eq('user_id', userId).eq('external_id', body.listingId).maybeSingle();
      if (savedError || !saved) return new Response(JSON.stringify({ success: false, error: 'Listing not available. Run a search first.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      listing = saved.listing_data;
      body.address = listing?.address_line1 || listing?.address;
      body.city = listing?.city || '';
      body.state = listing?.state || '';
      body.zip = listing?.zip_code || '';
      if (!listing?.address_line1 && listing?.address?.includes(',')) body.fullAddress = listing.address;
    }
    const listingId = body.listingId || body.fullAddress || [body.address, body.city, body.state, body.zip].filter(Boolean).join(', ');
    const { data: attempt, error: attemptError } = await admin.from('owner_contact_lookups').insert({ user_id: userId, listing_id: listingId || 'invalid' }).select('id').single();
    if (attemptError || !attempt) return new Response(JSON.stringify({ success: false, error: 'A lookup is already running for this listing. Please wait and try again.' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    auditId = attempt.id;
    
    // Validate input
    if (!body.fullAddress && !body.address) {
      await admin.rpc('finish_owner_contact_lookup', { p_id: auditId, p_phone: false, p_email: false, p_error: 'invalid_address' });
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
        street: body.address || '',
        city: body.city || '',
        state: body.state || '',
        zip: body.zip || '',
      };
    }

    console.log('[Skip Trace] Processing address:', addressData);

    // Reuse a contact already revealed to this user, without another charge.
    let result: SkipTraceResult | null = listing && (listing.owner_phone || listing.owner_email) ? {
      success: true, data: { fullName: ownerNameString(listing.owner_name), firstName: null, lastName: null,
        phones: listing.owner_phone ? [{ number: listing.owner_phone, type: 'primary' }] : [],
        emails: listing.owner_email ? [{ address: listing.owner_email }] : [] },
    } : await tryBatchData(addressData);
    const found = contactFound(result?.data);
    const next = listing ? { ...listing, owner_name: ownerNameString(result?.data?.fullName) || ownerNameString(listing.owner_name),
      owner_phone: found.phone ? result?.data?.phones.find(p => p.number.replace(/\D/g, '').length >= 7)?.number : null,
      owner_email: found.email ? result?.data?.emails.find(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.address))?.address : null,
      contact_status: found.phone && found.email ? 'phone_email' : found.phone ? 'phone_only' : found.email ? 'email_only' : 'none',
      enriched_at: new Date().toISOString() } : null;
    const { data: charge, error: finishError } = await admin.rpc('finish_owner_contact_lookup', {
      p_id: auditId, p_phone: found.phone, p_email: found.email, p_listing: next,
      p_error: result ? null : 'provider_unavailable',
      p_provider_response: !(found.phone || found.email) && lastProvider ? lastProvider : null,
    });
    if (finishError) throw finishError;
    if (!charge?.success) return new Response(JSON.stringify({ success: false, error: charge?.error === 'insufficient_credits' ? 'Not enough credits. Upgrade to get more contact lookups.' : 'Contact lookup is temporarily unavailable. No lookup or credits charged.', credits_spent: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ ...result, success: true, matched: found.phone || found.email,
      listing: next, credits_spent: charge.spent, free_lookup_used: charge.free_used,
      message: found.phone || found.email ? 'Owner contact found.' : "We couldn't find contact info for this owner. No lookup or credits charged. Try another listing." }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Skip trace error:', error);
    if (auditId && auditClient) await auditClient.rpc('finish_owner_contact_lookup', { p_id: auditId, p_phone: false, p_email: false, p_error: 'lookup_failed' });
    const errorMessage = error instanceof Error ? error.message : 'Skip trace failed';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
