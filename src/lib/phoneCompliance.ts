import { supabase } from '@/integrations/supabase/client';
import { normalizeUsPhone, PHONE_CHECK_LIMIT, unknownCheck, type PhoneCheck } from '../../supabase/functions/_shared/phoneComplianceModel';

export { normalizeUsPhone, phoneExportColumns, type PhoneCheck } from '../../supabase/functions/_shared/phoneComplianceModel';

export const DNC_HELP = "Brivano flags numbers on the National Do Not Call Registry and known TCPA litigators to help you avoid risky calls. You're still responsible for your own compliance, including registering for your own free access at telemarketing.donotcall.gov (your first 5 area codes are free) and checking your state's DNC list.";

export function collectPhones(...values: unknown[]): string[] {
  const phones = new Map<string, string>();
  for (const value of values.flat()) {
    const number = typeof value === 'object' && value && 'number' in value ? value.number : value;
    if (typeof number !== 'string' || !number.trim()) continue;
    const key = normalizeUsPhone(number) ?? number;
    if (!phones.has(key)) phones.set(key, number);
  }
  return [...phones.values()];
}

export async function fetchPhoneChecks(phones: unknown[]): Promise<Record<string, PhoneCheck>> {
  const normalized = [...new Set(phones.map(normalizeUsPhone).filter((p): p is string => p !== null))];
  const checks: Record<string, PhoneCheck> = {};
  for (let i = 0; i < normalized.length; i += PHONE_CHECK_LIMIT) {
    const group = normalized.slice(i, i + PHONE_CHECK_LIMIT);
    const result = await supabase.functions.invoke<{ results: PhoneCheck[] }>('dnc-check', { body: { phones: group } }).catch(() => null);
    if (!result || result.error || !Array.isArray(result.data?.results)) {
      // Fall back to cached warnings and the user's own suppression list, not cached clearance.
      const [cached, personal] = await Promise.all([
        supabase.from('phone_compliance_checks').select('phone, on_national_dnc, tcpa_litigator, line_type, checked_at').in('phone', group),
        supabase.from('user_dnc_numbers').select('phone').in('phone', group),
      ]);
      if (personal.error || cached.error) throw new Error('Phone checks unavailable');
      const suppressed = new Set(personal.data.map(row => row.phone));
      for (const phone of group) {
        const prior = cached.data.find(row => row.phone === phone);
        checks[phone] = { ...unknownCheck(phone), on_national_dnc: prior?.on_national_dnc === true ? true : null, tcpa_litigator: prior?.tcpa_litigator === true ? true : null, checked_at: prior?.checked_at ?? null, suppressed: suppressed.has(phone) };
      }
    } else {
      for (const row of result.data.results) checks[row.phone] = row;
    }
  }
  return checks;
}