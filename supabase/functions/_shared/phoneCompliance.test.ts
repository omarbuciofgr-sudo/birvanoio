import { expect, test } from 'bun:test';
import { checkPhones } from './checkPhones.ts';
import { isFreshPhoneCheck, normalizeUsPhone, parsePhoneVerification, phoneExportColumns, PHONE_CHECK_LIMIT, unknownCheck } from './phoneComplianceModel.ts';

const number = '2025550101';
const sample = { phone: number, on_national_dnc: false, tcpa_litigator: false, line_type: 'Mobile', checked_at: '2026-11-19T00:00:00Z' };
const verified = { status: { code: 200 }, results: { phoneNumbers: [{ number, dnc: false, tcpa: true, type: 'Mobile', meta: { matched: true, error: false } }] } };

test('normalizes US phones to ten digits only', () => {
  expect(normalizeUsPhone('+1 (202) 555-0101')).toBe(number);
  expect(normalizeUsPhone('+44 20 7946 0958')).toBeNull();
});

test('cached results expire at 31 days', () => {
  const now = Date.parse('2026-11-19T00:00:00Z');
  expect(isFreshPhoneCheck('2026-10-19T00:00:01Z', now)).toBe(true);
  expect(isFreshPhoneCheck('2026-10-19T00:00:00Z', now)).toBe(false);
});

test('parses the documented response and treats missing flags as unknown', () => {
  expect(parsePhoneVerification(verified, [number], sample.checked_at)).toEqual([{ ...sample, tcpa_litigator: true, status: 'checked' }]);
  const rows = parsePhoneVerification({ results: { phoneNumbers: [{ number, type: 'Mobile' }, { number: '2025550102', notFound: true, dnc: false, tcpa: false }] } }, [number, '2025550102'], sample.checked_at);
  expect(rows).toEqual([{ ...sample, on_national_dnc: null, tcpa_litigator: null, status: 'unknown' }]);
});

test('default CSV export omits DNC and unknown numbers without dropping their status', () => {
  expect(phoneExportColumns(number, { ...sample, status: 'checked', on_national_dnc: true }, true)).toEqual(['', 'Yes', '2026-11-19']);
  expect(phoneExportColumns(number, unknownCheck(number), true)).toEqual(['', 'Not checked', '']);
  expect(phoneExportColumns(number, { ...sample, status: 'checked' }, true)).toEqual([number, 'No', '2026-11-19']);
  expect(phoneExportColumns(number, { ...sample, status: 'checked', on_national_dnc: true }, false)[0]).toBe(number);
});

test('CSV never includes a known litigator or a personally suppressed number', () => {
  expect(phoneExportColumns(number, { ...sample, status: 'checked', tcpa_litigator: true }, false)[0]).toBe('');
  expect(phoneExportColumns(number, { ...sample, status: 'checked', suppressed: true }, false)[0]).toBe('');
});

function mockDb(rows: (typeof sample)[] = []) {
  const writes: unknown[] = [];
  return { writes, from: () => ({ select: () => ({ in: async () => ({ data: rows, error: null }) }), upsert: async (values: unknown[]) => { writes.push(...values); return { error: null }; } }) };
}

test('verification sends only cache misses in batches of at most 100', async () => {
  const db = mockDb([{ ...sample, checked_at: new Date().toISOString() }]);
  const requests: string[][] = [];
  const inputs = Array.from({ length: 101 }, (_, i) => `212555${String(i).padStart(4, '0')}`);
  const mockFetch: typeof fetch = Object.assign(async (url: string | URL | Request, config?: RequestInit) => {
    expect(url).toBe('https://api.batchdata.com/api/v1/phone/verification');
    const { requests: batch } = JSON.parse(String(config?.body));
    requests.push(batch);
    return Response.json({ results: { phoneNumbers: batch.map((number: string) => ({ number, dnc: true, tcpa: false })) } });
  }, { preconnect: () => {} });
  const result = await checkPhones(db, [number, ...inputs, inputs[0]], [], { key: 'test', fetch: mockFetch });
  expect(PHONE_CHECK_LIMIT).toBe(100);
  expect(requests.flat()).toEqual(inputs);
  expect(requests.every(batch => batch.length <= 100)).toBe(true);
  expect(db.writes).toHaveLength(101);
  expect(result.find(row => row.phone === number)?.status).toBe('checked');
});

test('provider failure returns unknown and does not turn stale flags into clearance', async () => {
  const db = mockDb([{ ...sample, tcpa_litigator: true, checked_at: '2021-01-01T00:00:00Z' }]);
  const mockFetch: typeof fetch = Object.assign(async () => new Response(null, { status: 503 }), { preconnect: () => {} });
  const result = await checkPhones(db, [number, '2025550102'], [], { key: 'test', fetch: mockFetch });
  expect(result[0]).toMatchObject({ status: 'unknown', on_national_dnc: null, tcpa_litigator: true });
  expect(result[1]).toEqual(unknownCheck('2025550102'));
  expect(db.writes).toHaveLength(0);
});