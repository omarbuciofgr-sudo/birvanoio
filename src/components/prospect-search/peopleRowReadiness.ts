import type { CompanyResult } from '@/lib/api/industrySearch';

/** Stable skip / outcome codes for People bulk enrichment (tooltips + summaries). */
export type PeopleSkipReasonCode =
  | 'ALREADY_HAS_DOMAIN'
  | 'MISSING_ORG_NAME'
  | 'MISSING_LINKEDIN'
  | 'INSUFFICIENT_IDENTITY'
  | 'RESOLUTION_FAILED'
  | 'PROVIDER_ERROR'
  | 'MISSING_DOMAIN_AFTER_RESOLUTION'
  | 'NO_INDUSTRY_RETURNED'
  | 'NO_EMAIL_RETURNED'
  | 'NO_PHONE_RETURNED'
  | 'OK';

export const PEOPLE_SKIP_REASON_COPY: Record<PeopleSkipReasonCode, string> = {
  ALREADY_HAS_DOMAIN: 'Row already has a company domain — nothing to resolve.',
  MISSING_ORG_NAME:
    'Employer organization name is missing — domain cannot be resolved from org alone in this flow.',
  MISSING_LINKEDIN:
    'No LinkedIn URL on the row — match quality may be lower when the employer domain is missing.',
  INSUFFICIENT_IDENTITY:
    'Not enough identity signals (need employer name from the Employer column, LinkedIn URL, person name, or domain). If Employer is empty but Description shows "… at {Company}", a map-time heuristic may still fill employer when Apollo omits the org field.',
  RESOLUTION_FAILED: 'Resolver ran but no domain was returned for this employer.',
  PROVIDER_ERROR: 'Enrichment provider returned an error, rate limit, or the backend is not configured.',
  MISSING_DOMAIN_AFTER_RESOLUTION:
    'Still no employer domain after resolution — industry/email/phone steps that require a domain may be skipped (Edge-only mode may require Flask forwarding for org→domain).',
  NO_INDUSTRY_RETURNED: 'Enrichment ran but no industry field was returned to merge.',
  NO_EMAIL_RETURNED: 'Enrichment ran but no work email was returned to merge.',
  NO_PHONE_RETURNED: 'Enrichment ran but no phone numbers were returned to merge.',
  OK: 'OK',
};

export function normalizeDomain(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    return raw.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim().toLowerCase();
  } catch {
    return '';
  }
}

export type PeopleRowSignals = {
  hasDomain: boolean;
  hasOrgName: boolean;
  hasPersonLinkedIn: boolean;
  hasPersonName: boolean;
};

export function derivePeopleRowSignals(row: CompanyResult): PeopleRowSignals {
  const domain = normalizeDomain(row.domain);
  const hasOrgName = !!(row.organization_name || '').trim();
  const hasPersonLinkedIn = !!(row.linkedin_url || '').trim();
  const hasPersonName = !!(row.name || '').trim();
  return {
    hasDomain: !!domain,
    hasOrgName,
    hasPersonLinkedIn,
    hasPersonName,
  };
}

export function hasInsufficientPersonIdentity(s: PeopleRowSignals): boolean {
  return !s.hasDomain && !s.hasOrgName && !s.hasPersonLinkedIn && !s.hasPersonName;
}

/** Resolve-domains: skip reasons before calling the API. */
export function resolveDomainPrecheck(
  row: CompanyResult,
  s: PeopleRowSignals
): PeopleSkipReasonCode | null {
  if (s.hasDomain) return 'ALREADY_HAS_DOMAIN';
  if (!s.hasOrgName) return 'MISSING_ORG_NAME';
  if (hasInsufficientPersonIdentity(s)) return 'INSUFFICIENT_IDENTITY';
  return null;
}

/** Industry / email / phone: minimum identity to call Flask/Edge person waterfall. */
export function waterfallPersonPrecheck(s: PeopleRowSignals): PeopleSkipReasonCode | null {
  if (hasInsufficientPersonIdentity(s)) return 'INSUFFICIENT_IDENTITY';
  return null;
}

export function industryEnrichPrecheck(s: PeopleRowSignals): PeopleSkipReasonCode | null {
  const base = waterfallPersonPrecheck(s);
  if (base) return base;
  // Firmographics from Apollo match can return industry without domain; org name + person still required above.
  return null;
}

/** Email/phone: require domain or LinkedIn or (org + person name) for a realistic Apollo match. */
export function contactEnrichPrecheck(s: PeopleRowSignals): PeopleSkipReasonCode | null {
  const base = waterfallPersonPrecheck(s);
  if (base) return base;
  const strong =
    s.hasDomain ||
    s.hasPersonLinkedIn ||
    (s.hasOrgName && s.hasPersonName);
  if (!strong) return 'MISSING_DOMAIN_AFTER_RESOLUTION';
  return null;
}

export function formatPeopleReasonTooltip(code: PeopleSkipReasonCode, apiMessage?: string): string {
  const base = PEOPLE_SKIP_REASON_COPY[code];
  if (apiMessage && code === 'PROVIDER_ERROR') return `${base}\n${apiMessage}`;
  if (apiMessage && (code === 'RESOLUTION_FAILED' || code === 'MISSING_DOMAIN_AFTER_RESOLUTION')) {
    return `${base}\n${apiMessage}`;
  }
  return base;
}
