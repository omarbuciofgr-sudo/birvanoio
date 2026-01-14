import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Email syntax validation
function isValidEmailSyntax(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

// Phone normalization to E.164
function normalizePhoneToE164(phone: string, countryCode = '1'): string {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 10) {
    return `+${countryCode}${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  } else if (digits.length > 10) {
    return `+${digits}`;
  }
  
  return phone;
}

// Check MX records via DNS lookup
async function hasMxRecords(domain: string): Promise<boolean> {
  try {
    const response = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
    const data = await response.json();
    return data.Answer && data.Answer.length > 0;
  } catch {
    return false;
  }
}

// Validate email with optional provider
async function validateEmail(
  email: string,
  zerobounceApiKey?: string
): Promise<{
  status: 'unverified' | 'likely_valid' | 'verified' | 'invalid';
  notes: string;
}> {
  // Step 1: Syntax check
  if (!isValidEmailSyntax(email)) {
    return { status: 'invalid', notes: 'Invalid email syntax' };
  }

  // Step 2: Domain/MX check
  const domain = email.split('@')[1];
  const hasMx = await hasMxRecords(domain);
  
  if (!hasMx) {
    return { status: 'invalid', notes: 'Domain has no MX records' };
  }

  // Step 3: Third-party verification (if API key provided)
  if (zerobounceApiKey) {
    try {
      const response = await fetch(
        `https://api.zerobounce.net/v2/validate?api_key=${zerobounceApiKey}&email=${encodeURIComponent(email)}`
      );
      const data = await response.json();

      if (data.status === 'valid') {
        return { status: 'verified', notes: `ZeroBounce: Valid (${data.sub_status || 'clean'})` };
      } else if (data.status === 'invalid') {
        return { status: 'invalid', notes: `ZeroBounce: ${data.sub_status || 'Invalid'}` };
      } else if (data.status === 'catch-all') {
        return { status: 'likely_valid', notes: 'ZeroBounce: Catch-all domain' };
      } else {
        return { status: 'likely_valid', notes: `ZeroBounce: ${data.status}` };
      }
    } catch (error) {
      console.error('ZeroBounce validation error:', error);
      // Fall back to likely_valid if API call fails
      return { status: 'likely_valid', notes: 'Domain has valid MX records (API validation failed)' };
    }
  }

  // Without third-party verification, mark as likely_valid
  return { status: 'likely_valid', notes: 'Domain has valid MX records' };
}

// Validate phone with optional Twilio Lookup
async function validatePhone(
  phone: string,
  twilioAccountSid?: string,
  twilioAuthToken?: string
): Promise<{
  status: 'unverified' | 'likely_valid' | 'verified' | 'invalid';
  lineType: string | null;
  notes: string;
  normalizedPhone: string;
}> {
  const normalized = normalizePhoneToE164(phone);
  const digits = phone.replace(/\D/g, '');

  // Basic validation
  if (digits.length < 10 || digits.length > 15) {
    return {
      status: 'invalid',
      lineType: null,
      notes: 'Invalid phone number length',
      normalizedPhone: normalized,
    };
  }

  // Twilio Lookup validation (if credentials provided)
  if (twilioAccountSid && twilioAuthToken) {
    try {
      const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
      const response = await fetch(
        `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(normalized)}?Fields=line_type_intelligence`,
        {
          headers: {
            'Authorization': `Basic ${authHeader}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const lineType = data.line_type_intelligence?.type || null;
        
        return {
          status: 'verified',
          lineType,
          notes: `Twilio verified. Line type: ${lineType || 'unknown'}`,
          normalizedPhone: data.phone_number || normalized,
        };
      } else if (response.status === 404) {
        return {
          status: 'invalid',
          lineType: null,
          notes: 'Phone number not found',
          normalizedPhone: normalized,
        };
      }
    } catch (error) {
      console.error('Twilio Lookup error:', error);
      // Fall through to basic validation
    }
  }

  // Without Twilio, mark as likely_valid based on format
  return {
    status: 'likely_valid',
    lineType: null,
    notes: 'Valid format (not verified)',
    normalizedPhone: normalized,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const zerobounceApiKey = Deno.env.get('ZEROBOUNCE_API_KEY');
  const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');

  // Authentication check
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: userError } = await authSupabase.auth.getUser();
  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid authentication' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const userId = user.id;

  // Check if user has admin role
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: hasAdminRole } = await supabase.rpc('has_role', { 
    _user_id: userId, 
    _role: 'admin' 
  });

  if (!hasAdminRole) {
    return new Response(
      JSON.stringify({ error: 'Admin access required' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { lead_id, lead_ids, validate_email = true, validate_phone = true } = body;

    // Support single or batch validation
    const idsToProcess = lead_ids || (lead_id ? [lead_id] : []);

    if (idsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No lead IDs provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Validating ${idsToProcess.length} lead(s)`);

    const results: { lead_id: string; email_result?: unknown; phone_result?: unknown }[] = [];

    for (const leadId of idsToProcess) {
      // Fetch lead
      const { data: lead, error: fetchError } = await supabase
        .from('scraped_leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (fetchError || !lead) {
        results.push({ lead_id: leadId, email_result: { error: 'Lead not found' } });
        continue;
      }

      const updates: Record<string, unknown> = {};

      // Validate email
      if (validate_email && lead.best_email) {
        const emailResult = await validateEmail(lead.best_email, zerobounceApiKey);
        updates.email_validation_status = emailResult.status;
        updates.email_validation_notes = emailResult.notes;

        // Log the validation
        await supabase.from('validation_logs').insert({
          lead_id: leadId,
          validation_type: 'email',
          input_value: lead.best_email,
          result_status: emailResult.status,
          result_details: { notes: emailResult.notes },
          provider: zerobounceApiKey ? 'zerobounce' : 'internal',
        });

        results.push({ lead_id: leadId, email_result: emailResult });
      }

      // Validate phone
      if (validate_phone && lead.best_phone) {
        const phoneResult = await validatePhone(lead.best_phone, twilioAccountSid, twilioAuthToken);
        updates.phone_validation_status = phoneResult.status;
        updates.phone_validation_notes = phoneResult.notes;
        updates.phone_line_type = phoneResult.lineType;
        updates.best_phone = phoneResult.normalizedPhone;

        // Log the validation
        await supabase.from('validation_logs').insert({
          lead_id: leadId,
          validation_type: 'phone',
          input_value: lead.best_phone,
          result_status: phoneResult.status,
          result_details: { 
            line_type: phoneResult.lineType, 
            notes: phoneResult.notes,
            normalized: phoneResult.normalizedPhone,
          },
          provider: twilioAccountSid ? 'twilio' : 'internal',
        });

        const existingResult = results.find(r => r.lead_id === leadId);
        if (existingResult) {
          existingResult.phone_result = phoneResult;
        } else {
          results.push({ lead_id: leadId, phone_result: phoneResult });
        }
      }

      // Update lead with validation results
      if (Object.keys(updates).length > 0) {
        await supabase
          .from('scraped_leads')
          .update(updates)
          .eq('id', leadId);
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in validate-lead:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
