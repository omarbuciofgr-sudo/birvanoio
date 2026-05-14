/**
 * Mirrors `src/config/scraperValidation.ts` for Deno Edge Functions (no Vite path aliases).
 * HTTP error bodies use camelCase for `missing` keys (see caller comments).
 */

export const POSTED_WITHIN_ANY = 'any';

export type ScraperSearchType = 'jobs' | 'local' | 'people' | 'companies';

export type ValidationResult = {
  valid: boolean;
  missingFields: string[];
  message: string;
};

function isEmptyString(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v !== 'string') return true;
  return v.trim().length === 0;
}

function isNonEmptyStringArray(v: unknown): boolean {
  if (!Array.isArray(v)) return false;
  return v.some((x) => typeof x === 'string' && x.trim().length > 0);
}

function jobsGeoFromJobBody(body: Record<string, unknown>): boolean {
  const countries = body.countries as string[] | undefined;
  const states = body.states as string[] | undefined;
  const cities = body.cities as string[] | undefined;
  const locations = body.locations as string[] | undefined;
  if (isNonEmptyStringArray(locations)) return true;
  return isNonEmptyStringArray(countries) || isNonEmptyStringArray(states) || isNonEmptyStringArray(cities);
}

const MSG_JOBS =
  'Please complete Job Title, Location, Employment Type, and Posted Date.';
const MSG_LOCAL = 'Please complete Location, Radius, and Search Type.';
const MSG_PEOPLE =
  'Please add Job Title and any two of Location, Industry, Company Size, Seniority, Department, or Company.';
const MSG_COMPANIES =
  'Please add at least three filters such as Industry, Keyword, Location, Size, Type, Technology, or Segment.';

/** Supabase `job-search` JSON body (snake_case). */
export function validateJobSearchRequest(body: Record<string, unknown>): ValidationResult {
  const missing: string[] = [];
  if (!isNonEmptyStringArray(body.job_titles)) missing.push('jobTitles');
  if (!jobsGeoFromJobBody(body)) missing.push('countries', 'states', 'cities');
  if (!isNonEmptyStringArray(body.employment_types)) missing.push('employmentType');
  if (isEmptyString(body.posted_within)) missing.push('postedWithin');

  return {
    valid: missing.length === 0,
    missingFields: missing,
    message: MSG_JOBS,
  };
}

/** Supabase `people-search` JSON body (snake_case). */
export function validatePeopleSearchRequest(body: Record<string, unknown>): ValidationResult {
  if (!isNonEmptyStringArray(body.person_titles)) {
    return { valid: false, missingFields: ['jobTitles'], message: MSG_PEOPLE };
  }

  let q = 0;
  if (isNonEmptyStringArray(body.person_locations)) q++;
  if (isNonEmptyStringArray(body.organization_industry_tag_ids)) q++;
  if (isNonEmptyStringArray(body.organization_num_employees_ranges)) q++;
  if (isNonEmptyStringArray(body.person_seniorities)) q++;
  if (isNonEmptyStringArray(body.person_departments)) q++;
  const orgName = typeof body.q_organization_name === 'string' ? body.q_organization_name.trim() : '';
  if (orgName.length > 0) q++;

  if (q >= 2) return { valid: true, missingFields: [], message: '' };

  const missing: string[] = [];
  if (!isNonEmptyStringArray(body.person_locations)) missing.push('personLocations');
  if (!isNonEmptyStringArray(body.organization_industry_tag_ids)) missing.push('organizationIndustryTagIds');
  if (!isNonEmptyStringArray(body.organization_num_employees_ranges)) missing.push('organizationNumEmployeesRanges');
  if (!isNonEmptyStringArray(body.person_seniorities)) missing.push('personSeniorities');
  if (!isNonEmptyStringArray(body.person_departments)) missing.push('personDepartments');
  if (!orgName) missing.push('qOrganizationName');

  return {
    valid: false,
    missingFields: [...new Set(missing)],
    message: MSG_PEOPLE,
  };
}

/** Supabase `industry-search` / company search JSON body (snake_case). */
export function validateCompanySearchRequest(body: Record<string, unknown>): ValidationResult {
  const industry = typeof body.industry === 'string' ? body.industry.trim() : '';
  const keywords = typeof body.keywords === 'string' ? body.keywords.trim() : '';
  const location = typeof body.location === 'string' ? body.location.trim() : '';

  let dim = 0;
  if (industry.length > 0) dim++;
  if (keywords.length > 0) dim++;
  if (location.length > 0) dim++;
  if (isNonEmptyStringArray(body.employee_ranges)) dim++;
  if (isNonEmptyStringArray(body.company_types)) dim++;
  if (isNonEmptyStringArray(body.technologies)) dim++;
  if (isNonEmptyStringArray(body.market_segments)) dim++;

  if (dim >= 3) return { valid: true, missingFields: [], message: '' };

  const missing: string[] = [];
  if (!industry) missing.push('industry');
  if (!keywords) missing.push('keywords');
  if (!location) missing.push('location');
  if (!isNonEmptyStringArray(body.employee_ranges)) missing.push('employee_ranges');
  if (!isNonEmptyStringArray(body.company_types)) missing.push('company_types');
  if (!isNonEmptyStringArray(body.technologies)) missing.push('technologies');
  if (!isNonEmptyStringArray(body.market_segments)) missing.push('market_segments');

  return {
    valid: false,
    missingFields: [...new Set(missing)],
    message: MSG_COMPANIES,
  };
}

/** google-places-search action=search body */
export function validateGooglePlacesSearchRequest(body: Record<string, unknown>): ValidationResult {
  const missing: string[] = [];
  const q = typeof body.query === 'string' ? body.query.trim() : '';
  const loc = body.location as { lat?: number; lng?: number } | undefined;
  const latOk = typeof loc?.lat === 'number' && Number.isFinite(loc.lat);
  const lngOk = typeof loc?.lng === 'number' && Number.isFinite(loc.lng);
  if (q.length === 0 && !(latOk && lngOk)) {
    missing.push('query', 'location');
  }
  const radius = body.radius;
  if (typeof radius !== 'number' || !Number.isFinite(radius) || radius <= 0) {
    missing.push('radius');
  }
  if (isEmptyString(body.type)) {
    missing.push('type');
  }

  return {
    valid: missing.length === 0,
    missingFields: missing,
    message: MSG_LOCAL,
  };
}
