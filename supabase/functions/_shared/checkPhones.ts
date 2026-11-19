import { isFreshPhoneCheck, normalizeUsPhone, parsePhoneVerification, PHONE_CHECK_LIMIT, unknownCheck, type PhoneCheck } from './phoneComplianceModel.ts';

type CacheRow = Omit<PhoneCheck, 'status' | 'suppressed'>;
type CacheTable = {
  select: (columns: '*') => { in: (column: 'phone', values: string[]) => PromiseLike<{ data: CacheRow[] | null; error: unknown }> };
  upsert: (values: CacheRow[]) => PromiseLike<{ error: { code?: string } | null }>;
};
// Narrow at this boundary so the functions can keep their existing client versions.
type CacheClient = { from: (table: 'phone_compliance_checks') => unknown };

type Hint = { number: string; dnc?: boolean; tcpa?: boolean };

export async function checkPhones(admin: CacheClient, inputs: unknown[], positiveHints: Hint[] = [], provider = { key: Deno.env.get('BATCHDATA_API_KEY'), fetch }): Promise<PhoneCheck[]> {
  const numbers = [...new Set(inputs.map(normalizeUsPhone).filter((p): p is string => p !== null))];
  if (!numbers.length) return [];
  const hints = new Map<string, Hint>();
  for (const hint of positiveHints) {
    const phone = normalizeUsPhone(hint.number);
    if (!phone) continue;
    const old = hints.get(phone);
    hints.set(phone, { number: phone, dnc: old?.dnc === true || hint.dnc === true, tcpa: old?.tcpa === true || hint.tcpa === true });
  }
  const out: PhoneCheck[] = [];
  const table = () => admin.from('phone_compliance_checks') as CacheTable;
  for (let i = 0; i < numbers.length; i += PHONE_CHECK_LIMIT) {
    const phones = numbers.slice(i, i + PHONE_CHECK_LIMIT);
    const { data, error } = await table().select('*').in('phone', phones);
    const cache = new Map((data ?? []).map(row => [row.phone, row]));
    const missing = phones.filter(phone => {
      const row = cache.get(phone);
      const hint = hints.get(phone);
      return !row || !isFreshPhoneCheck(row.checked_at) || (hint?.dnc && !row.on_national_dnc) || (hint?.tcpa && !row.tcpa_litigator);
    });
    const verified = new Map<string, PhoneCheck>();
    const { key } = provider;
    if (!error && missing.length && key) {
      try {
        const res = await provider.fetch('https://api.batchdata.com/api/v1/phone/verification', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ requests: missing }),
          signal: AbortSignal.timeout(12000),
        });
        if (res.ok) {
          for (const row of parsePhoneVerification(await res.json(), missing, new Date().toISOString())) verified.set(row.phone, row);
        } else console.error('[dnc-check] BatchData HTTP', res.status);
      } catch {
        console.error('[dnc-check] BatchData phone verification unavailable');
      }
    }

    const writes = [];
    const refresh = new Set(missing);
    for (const phone of phones) {
      const old = cache.get(phone);
      const hint = hints.get(phone);
      const result = verified.get(phone);
      if (!refresh.has(phone) && old) {
        out.push({ ...old, status: old.on_national_dnc === null || old.tcpa_litigator === null ? 'unknown' : 'checked' });
        continue;
      }
      const row = result ?? unknownCheck(phone);
      // An unavailable or partial refresh must never erase a known warning.
      const dnc = hint?.dnc === true || (row.on_national_dnc === null && old?.on_national_dnc === true) ? true : row.on_national_dnc;
      const tcpa = hint?.tcpa === true || (row.tcpa_litigator === null && old?.tcpa_litigator === true) ? true : row.tcpa_litigator;
      const checkedAt = row.checked_at ?? (hint?.dnc === true || hint?.tcpa === true ? new Date().toISOString() : old?.checked_at ?? null);
      out.push({ ...row, on_national_dnc: dnc, tcpa_litigator: tcpa, checked_at: checkedAt });
      if (result || hint?.dnc === true || hint?.tcpa === true) {
        writes.push({ phone, on_national_dnc: dnc, tcpa_litigator: tcpa, line_type: row.line_type, checked_at: checkedAt ?? new Date().toISOString() });
      }
    }
    if (writes.length) {
      const { error: writeError } = await table().upsert(writes);
      if (writeError) console.error('[dnc-check] Phone compliance cache write failed', writeError.code);
    }
  }
  return out;
}