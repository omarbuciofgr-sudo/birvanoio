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

function isNonEmptyStringArray(v: unknown): boolean {
  if (!Array.isArray(v)) return false;
  return v.some((x) => typeof x === 'string' && x.trim().length > 0);
}

const MSG_PEOPLE =
  'Please add Job Title and any two of Location, Industry, Company Size, Seniority, Department, or Company.';
const MSG_COMPANIES =
  'Please add at least three filters such as Industry, Keyword, Location, Size, Type, Technology, or Segment.';

/** Supabase `job-search` JSON body (snake_case). */
export function validateJobSearchRequest(_body: Record<string, unknown>): ValidationResult {
  return { valid: true, missingFields: [], message: '' };
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
export function validateGooglePlacesSearchRequest(_body: Record<string, unknown>): ValidationResult {
  return { valid: true, missingFields: [], message: '' };
}
