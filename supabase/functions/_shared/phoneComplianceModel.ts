export const PHONE_CHECK_LIMIT = 100;
export const PHONE_CHECK_TTL = 31 * 24 * 60 * 60 * 1000;

export type PhoneCheck = {
  phone: string;
  on_national_dnc: boolean | null;
  tcpa_litigator: boolean | null;
  line_type: string | null;
  checked_at: string | null;
  status: 'checked' | 'unknown';
  suppressed?: boolean;
};

export function normalizeUsPhone(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[+()\d\s.-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  const normalized = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return normalized.length === 10 ? normalized : null;
}

export function unknownCheck(phone: string): PhoneCheck {
  return { phone, on_national_dnc: null, tcpa_litigator: null, line_type: null, checked_at: null, status: 'unknown' };
}

export function isFreshPhoneCheck(checkedAt: string | null, now = Date.now()) {
  const age = now - Date.parse(checkedAt ?? '');
  return age >= 0 && age < PHONE_CHECK_TTL;
}

export function parsePhoneVerification(body: unknown, requested: string[], checkedAt: string): PhoneCheck[] {
  const payload = body as { status?: { code?: number }; results?: { phoneNumbers?: unknown[] } } | null;
  if (payload?.status?.code != null && payload.status.code !== 200) return [];
  if (!Array.isArray(payload?.results?.phoneNumbers)) return [];
  const allowed = new Set(requested);
  const results = new Map<string, PhoneCheck>();
  for (const value of payload.results.phoneNumbers) {
    if (!value || typeof value !== 'object') continue;
    const row = value as { number?: unknown; dnc?: unknown; tcpa?: unknown; type?: unknown; notFound?: boolean; meta?: { error?: boolean; matched?: boolean } };
    const phone = normalizeUsPhone(row.number);
    if (!phone || !allowed.has(phone) || row.notFound === true || row.meta?.error === true || row.meta?.matched === false) continue;
    const prev = results.get(phone);
    const dnc = prev?.on_national_dnc === true || row.dnc === true ? true : typeof row.dnc === 'boolean' ? row.dnc : prev?.on_national_dnc ?? null;
    const tcpa = prev?.tcpa_litigator === true || row.tcpa === true ? true : typeof row.tcpa === 'boolean' ? row.tcpa : prev?.tcpa_litigator ?? null;
    results.set(phone, { phone, on_national_dnc: dnc, tcpa_litigator: tcpa, line_type: typeof row.type === 'string' ? row.type : prev?.line_type ?? null, checked_at: checkedAt, status: dnc !== null && tcpa !== null ? 'checked' : 'unknown' });
  }
  return [...results.values()];
}

export function phoneExportColumns(value: string | null | undefined, check: PhoneCheck | undefined, excludeDnc: boolean, blocked = false) {
  if (!value) return ['', '', ''];
  const dnc = check?.on_national_dnc === true ? 'Yes' : check?.status === 'checked' && check.on_national_dnc === false ? 'No' : 'Not checked';
  const omit = blocked || check?.suppressed || check?.tcpa_litigator === true || (excludeDnc && dnc !== 'No');
  return [omit ? '' : value, dnc, check?.checked_at?.slice(0, 10) ?? ''];
}