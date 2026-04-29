/**
 * Tiered validation for Brivano Scout (shared rules).
 * Response `missing` / missingFields use camelCase (UI filter object keys).
 */

/** Posted date “Any time” — must be non-empty sentinel, not "". */
export const POSTED_WITHIN_ANY = 'any';

/** Optional field keys (documentation / UI hints only) */
export const OPTIONAL_FIELD_KEYS = {
  jobDescriptionKeywords: 'jobDescriptionKeywords',
  keyword: 'keyword',
} as const;

export type ScraperSearchType = 'jobs' | 'local' | 'people' | 'companies';

/** Loose shapes — matches JobSearchFilters / PeopleSearchFilters / ProspectSearchFilters field names */
export type JobSearchValidationInput = {
  jobTitles?: string[];
  countries?: string[];
  states?: string[];
  cities?: string[];
  employmentType?: string[];
  postedWithin?: string;
};

export type PeopleSearchValidationInput = {
  jobTitles?: string[];
  countries?: string[];
  states?: string[];
  cities?: string[];
  industries?: string[];
  companySizes?: string[];
  seniority?: string[];
  departments?: string[];
  companies?: string[];
};

export type ProspectSearchValidationInput = {
  industries?: string[];
  keywordsInclude?: string[];
  countries?: string[];
  states?: string[];
  cities?: string[];
  citiesOrStates?: string[];
  companySizes?: string[];
  companyTypes?: string[];
  technologies?: string[];
  marketSegments?: string[];
  limit?: number;
};

export type LocalBusinessValidationInput = {
  locationQuery?: string;
  lat?: number;
  lng?: number;
  radiusMiles?: number;
  searchType?: string;
  keyword?: string;
};

export function isEmptyString(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v !== 'string') return true;
  return v.trim().length === 0;
}

export function isNonEmptyStringArray(v: unknown): boolean {
  if (!Array.isArray(v)) return false;
  return v.some((x) => typeof x === 'string' && x.trim().length > 0);
}

export function isEmptyArray(v: unknown): boolean {
  if (!Array.isArray(v)) return true;
  return v.length === 0;
}

export function jobsGeoSatisfied(f: Pick<JobSearchValidationInput, 'countries' | 'states' | 'cities'>): boolean {
  return isNonEmptyStringArray(f.countries) || isNonEmptyStringArray(f.states) || isNonEmptyStringArray(f.cities);
}

export function peopleGeoSatisfied(f: Pick<PeopleSearchValidationInput, 'countries' | 'states' | 'cities'>): boolean {
  return isNonEmptyStringArray(f.countries) || isNonEmptyStringArray(f.states) || isNonEmptyStringArray(f.cities);
}

export function companiesGeoSatisfied(
  f: Pick<ProspectSearchValidationInput, 'countries' | 'states' | 'cities' | 'citiesOrStates'>,
): boolean {
  return (
    isNonEmptyStringArray(f.countries) ||
    isNonEmptyStringArray(f.states) ||
    isNonEmptyStringArray(f.cities) ||
    isNonEmptyStringArray(f.citiesOrStates)
  );
}

export function localLocationSatisfied(input: LocalBusinessValidationInput): boolean {
  const q = typeof input.locationQuery === 'string' ? input.locationQuery.trim() : '';
  if (q.length > 0) return true;
  const { lat, lng } = input;
  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
    return true;
  }
  return false;
}

export function normalizeCompanyLimit(limit: unknown, fallback = 50): number {
  if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) return limit;
  return fallback;
}

export type ValidationResult = {
  valid: boolean;
  missingFields: string[];
  message: string;
};

const MSG_JOBS =
  'Please complete Job Title, Location, Employment Type, and Posted Date.';
const MSG_LOCAL = 'Please complete Location, Radius, and Search Type.';
const MSG_PEOPLE =
  'Please add Job Title and any two of Location, Industry, Company Size, Seniority, Department, or Company.';
const MSG_COMPANIES =
  'Please add at least three filters such as Industry, Keyword, Location, Size, Type, Technology, or Segment.';

function validateJobs(formData: JobSearchValidationInput): ValidationResult {
  const missing: string[] = [];

  if (!isNonEmptyStringArray(formData.jobTitles)) {
    missing.push('jobTitles');
  }
  if (!jobsGeoSatisfied(formData)) {
    missing.push('countries', 'states', 'cities');
  }
  if (!isNonEmptyStringArray(formData.employmentType)) {
    missing.push('employmentType');
  }
  if (isEmptyString(formData.postedWithin)) {
    missing.push('postedWithin');
  }

  return {
    valid: missing.length === 0,
    missingFields: missing,
    message: MSG_JOBS,
  };
}

