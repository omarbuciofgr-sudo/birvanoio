import { createClient } from 'npm:@supabase/supabase-js@2.119.1';
import { corsHeaders } from 'npm:@supabase/supabase-js@2.119.1/cors';
import { checkPhones } from '../_shared/checkPhones.ts';
import { normalizeUsPhone, PHONE_CHECK_LIMIT, unknownCheck } from '../_shared/phoneComplianceModel.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  const token = req.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return json({ error: 'Sign in to check phone numbers' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ error: 'Phone checks are unavailable' }, 503);
  const admin = createClient(url, key);
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (!user || error) return json({ error: 'Sign in to check phone numbers' }, 401);
  const body = await req.json().catch(() => null);
  const phones: unknown = body?.phones;
  if (!Array.isArray(phones) || phones.length > PHONE_CHECK_LIMIT || phones.some(p => typeof p !== 'string' || p.length > 40)) {
    return json({ error: 'Provide up to 100 phone numbers as strings' }, 400);
  }
  const normalized = [...new Set(phones.map(normalizeUsPhone).filter((p): p is string => p !== null))];
  if (!normalized.length) return json({ results: [] });
  const [checked, suppression] = await Promise.all([
    checkPhones(admin, normalized).catch(() => normalized.map(unknownCheck)),
    admin.from('user_dnc_numbers').select('phone').eq('user_id', user.id).in('phone', normalized),
  ]);
  if (suppression.error) return json({ error: 'Could not check your do-not-call list' }, 503);
  const suppressed = new Set(suppression.data.map(row => row.phone));
  return json({ results: checked.map(row => ({ ...row, suppressed: suppressed.has(row.phone) })) });
});