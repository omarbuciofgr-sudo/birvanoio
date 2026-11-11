// Single BatchData v1 property skip-trace client shared by all functions.
export interface BatchDataAddress { street: string; city?: string; state?: string; zip?: string }
export interface BatchDataPhone { number: string; type: string; lineType?: string; dnc?: boolean }
export interface BatchDataEmail { address: string; type?: string }
export interface BatchDataResult {
  fullName: string | null; firstName: string | null; lastName: string | null;
  phones: BatchDataPhone[]; emails: BatchDataEmail[]; matched: boolean;
  httpStatus: number; rawSummary: string; ok: boolean; error?: string;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);

export function nameParts(person: any): { full: string | null; first: string | null; last: string | null } {
  const n = person?.name;
  const alt = Array.isArray(person?.names) ? person.names[0] : null;
  const first = str(n?.first) ?? str(n?.firstName) ?? str(alt?.firstName) ?? str(alt?.first) ?? str(person?.firstName);
  const last = str(n?.last) ?? str(n?.lastName) ?? str(alt?.lastName) ?? str(alt?.last) ?? str(person?.lastName);
  const joined = [first, last].filter(Boolean).join(' ') || null;
  const full = str(n?.full) ?? str(n) ?? str(alt?.fullName) ?? str(alt?.full) ?? str(person?.fullName) ?? joined;
  return { full, first, last };
}

function findPersons(data: any): any[] {
  const r = data?.results;
  const candidates = [r?.persons, Array.isArray(r) ? r[0]?.persons : null, r?.success?.[0]?.persons,
    Array.isArray(r?.success) && !r.success[0]?.persons ? r.success : null, Array.isArray(r) && !r[0]?.persons ? r : null];
  for (const c of candidates) if (Array.isArray(c) && c.length) return c;
  return [];
}

export function parseBatchDataBody(data: any): Omit<BatchDataResult, 'httpStatus' | 'rawSummary' | 'ok'> {
  const persons = findPersons(data);
  const phones: BatchDataPhone[] = []; const emails: BatchDataEmail[] = [];
  let name = { full: null as string | null, first: null as string | null, last: null as string | null };
  let matched = false;
  for (const p of persons) {
    if (p?.meta?.matched === true) matched = true;
    const n = nameParts(p); if (!name.full && n.full) name = n;
    for (const ph of [...(p?.phoneNumbers || []), ...(p?.phones || [])]) {
      const number = typeof ph === 'string' ? ph : str(ph?.number) ?? str(ph?.phoneNumber);
      if (!number || number.replace(/\D/g, '').length < 7) continue;
      if (ph?.dnc === true) continue; // only skip when explicitly flagged
      if (!phones.some(x => x.number === number)) phones.push({ number, type: str(ph?.type) ?? str(ph?.phoneType) ?? 'unknown', lineType: str(ph?.carrierType) ?? undefined });
    }
    for (const e of [...(p?.emails || []), ...(p?.emailAddresses || [])]) {
      const address = typeof e === 'string' ? e : str(e?.email) ?? str(e?.emailAddress) ?? str(e?.address);
      if (address && address.includes('@') && !emails.some(x => x.address === address)) emails.push({ address, type: str(e?.type) ?? undefined });
    }
  }
  return { fullName: name.full, firstName: name.first, lastName: name.last, phones, emails, matched: matched || phones.length > 0 || emails.length > 0 };
}

export async function batchDataSkipTrace(address: BatchDataAddress, apiKey = Deno.env.get('BATCHDATA_API_KEY')): Promise<BatchDataResult> {
  const empty = { fullName: null, firstName: null, lastName: null, phones: [], emails: [], matched: false };
  if (!apiKey) return { ...empty, ok: false, httpStatus: 0, rawSummary: '', error: 'BATCHDATA_API_KEY not configured' };
  try {
    const res = await fetch('https://api.batchdata.com/api/v1/property/skip-trace', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ requests: [{ propertyAddress: { street: address.street || '', city: address.city || '', state: address.state || '', zip: address.zip || '' } }] }),
    });
    const text = await res.text();
    const rawSummary = text.slice(0, 4000);
    console.log('[BatchData] status', res.status, 'body', text.slice(0, 1000));
    if (!res.ok) return { ...empty, ok: false, httpStatus: res.status, rawSummary, error: `BatchData API error: ${res.status}` };
    let data: unknown = null;
    try { data = JSON.parse(text); } catch { return { ...empty, ok: false, httpStatus: res.status, rawSummary, error: 'Invalid BatchData response' }; }
    return { ...parseBatchDataBody(data), ok: true, httpStatus: res.status, rawSummary };
  } catch (e) {
    return { ...empty, ok: false, httpStatus: 0, rawSummary: String(e).slice(0, 4000), error: e instanceof Error ? e.message : 'BatchData request failed' };
  }
}
