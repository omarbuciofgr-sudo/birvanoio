/** Shared People Search request shaping (Flask + Edge). */

import { COUNTRIES } from '@/components/prospect-search/constants';

/**
 * Build Apollo `person_locations` array from country codes, states, and cities.
 * Country codes are mapped to readable labels (e.g. "US" -> "United States").
 */
export function buildPersonLocationsForApollo(
  countries: string[] = [],
  states: string[] = [],
  cities: string[] = [],
): string[] {
  const countryLabels = (countries || []).map((code) => {
    const found = COUNTRIES.find((c) => c.value === code);
    return found ? found.label : code;
  });
  return [...(cities || []), ...(states || []), ...countryLabels]
    .map((v) => (v || '').trim())
    .filter(Boolean);
}


export type PeopleSearchRequestBody = {
  person_titles?: string[];
  person_seniorities?: string[];
  person_departments?: string[];
  person_locations?: string[];
  organization_industry_tag_ids?: string[];
  organization_num_employees_ranges?: string[];
  q_organization_name?: string;
  profile_keywords?: string[];
  email_status?: string;
  technologies?: string[];
  revenue_range?: string;
  funding_range?: string;
  funding_stage?: string;
  market_segments?: string[];
  buying_intent?: string;
  sic_codes?: string[];
  naics_codes?: string[];
  job_posting_filter?: string;
  job_categories?: string[];
  exclude_person_names?: string[];
  person_past_titles?: string[];
  past_companies?: string[];
  years_experience_min?: number;
  years_experience_max?: number;
  limit?: number;
};

const RESTRICTIVE_KEYS: (keyof PeopleSearchRequestBody)[] = [
  'past_companies',
  'person_past_titles',
  'exclude_person_names',
  'profile_keywords',
  'technologies',
];

export function peopleSearchHasRestrictiveFilters(body: PeopleSearchRequestBody): boolean {
  return RESTRICTIVE_KEYS.some((key) => {
    const v = body[key];
    if (Array.isArray(v)) return v.length > 0;
    return false;
  });
}

/** Drop filters that often zero out Apollo mixed_people search. */
export function relaxPeopleSearchBody(body: PeopleSearchRequestBody): PeopleSearchRequestBody {
  const next = { ...body };
  for (const key of RESTRICTIVE_KEYS) {
    delete next[key];
  }
  return next;
}

export function formatPeopleSearchEmptyError(
  apiError: string | undefined,
  hadRestrictiveFilters: boolean,
  providers?: string[],
): string {
  if (apiError?.trim()) {
    return apiError
      .trim()
      .replace(/\s*Confirm Apollo with GET \/api\/apollo-test\.?\s*/i, '')
      .trim();
  }

  const hints: string[] = [];
  if (hadRestrictiveFilters) {
    hints.push(
      'No matches with past company, past title, exclude names, profile keywords, or technologies.',
      'We can retry without those filters — run search again, or clear them in Advanced filters.',
    );
  } else {
    hints.push(
      'No people matched. Try broader job titles, add a location (e.g. United States), or a company name.',
    );
  }
  if (providers?.length) {
    hints.push(`Data sources checked: ${providers.join(', ')}.`);
  }
  return hints.join(' ');
}
