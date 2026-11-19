import { normalizeUsPhone } from './phoneComplianceModel.ts';

type QueryClient = { from: (table: string) => any };

export async function phoneOutreachBlock(db: QueryClient, userId: string, value: unknown): Promise<string | null> {
  const phone = normalizeUsPhone(value);
  if (!phone) return null;
  const [personal, compliance] = await Promise.all([
    db.from('user_dnc_numbers').select('phone').eq('user_id', userId).eq('phone', phone).maybeSingle(),
    db.from('phone_compliance_checks').select('tcpa_litigator').eq('phone', phone).maybeSingle(),
  ]);
  if (personal.error || compliance.error) return 'Phone compliance could not be checked. Try again.';
  if (personal.data) return 'This number is on your do-not-call list.';
  if (compliance.data?.tcpa_litigator === true) return 'This number is unavailable for outreach.';
  return null;
}