function validateLocal(formData: LocalBusinessValidationInput): ValidationResult {
  const missing: string[] = [];
  if (!localLocationSatisfied(formData)) {
    missing.push('locationQuery', 'lat', 'lng');
  }
  const r = formData.radiusMiles;
  if (typeof r !== 'number' || !Number.isFinite(r) || r <= 0) {
    missing.push('radiusMiles');
  }
  if (isEmptyString(formData.searchType)) {
    missing.push('searchType');
  }

  return {
    valid: missing.length === 0,
    missingFields: missing,
    message: MSG_LOCAL,
  };
}

function peopleQualifierCount(f: PeopleSearchValidationInput): number {
  let n = 0;
  if (peopleGeoSatisfied(f)) n++;
  if (isNonEmptyStringArray(f.industries)) n++;
  if (isNonEmptyStringArray(f.companySizes)) n++;
  if (isNonEmptyStringArray(f.seniority)) n++;
  if (isNonEmptyStringArray(f.departments)) n++;
  if (isNonEmptyStringArray(f.companies)) n++;
  return n;
}

function validatePeople(formData: PeopleSearchValidationInput): ValidationResult {
  if (!isNonEmptyStringArray(formData.jobTitles)) {
    return {
      valid: false,
      missingFields: ['jobTitles'],
      message: MSG_PEOPLE,
    };
  }

  const qCount = peopleQualifierCount(formData);
  if (qCount >= 2) {
    return { valid: true, missingFields: [], message: '' };
  }

  const missing: string[] = [];
  if (!peopleGeoSatisfied(formData)) missing.push('countries', 'states', 'cities');
  if (!isNonEmptyStringArray(formData.industries)) missing.push('industries');
  if (!isNonEmptyStringArray(formData.companySizes)) missing.push('companySizes');
  if (!isNonEmptyStringArray(formData.seniority)) missing.push('seniority');
  if (!isNonEmptyStringArray(formData.departments)) missing.push('departments');
  if (!isNonEmptyStringArray(formData.companies)) missing.push('companies');

  return {
    valid: false,
    missingFields: [...new Set(missing)],
    message: MSG_PEOPLE,
  };
}

function companiesDimensionCount(f: ProspectSearchValidationInput): number {
  let n = 0;
  if (isNonEmptyStringArray(f.industries)) n++;
  if (isNonEmptyStringArray(f.keywordsInclude)) n++;
  if (companiesGeoSatisfied(f)) n++;
  if (isNonEmptyStringArray(f.companySizes)) n++;
  if (isNonEmptyStringArray(f.companyTypes)) n++;
  if (isNonEmptyStringArray(f.technologies)) n++;
  if (isNonEmptyStringArray(f.marketSegments)) n++;
  return n;
}

function validateCompanies(formData: ProspectSearchValidationInput): ValidationResult {
  const normalized: ProspectSearchValidationInput = {
    ...formData,
    limit: normalizeCompanyLimit(formData.limit),
  };

  const dim = companiesDimensionCount(normalized);
  if (dim >= 3) {
    return { valid: true, missingFields: [], message: '' };
  }

  const missing: string[] = [];
  if (!isNonEmptyStringArray(normalized.industries)) missing.push('industries');
  if (!isNonEmptyStringArray(normalized.keywordsInclude)) missing.push('keywordsInclude');
  if (!companiesGeoSatisfied(normalized)) {
    missing.push('countries', 'states', 'cities', 'citiesOrStates');
  }
  if (!isNonEmptyStringArray(normalized.companySizes)) missing.push('companySizes');
  if (!isNonEmptyStringArray(normalized.companyTypes)) missing.push('companyTypes');
  if (!isNonEmptyStringArray(normalized.technologies)) missing.push('technologies');
  if (!isNonEmptyStringArray(normalized.marketSegments)) missing.push('marketSegments');

  return {
    valid: false,
    missingFields: [...new Set(missing)],
    message: MSG_COMPANIES,
  };
}

export function validateScraper(type: ScraperSearchType, formData: unknown): ValidationResult {
  switch (type) {
    case 'jobs':
      return validateJobs(formData as JobSearchValidationInput);
    case 'local':
      return validateLocal(formData as LocalBusinessValidationInput);
    case 'people':
      return validatePeople(formData as PeopleSearchValidationInput);
    case 'companies':
      return validateCompanies(formData as ProspectSearchValidationInput);
    default:
      return { valid: false, missingFields: [], message: 'Unknown search type.' };
  }
}
