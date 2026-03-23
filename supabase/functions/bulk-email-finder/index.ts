import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ContactInput {
  first_name: string;
  last_name: string;
  domain: string;
  company?: string;
}

interface EmailResult {
  first_name: string;
  last_name: string;
  domain: string;
  email: string | null;
  confidence: number;
  source: string;
  verified: boolean;
}

// ── Hunter.io ──
async function findWithHunter(contact: ContactInput, apiKey: string): Promise<EmailResult | null> {
  try {
    const params = new URLSearchParams({
      domain: contact.domain,
      first_name: contact.first_name,
      last_name: contact.last_name,
      api_key: apiKey,
    });
    const resp = await fetch(`https://api.hunter.io/v2/email-finder?${params}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.data?.email) {
      return {
        first_name: contact.first_name,
        last_name: contact.last_name,
        domain: contact.domain,
        email: data.data.email,
        confidence: data.data.confidence || 0,
        source: 'hunter',
        verified: data.data.verification?.status === 'valid',
      };
    }
    return null;
  } catch { return null; }
}

// ── Apollo ──
async function findWithApollo(contact: ContactInput, apiKey: string): Promise<EmailResult | null> {
  try {
    const resp = await fetch('https://api.apollo.io/api/v1/people/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        first_name: contact.first_name,
        last_name: contact.last_name,
        organization_name: contact.company || contact.domain,
        domain: contact.domain,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const person = data.person;
    if (person?.email) {
      return {
        first_name: contact.first_name,
        last_name: contact.last_name,
        domain: contact.domain,
        email: person.email,
        confidence: person.email_confidence || 80,
        source: 'apollo',
        verified: person.email_status === 'verified',
      };
    }
    return null;
  } catch { return null; }
}

// ── Snov.io ──
async function findWithSnov(contact: ContactInput, apiKey: string): Promise<EmailResult | null> {
  try {
    const resp = await fetch('https://api.snov.io/v1/get-emails-from-names', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: contact.first_name,
        lastName: contact.last_name,
        domain: contact.domain,
        key: apiKey,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.data?.emails?.length) {
      const best = data.data.emails[0];
      return {
        first_name: contact.first_name,
        last_name: contact.last_name,
        domain: contact.domain,
        email: best.email,
        confidence: best.probability || 70,
        source: 'snov',
        verified: best.status === 'valid',
      };
    }
    return null;
  } catch { return null; }
}

// ── RocketReach ──
async function findWithRocketReach(contact: ContactInput, apiKey: string): Promise<EmailResult | null> {
  try {
    const resp = await fetch('https://api.rocketreach.co/v2/api/lookupProfile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Api-Key': apiKey },
      body: JSON.stringify({
        name: `${contact.first_name} ${contact.last_name}`,
        current_employer: contact.company || contact.domain,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const emails = data.emails || data.teaser?.emails || [];
    if (emails.length) {
      return {
        first_name: contact.first_name,
        last_name: contact.last_name,
        domain: contact.domain,
        email: emails[0],
        confidence: 75,
        source: 'rocketreach',
        verified: false,
      };
    }
    return null;
  } catch { return null; }
}

// ── ZeroBounce verify ──
async function verifyEmail(email: string, apiKey: string): Promise<{ valid: boolean; status: string }> {
  try {
    const params = new URLSearchParams({ api_key: apiKey, email });
    const resp = await fetch(`https://api.zerobounce.net/v2/validate?${params}`);
    if (!resp.ok) return { valid: false, status: 'error' };
    const data = await resp.json();
    return { valid: data.status === 'valid', status: data.status };
  } catch { return { valid: false, status: 'error' }; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { contacts, verify = false } = await req.json() as { contacts: ContactInput[]; verify?: boolean };
    if (!contacts?.length) {
      return new Response(JSON.stringify({ success: false, error: 'contacts array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const hunterKey = Deno.env.get('HUNTER_API_KEY');
    const apolloKey = Deno.env.get('APOLLO_API_KEY');
    const snovKey = Deno.env.get('SNOVIO_API_KEY');
    const rrKey = Deno.env.get('ROCKETREACH_API_KEY');
    const zbKey = Deno.env.get('ZEROBOUNCE_API_KEY');

    const results: EmailResult[] = [];
    const batchSize = 5;

    for (let i = 0; i < Math.min(contacts.length, 100); i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(async (contact) => {
        // Waterfall through providers until we find an email
        const finders = [
          hunterKey ? () => findWithHunter(contact, hunterKey) : null,
          apolloKey ? () => findWithApollo(contact, apolloKey) : null,
          snovKey ? () => findWithSnov(contact, snovKey) : null,
          rrKey ? () => findWithRocketReach(contact, rrKey) : null,
        ].filter(Boolean) as (() => Promise<EmailResult | null>)[];

        // Try all in parallel, pick highest confidence
        const allResults = await Promise.allSettled(finders.map(fn => fn()));
        const found = allResults
          .filter((r): r is PromiseFulfilledResult<EmailResult | null> => r.status === 'fulfilled' && r.value !== null)
          .map(r => r.value!)
          .sort((a, b) => b.confidence - a.confidence);

        if (found.length === 0) {
          return {
            first_name: contact.first_name,
            last_name: contact.last_name,
            domain: contact.domain,
            email: null,
            confidence: 0,
            source: 'none',
            verified: false,
          };
        }

        const best = found[0];

        // Optional verification
        if (verify && best.email && zbKey && !best.verified) {
          const verification = await verifyEmail(best.email, zbKey);
          best.verified = verification.valid;
        }

        return best;
      }));

      results.push(...batchResults);
    }

    const found = results.filter(r => r.email !== null).length;

    return new Response(JSON.stringify({
      success: true,
      results,
      summary: { total: results.length, found, not_found: results.length - found },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[BulkEmailFinder] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
