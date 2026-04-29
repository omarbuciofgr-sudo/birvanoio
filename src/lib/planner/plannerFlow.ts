import {
  COMPANY_SIZES,
  COUNTRIES,
  INDUSTRIES,
  JOB_CATEGORIES,
  REVENUE_RANGES,
  FUNDING_RANGES,
  US_STATES,
} from '@/components/prospect-search/constants';
import type { JobSearchFilters } from '@/components/prospect-search/JobFilters';
import type { PeopleSearchFilters } from '@/components/prospect-search/PeopleFilters';
import { PLANNER_CONTEXT } from '@/lib/planner/catalog';
import {
  isNonEmptyStringArray,
  validateScraper,
  type ScraperSearchType,
  type ValidationResult,
} from '@/config/scraperValidation';
import {
  getPlannerField,
  getPlannerSchema,
  PLANNER_OPENERS,
  PLANNER_COMPANIES_DIMENSION_KEYS,
  PLANNER_COMPANIES_OPTIONAL_KEYS,
  PLANNER_JOBS_OPTIONAL_KEYS,
  PLANNER_JOBS_REQUIRED_KEYS,
  PLANNER_LOCAL_OPTIONAL_KEYS,
  PLANNER_LOCAL_REQUIRED_KEYS,
  PLANNER_PEOPLE_OPTIONAL_KEYS,
  PLANNER_PEOPLE_QUALIFIER_KEYS,
  PLANNER_REAL_ESTATE_OPTIONAL_KEYS,
  PLANNER_REAL_ESTATE_REQUIRED_KEYS,
  type PlannerFieldConfig,
} from '@/lib/planner/plannerSchemas';
import type { PlannerUiPayload } from '@/lib/planner/plannerUi';

const MAX_CHIPS = 5;

export type PlannerFlowPhase =
  | 'welcome'
  | 'collecting_required'
  | 'optional_prompt'
  | 'collecting_optional'
  | 'review'
  | 'running';

/** Host-owned planner state — phases driven by `validateScraper` + `buildApplyPayloadFromAnswers`. */
export interface PlannerHostState {
  phase: PlannerFlowPhase;
  /** Catalog id: find_jobs, find_people, … */
  selectedType: string | null;
  answers: Record<string, unknown>;
  currentQuestionKey: string | null;
  missingFields: string[];
  completedRequiredCount: number;
  /** Fields successfully committed in order (for Back). */
  committedKeys: string[];
  optionalStepIndex: number;
}

export function createInitialPlannerHostState(): PlannerHostState {
  return {
    phase: 'welcome',
    selectedType: null,
    answers: {},
    currentQuestionKey: null,
    missingFields: [],
    completedRequiredCount: 0,
    committedKeys: [],
    optionalStepIndex: 0,
  };
}

function firstQuestionKey(filterId: string): string | null {
  switch (filterId) {
    case 'find_jobs':
      return PLANNER_JOBS_REQUIRED_KEYS[0];
    case 'local_businesses':
      return PLANNER_LOCAL_REQUIRED_KEYS[0];
    case 'find_people':
      return 'job_titles';
    case 'find_companies':
      return PLANNER_COMPANIES_DIMENSION_KEYS[0];
    case 'real_estate':
      return PLANNER_REAL_ESTATE_REQUIRED_KEYS[0];
    default:
      return null;
  }
}

export function startPlannerFlow(filterId: string): PlannerHostState {
  const schema = getPlannerSchema(filterId);
  if (!schema.length) {
    return createInitialPlannerHostState();
  }
  const first = firstQuestionKey(filterId);
  if (!first) return createInitialPlannerHostState();
  return {
    phase: 'collecting_required',
    selectedType: filterId,
    answers: {},
    currentQuestionKey: first,
    missingFields: [],
    completedRequiredCount: 0,
    committedKeys: [],
    optionalStepIndex: 0,
  };
}

export function getPendingFields(state: PlannerHostState): string[] {
  return state.missingFields;
}

/** @deprecated use getPendingFields */
export const getPendingFieldIds = getPendingFields;

export function isReviewMode(state: PlannerHostState): boolean {
  return state.phase === 'review';
}

export function getCurrentFieldId(state: PlannerHostState): string | null {
  if (state.phase !== 'collecting_required' && state.phase !== 'collecting_optional') return null;
  return state.currentQuestionKey;
}

export { getPlannerField };

export function looksLikeOffTopicAnswer(text: string): boolean {
  const t = text.trim();
  if (t.length < 12) return false;
  return (
    /^(what|why|how|who|when|where|explain|tell me|describe|write|can you)\b/i.test(t) &&
    /\?[\s]*$/.test(t)
  );
}

function listingIntentChipToEnum(chip: string): string | null {
  const c = chip.trim().toLowerCase();
  if (c.includes('sale') && c.includes('fsbo')) return 'fsbo_sale';
  if (c.includes('rent')) return 'for_rent_by_owner';
  if (c === 'either') return 'either';
  if (chip === 'FSBO sale') return 'fsbo_sale';
  if (chip === 'For rent by owner') return 'for_rent_by_owner';
  if (chip === 'Either') return 'either';
  return null;
}

function splitToArray(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.toLowerCase() !== 'skip');
}

function toStringArray(v: unknown): string[] {
  if (v === undefined || v === null) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') return splitToArray(v);
  return [];
}

function mapIndustryLabels(labels: string[]): string[] {
  return labels.map((label) => {
    const t = label.trim();
    const hit = INDUSTRIES.find(
      (i) =>
        i.label.toLowerCase() === t.toLowerCase() ||
        i.value.replace(/_/g, ' ').toLowerCase() === t.toLowerCase(),
    );
    return hit?.value ?? t.toLowerCase().replace(/\s+/g, '_');
  });
}

function mapCompanySizeLabels(labels: string[]): string[] {
  return labels.map((label) => {
    const t = label.trim();
    const hit = COMPANY_SIZES.find((c) => c.label.replace(/\s+/g, ' ').toLowerCase() === t.toLowerCase() || c.value === t);
    return hit?.value ?? t;
  });
}

function mapCountryLabel(label: string): string | null {
  const t = label.trim();
  const hit = COUNTRIES.find((c) => c.label.toLowerCase() === t.toLowerCase());
  return hit?.value ?? null;
}

function mapJobEmploymentLabel(chip: string): string | null {
  const m: Record<string, string> = {
    'full-time': 'full_time',
    'part-time': 'part_time',
    contract: 'contract',
    internship: 'internship',
    temporary: 'temporary',
    freelance: 'freelance',
  };
  const k = chip.trim().toLowerCase();
  if (m[k]) return m[k];
  if (k.includes('full')) return 'full_time';
  if (k.includes('part')) return 'part_time';
  return null;
}

function mapJobSeniorityLabel(chip: string): string | null {
  const k = chip.trim().toLowerCase();
  if (k.includes('entry')) return 'entry';
  if (k.includes('mid')) return 'mid';
  if (k.includes('senior') && !k.includes('director')) return 'mid';
  if (k.includes('manager')) return 'director';
  if (k.includes('director')) return 'director';
  if (k.includes('executive') || k.includes('vp')) return 'executive';
  return null;
}

function mapPostedWithinLabel(chip: string): string {
  const k = chip.trim().toLowerCase();
  if (k.includes('24 hour') || k.includes('24 hours')) return '24h';
  if (k.includes('7 day')) return '7d';
  if (k.includes('14 day')) return '30d';
  if (k.includes('30 day')) return '30d';
  if (k.includes('any')) return 'any';
  return '';
}

function mapTechLabels(labels: string[]): string[] {
  return labels.map((label) => {
    const t = label.trim().toLowerCase();
    const fromConstants = [
      { slug: 'salesforce', label: 'salesforce' },
      { slug: 'hubspot', label: 'hubspot' },
      { slug: 'wordpress', label: 'wordpress' },
      { slug: 'shopify', label: 'shopify' },
      { slug: 'react', label: 'react' },
    ];
    const hit = fromConstants.find((x) => t.includes(x.label));
    return hit?.slug ?? t.replace(/\s+/g, '_');
  });
}

function mapMarketSegmentLabels(labels: string[]): string[] {
  return labels.map((l) => {
    const k = l.trim().toLowerCase();
    if (k === 'enterprise') return 'enterprise';
    if (k === 'smb') return 'smb';
    if (k.includes('mid')) return 'mid_market';
    if (k.includes('b2c')) return 'consumer';
    if (k.includes('b2b')) return 'enterprise';
    return 'enterprise';
  });
}

function mapDepartmentChip(chip: string): string | null {
  const k = chip.trim().toLowerCase();
  const hit = JOB_CATEGORIES.find(
    (j) => j.label.toLowerCase() === k || j.value === k || k.includes(j.label.toLowerCase()),
  );
  if (hit) return hit.value;
  if (k === 'hr' || k.includes('human resources')) return 'hr';
  if (k.includes('customer support') || k.includes('support')) return 'customer_success';
  if (k.includes('engineering')) return 'engineering';
  return null;
}

function mapPeopleSeniorityChip(chip: string): string | null {
  const k = chip.trim().toLowerCase();
  const pairs: [string, string][] = [
    ['owner', 'founder'],
    ['founder', 'founder'],
    ['manager', 'manager'],
    ['director', 'director'],
    ['vp', 'vp'],
    ['ceo', 'c_level'],
  ];
  for (const [needle, val] of pairs) {
    if (k.includes(needle)) return val;
  }
  return null;
}

function mapEducationFromPlanner(raw: unknown): string[] {
  const parts = Array.isArray(raw) ? raw.map(String) : splitToArray(String(raw ?? ''));
  const out: string[] = [];
  for (const chip of parts) {
    const k = chip.trim().toLowerCase();
    if (k === 'any' || k === '') continue;
    const map: Record<string, string> = {
      bachelor: 'bachelor',
      master: 'master',
      mba: 'mba',
      phd: 'doctorate',
    };
    const normalized = k.replace(/['']/g, '');
    out.push(map[normalized] ?? 'bachelor');
  }
  return out;
}

function mapBuyingIntentChip(chip: string): string {
  const k = chip.trim().toLowerCase();
  if (k.includes('high')) return 'high';
  if (k.includes('medium')) return 'medium';
  if (k.includes('low')) return 'low';
  return '';
}

function mapJobPostingFromChip(chip: string): string {
  const k = chip.trim().toLowerCase();
  if (k.includes('not') && k.includes('hir')) return 'no_job_postings';
  if (k.includes('hir')) return 'has_job_postings';
  return '';
}

function mapFundingStageChip(chip: string): string {
  const k = chip.trim().toLowerCase();
  if (k.includes('bootstr')) return 'seed';
  if (k.includes('seed')) return 'seed';
  if (k.includes('series a')) return 'series_a';
  if (k.includes('series b')) return 'series_b';
  if (k.includes('series c')) return 'series_c';
  return '';
}

function nearestRevenueValue(chip: string): string {
  const hit = REVENUE_RANGES.find((r) => chip.includes(r.label.replace(/\s/g, '')) || chip.includes(r.value));
  if (hit) return hit.value;
  const k = chip.trim().toLowerCase();
  if (k.includes('<') && k.includes('1m')) return '0-1M';
  if (k.includes('1m') && k.includes('10m')) return '5M-10M';
  if (k.includes('10m') && k.includes('50m')) return '10M-50M';
  if (k.includes('50m') && k.includes('100m')) return '50M-100M';
  if (k.includes('100m')) return '100M-500M';
  return '';
}

function nearestFundingRaisedValue(chip: string): string {
  const hit = FUNDING_RANGES.find((r) => chip.includes(r.label.replace(/\s/g, '')) || chip.includes(r.value));
  if (hit) return hit.value;
  return nearestRevenueValue(chip);
}

function mapCompanyTypeChips(labels: string[]): string[] {
  return labels.map((label) => {
    const k = label.trim().toLowerCase();
    if (k.includes('nonprofit')) return 'nonprofit';
    if (k.includes('startup') || k.includes('smb')) return 'privately_held';
    if (k.includes('enterprise')) return 'public';
    if (k.includes('agency')) return 'partnership';
    return 'privately_held';
  });
}

function parseLimit(v: unknown, fallback: number): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const s = String(v ?? '').trim();
  const n = parseInt(s.replace(/\D/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseLocalRadius(v: unknown): number {
  const s = String(v ?? '').trim();
  const n = parseFloat(s.replace(/[^\d.]/g, ''));
  if (Number.isFinite(n) && n > 0) return Math.min(n, 50);
  return 5;
}

const LOCAL_SEARCH_TYPE_BY_LABEL: Record<string, string> = {
  restaurants: 'restaurant',
  healthcare: 'doctor',
  'legal services': 'lawyer',
  'real estate agents': 'real_estate_agent',
  cafes: 'cafe',
};

function mapLocalSearchTypeLabel(label: string): string {
  const k = label.trim().toLowerCase();
  if (LOCAL_SEARCH_TYPE_BY_LABEL[k]) return LOCAL_SEARCH_TYPE_BY_LABEL[k];
  const hit = Object.entries(LOCAL_SEARCH_TYPE_BY_LABEL).find(([a]) => k.includes(a) || a.includes(k));
  return hit ? hit[1] : 'restaurant';
}

function bucketJobLocations(parts: string[]): { countries: string[]; states: string[]; cities: string[]; extraKeywords: string[] } {
  const countries: string[] = [];
  const states: string[] = [];
  const cities: string[] = [];
  const extraKeywords: string[] = [];
  for (const raw of parts) {
    const p = raw.trim();
    if (!p) continue;
    if (/^remote$/i.test(p)) {
      extraKeywords.push('remote');
      continue;
    }
    const ccode = mapCountryLabel(p);
    if (ccode) {
      countries.push(ccode);
      continue;
    }
    const st = US_STATES.find((s) => s.toLowerCase() === p.toLowerCase());
    if (st) {
      states.push(st);
      continue;
    }
    cities.push(p);
  }
  return { countries, states, cities, extraKeywords };
}

/**
 * Normalize raw user/chip input into a value for answers[fieldKey].
 */
export function normalizeAnswerForField(
  filterId: string,
  fieldKey: string,
  raw: string,
  field: PlannerFieldConfig | undefined,
): unknown {
  const t = raw.trim();
  if (field?.type === 'string[]') {
    return splitToArray(t);
  }
  if (field?.type === 'number') {
    return parseLimit(t, fieldKey === 'limit' ? 50 : 0);
  }
  if (filterId === 'real_estate' && fieldKey === 'listingIntent') {
    return listingIntentChipToEnum(t) ?? t;
  }
  return t;
}

export function validateRequiredAnswer(field: PlannerFieldConfig | undefined, value: unknown): boolean {
  if (!field?.required) return true;
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/** During `collecting_required`, every step must yield data until `validateScraper` passes (schema `required` flags are not authoritative). */
export function validatePlannerAnswerForPhase(
  phase: PlannerFlowPhase,
  field: PlannerFieldConfig | undefined,
  value: unknown,
): boolean {
  const required = phase === 'collecting_required' || field?.required === true;
  if (!required) return true;
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/** Maps collected answers → external filters + tab (matches existing apply behavior). */
export function buildApplyPayloadFromAnswers(
  filterId: string,
  answers: Record<string, unknown>,
): {
  suggestedTab: string;
  filters: Record<string, unknown> & {
    plannerSearchType?: string;
    peopleFiltersPatch?: Partial<PeopleSearchFilters>;
    jobFiltersPatch?: Partial<JobSearchFilters>;
    localBusinessPatch?: {
      locationQuery: string;
      radiusMiles: number;
      searchType: string;
      keyword: string;
    };
  };
} {
  switch (filterId) {
    case 'find_companies': {
      const industries = mapIndustryLabels(toStringArray(answers.industries));
      const locParts = toStringArray(answers.locations);
      const geo = locParts.length ? bucketJobLocations(locParts) : { countries: [] as string[], states: [] as string[], cities: [] as string[], extraKeywords: [] as string[] };
      const patch: Record<string, unknown> = {
        plannerSearchType: 'companies',
        industries,
        companySizes: mapCompanySizeLabels(toStringArray(answers.company_sizes)),
        companyTypes: mapCompanyTypeChips(toStringArray(answers.company_types)),
        keywordsInclude: toStringArray(answers.industry_keywords),
        fundingRaised: nearestFundingRaisedValue(String(answers.funding_raised ?? '')),
        fundingStage: mapFundingStageChip(String(answers.funding_stage ?? '')),
        countries: geo.countries,
        states: geo.states,
        cities: [...geo.cities, ...geo.extraKeywords],
        technologies: mapTechLabels(toStringArray(answers.technologies)),
        sicCodes: [],
        naicsCodes: [],
        buyingIntent: mapBuyingIntentChip(String(answers.buying_intent ?? '')),
        marketSegments: mapMarketSegmentLabels(toStringArray(answers.market_segments)),
        jobPostingFilter: mapJobPostingFromChip(String(answers.hiring_status ?? '')),
        jobCategories: toStringArray(answers.hiring_departments)
          .map((d) => mapDepartmentChip(d))
          .filter((x): x is string => !!x),
        industriesToExclude: mapIndustryLabels(toStringArray(answers.exclude_industries)),
        countriesToExclude: toStringArray(answers.exclude_countries)
          .filter((x) => x.trim().toLowerCase() !== 'any')
          .map((x) => mapCountryLabel(x))
          .filter((x): x is string => !!x),
        statesToExclude: toStringArray(answers.exclude_states),
        citiesToExclude: toStringArray(answers.exclude_cities),
        keywordsExclude: toStringArray(answers.exclude_keywords),
        lookalikeCompanies: toStringArray(answers.lookalike_companies),
        productsDescription: String(answers.products_description ?? '').trim(),
        aiSearchQuery: String(answers.ai_search_query ?? '').trim(),
        limit: parseLimit(answers.limit, 50),
      };
      return {
        suggestedTab: 'prospect-search',
        filters: patch,
      };
    }
    case 'find_people': {
      const departments = toStringArray(answers.department)
        .map((d) => mapDepartmentChip(d))
        .filter((x): x is string => !!x);
      const seniority = toStringArray(answers.seniority)
        .map((s) => mapPeopleSeniorityChip(s))
        .filter((x): x is string => !!x);
      const locParts = toStringArray(answers.locations);
      const geo = locParts.length ? bucketJobLocations(locParts) : { countries: [] as string[], states: [] as string[], cities: [] as string[], extraKeywords: [] as string[] };
      const peopleFiltersPatch: Partial<PeopleSearchFilters> = {
        industries: mapIndustryLabels(toStringArray(answers.industries)),
        companySizes: mapCompanySizeLabels(toStringArray(answers.company_sizes)),
        jobTitles: toStringArray(answers.job_titles),
        seniority,
        departments,
        skills: toStringArray(answers.skills),
        countries: geo.countries,
        states: geo.states,
        cities: [...geo.cities, ...geo.extraKeywords],
        certifications: toStringArray(answers.certifications),
        languages: toStringArray(answers.languages).map((l) => l.toLowerCase().slice(0, 12)),
        schools: toStringArray(answers.schools),
        companies: toStringArray(answers.current_companies),
        emailStatus: String(answers.email_status ?? '').trim().toLowerCase().replace(/\s+/g, '_'),
        technologies: mapTechLabels(toStringArray(answers.technologies)),
        annualRevenue: nearestRevenueValue(String(answers.annual_revenue ?? '')),
        pastCompanies: toStringArray(answers.past_companies),
        pastJobTitles: toStringArray(answers.past_job_titles),
        limit: parseLimit(answers.limit, 50),
      };
      return {
        suggestedTab: 'prospect-search',
        filters: {
          plannerSearchType: 'people',
          peopleFiltersPatch,
        },
      };
    }
    case 'find_jobs': {
      const locParts = toStringArray(answers.locations);
      const bucket = bucketJobLocations(locParts);
      const employmentType = toStringArray(answers.employment_types)
        .map((x) => mapJobEmploymentLabel(x))
        .filter((x): x is string => !!x);
      const seniority = toStringArray(answers.seniority_levels)
        .map((x) => mapJobSeniorityLabel(x))
        .filter((x): x is string => !!x);
      const jobFiltersPatch: Partial<JobSearchFilters> = {
        excludeJobTitles: toStringArray(answers.exclude_keywords),
        jobTitles: toStringArray(answers.job_titles),
        jobDescriptionKeywords: [...toStringArray(answers.description_keywords), ...bucket.extraKeywords],
        countries: bucket.countries,
        states: bucket.states,
        cities: bucket.cities,
        employmentType,
        seniority,
        recruiterKeywords: [],
        postedWithin: mapPostedWithinLabel(String(answers.posting_date_range ?? '')),
        industries: mapIndustryLabels(
          toStringArray(answers.companies).filter((x) =>
            INDUSTRIES.some((i) => i.label.toLowerCase() === x.trim().toLowerCase()),
          ),
        ),
        companies: toStringArray(answers.companies).filter(
          (x) => !INDUSTRIES.some((i) => i.label.toLowerCase() === x.trim().toLowerCase()),
        ),
        limit: parseLimit(answers.limit, 50),
      };
      return {
        suggestedTab: 'prospect-search',
        filters: {
          plannerSearchType: 'jobs',
          jobFiltersPatch,
        },
      };
    }
    case 'local_businesses':
      return {
        suggestedTab: 'prospect-search',
        filters: {
          plannerSearchType: 'local',
          localBusinessPatch: {
            locationQuery: String(answers.location ?? '').trim(),
            radiusMiles: parseLocalRadius(answers.radiusMiles),
            searchType: mapLocalSearchTypeLabel(String(answers.searchType ?? '')),
            keyword: String(answers.keyword ?? '').trim(),
          },
        },
      };
    case 'real_estate': {
      const city = String(answers.cityOrArea ?? '').trim();
      const intentRaw = answers.listingIntent;
      let intent: string | undefined;
      if (typeof intentRaw === 'string') {
        intent = listingIntentChipToEnum(intentRaw) ?? intentRaw;
      }
      return {
        suggestedTab: 'real-estate',
        filters: {
          plannerSearchType: 'real-estate',
          realEstateCity: city,
          ...(intent ? { listingIntent: intent } : {}),
        },
      };
    }
    default:
      return { suggestedTab: 'ai-chat', filters: {} };
  }
}

/** Uses existing mapping — single source of truth with `validateScraper`. */
export function mapPlannerAnswersToValidationInput(
  filterId: string,
  answers: Record<string, unknown>,
): { type: ScraperSearchType; data: unknown } | null {
  const built = buildApplyPayloadFromAnswers(filterId, answers);
  const f = built.filters as Record<string, unknown>;
  const pst = f.plannerSearchType as string | undefined;
  if (pst === 'jobs' && f.jobFiltersPatch) return { type: 'jobs', data: f.jobFiltersPatch };
  if (pst === 'people' && f.peopleFiltersPatch) return { type: 'people', data: f.peopleFiltersPatch };
  if (pst === 'companies') {
    const {
      plannerSearchType: _a,
      peopleFiltersPatch: _b,
      jobFiltersPatch: _c,
      localBusinessPatch: _d,
      ...rest
    } = f as Record<string, unknown>;
    return { type: 'companies', data: rest };
  }
  if (pst === 'local' && f.localBusinessPatch) {
    const lb = f.localBusinessPatch as Record<string, unknown>;
    return {
      type: 'local',
      data: {
        locationQuery: String(lb.locationQuery ?? ''),
        radiusMiles: typeof lb.radiusMiles === 'number' ? lb.radiusMiles : Number(lb.radiusMiles),
        searchType: String(lb.searchType ?? ''),
        keyword: String(lb.keyword ?? ''),
      },
    };
  }
  return null;
}

export function runPlannerValidation(filterId: string, answers: Record<string, unknown>): ValidationResult {
  if (filterId === 'real_estate') {
    const city = String(answers.cityOrArea ?? '').trim();
    if (city.length > 0) return { valid: true, missingFields: [], message: '' };
    return { valid: false, missingFields: ['cityOrArea'], message: 'Please enter a city or area.' };
  }
  const mapped = mapPlannerAnswersToValidationInput(filterId, answers);
  if (!mapped) return { valid: false, missingFields: [], message: '' };
  return validateScraper(mapped.type, mapped.data);
}

function peopleQualifierHasValue(key: string, answers: Record<string, unknown>): boolean {
  switch (key) {
    case 'locations': {
      const g = bucketJobLocations(toStringArray(answers.locations));
      return g.countries.length > 0 || g.states.length > 0 || g.cities.length > 0 || g.extraKeywords.length > 0;
    }
    case 'industries':
      return isNonEmptyStringArray(toStringArray(answers.industries));
    case 'company_sizes':
      return isNonEmptyStringArray(toStringArray(answers.company_sizes));
    case 'seniority':
      return isNonEmptyStringArray(toStringArray(answers.seniority));
    case 'department':
      return isNonEmptyStringArray(toStringArray(answers.department));
    case 'current_companies':
      return isNonEmptyStringArray(toStringArray(answers.current_companies));
    default:
      return false;
  }
}

function companyDimensionHasValue(key: string, answers: Record<string, unknown>): boolean {
  switch (key) {
    case 'industries':
      return isNonEmptyStringArray(toStringArray(answers.industries));
    case 'industry_keywords':
      return isNonEmptyStringArray(toStringArray(answers.industry_keywords));
    case 'locations': {
      const g = bucketJobLocations(toStringArray(answers.locations));
      return g.countries.length > 0 || g.states.length > 0 || g.cities.length > 0 || g.extraKeywords.length > 0;
    }
    case 'company_sizes':
      return isNonEmptyStringArray(toStringArray(answers.company_sizes));
    case 'company_types':
      return isNonEmptyStringArray(toStringArray(answers.company_types));
    case 'technologies':
      return isNonEmptyStringArray(toStringArray(answers.technologies));
    case 'market_segments':
      return isNonEmptyStringArray(toStringArray(answers.market_segments));
    default:
      return false;
  }
}

export function getNextPlannerQuestion(
  filterId: string,
  phase: PlannerFlowPhase,
  answers: Record<string, unknown>,
  vr: ValidationResult,
): string | null {
  if (phase !== 'collecting_required') return null;
  switch (filterId) {
    case 'find_jobs': {
      const miss = new Set(vr.missingFields);
      if (miss.has('jobTitles')) return 'job_titles';
      if ([...miss].some((m) => ['countries', 'states', 'cities'].includes(m))) return 'locations';
      if (miss.has('employmentType')) return 'employment_types';
      if (miss.has('postedWithin')) return 'posting_date_range';
      return PLANNER_JOBS_REQUIRED_KEYS[0];
    }
    case 'local_businesses': {
      const miss = new Set(vr.missingFields);
      if ([...miss].some((m) => ['locationQuery', 'lat', 'lng'].includes(m))) return 'location';
      if (miss.has('radiusMiles')) return 'radiusMiles';
      if (miss.has('searchType')) return 'searchType';
      return PLANNER_LOCAL_REQUIRED_KEYS[0];
    }
    case 'find_people': {
      if (!isNonEmptyStringArray(toStringArray(answers.job_titles))) return 'job_titles';
      if (vr.valid) return null;
      for (const key of PLANNER_PEOPLE_QUALIFIER_KEYS) {
        if (!peopleQualifierHasValue(key, answers)) return key;
      }
      return PLANNER_PEOPLE_QUALIFIER_KEYS[0];
    }
    case 'find_companies': {
      if (vr.valid) return null;
      for (const key of PLANNER_COMPANIES_DIMENSION_KEYS) {
        if (!companyDimensionHasValue(key, answers)) return key;
      }
      return PLANNER_COMPANIES_DIMENSION_KEYS[0];
    }
    case 'real_estate': {
      if (!String(answers.cityOrArea ?? '').trim()) return 'cityOrArea';
      return null;
    }
    default:
      return null;
  }
}

function optionalKeysFor(filterId: string): readonly string[] {
  switch (filterId) {
    case 'find_jobs':
      return PLANNER_JOBS_OPTIONAL_KEYS;
    case 'local_businesses':
      return PLANNER_LOCAL_OPTIONAL_KEYS;
    case 'find_people':
      return PLANNER_PEOPLE_OPTIONAL_KEYS;
    case 'find_companies':
      return PLANNER_COMPANIES_OPTIONAL_KEYS;
    case 'real_estate':
      return PLANNER_REAL_ESTATE_OPTIONAL_KEYS;
    default:
      return [];
  }
}

export function commitAnswer(state: PlannerHostState, fieldKey: string, value: unknown): PlannerHostState {
  const fid = state.selectedType;
  if (!fid) return state;
  const nextAnswers = { ...state.answers, [fieldKey]: value };
  const vr = runPlannerValidation(fid, nextAnswers);

  if (state.phase === 'collecting_required') {
    const committedKeys = [...state.committedKeys, fieldKey];
    if (!vr.valid) {
      const nextKey = getNextPlannerQuestion(fid, 'collecting_required', nextAnswers, vr) ?? fieldKey;
      return {
        ...state,
        answers: nextAnswers,
        committedKeys,
        currentQuestionKey: nextKey,
        missingFields: vr.missingFields,
        completedRequiredCount: committedKeys.length,
        phase: 'collecting_required',
      };
    }
    return {
      ...state,
      answers: nextAnswers,
      committedKeys,
      currentQuestionKey: null,
      missingFields: vr.missingFields,
      completedRequiredCount: committedKeys.length,
      phase: 'optional_prompt',
      optionalStepIndex: 0,
    };
  }

  if (state.phase === 'collecting_optional') {
    const keys = optionalKeysFor(fid);
    const committedKeys = [...state.committedKeys, fieldKey];
    const nextIdx = state.optionalStepIndex + 1;
    if (nextIdx >= keys.length) {
      return {
        ...state,
        answers: nextAnswers,
        committedKeys,
        currentQuestionKey: null,
        optionalStepIndex: nextIdx,
        phase: 'review',
        missingFields: vr.missingFields,
      };
    }
    return {
      ...state,
      answers: nextAnswers,
      committedKeys,
      optionalStepIndex: nextIdx,
      currentQuestionKey: keys[nextIdx],
      phase: 'collecting_optional',
      missingFields: vr.missingFields,
    };
  }

  return state;
}

export function skipOptionalField(state: PlannerHostState, field: PlannerFieldConfig | undefined): PlannerHostState {
  if (!field || state.phase !== 'collecting_optional') return state;
  const empty: unknown = field.type === 'string[]' ? [] : field.type === 'number' ? 0 : '';
  return commitAnswer(state, field.key, empty);
}

export function goBackOneStep(state: PlannerHostState): PlannerHostState {
  if (state.phase !== 'collecting_required' && state.phase !== 'collecting_optional') return state;
  if (state.committedKeys.length === 0) return state;
  const lastKey = state.committedKeys[state.committedKeys.length - 1];
  const newCommitted = state.committedKeys.slice(0, -1);
  const newAnswers = { ...state.answers };
  delete newAnswers[lastKey];
  const fid = state.selectedType!;
  const vr = runPlannerValidation(fid, newAnswers);
  const keysOpt = optionalKeysFor(fid);
  const optionalStepIndex =
    state.phase === 'collecting_optional' ? Math.max(0, keysOpt.indexOf(lastKey)) : state.optionalStepIndex;
  return {
    ...state,
    answers: newAnswers,
    committedKeys: newCommitted,
    currentQuestionKey: lastKey,
    missingFields: vr.missingFields,
    completedRequiredCount: newCommitted.length,
    phase: state.phase,
    optionalStepIndex,
  };
}

export function goToFieldForEdit(state: PlannerHostState, fieldKey: string): PlannerHostState {
  const fid = state.selectedType;
  if (!fid) return state;
  const nextAnswers = { ...state.answers };
  delete nextAnswers[fieldKey];
  const vr = runPlannerValidation(fid, nextAnswers);
  const keys = optionalKeysFor(fid);
  const isOptional = keys.includes(fieldKey);
  return {
    ...state,
    answers: nextAnswers,
    phase: isOptional ? 'collecting_optional' : 'collecting_required',
    currentQuestionKey: fieldKey,
    committedKeys: state.committedKeys.filter((k) => k !== fieldKey),
    missingFields: vr.missingFields,
    optionalStepIndex: isOptional ? Math.max(0, keys.indexOf(fieldKey)) : 0,
  };
}

export function transitionOptionalPromptToReview(state: PlannerHostState): PlannerHostState {
  if (state.phase !== 'optional_prompt') return state;
  const fid = state.selectedType!;
  const vr = runPlannerValidation(fid, state.answers);
  return {
    ...state,
    phase: 'review',
    currentQuestionKey: null,
    missingFields: vr.missingFields,
  };
}

export function transitionOptionalPromptToCollectingOptional(state: PlannerHostState): PlannerHostState {
  if (state.phase !== 'optional_prompt') return state;
  const fid = state.selectedType!;
  const keys = optionalKeysFor(fid);
  if (!keys.length) {
    return transitionOptionalPromptToReview(state);
  }
  return {
    ...state,
    phase: 'collecting_optional',
    optionalStepIndex: 0,
    currentQuestionKey: keys[0],
  };
}

export function transitionReviewToOptionalPrompt(state: PlannerHostState): PlannerHostState {
  if (state.phase !== 'review') return state;
  return { ...state, phase: 'optional_prompt', currentQuestionKey: null };
}

function chipsForField(filterId: string, fieldKey: string): { id: string; label: string }[] {
  const field = getPlannerField(filterId, fieldKey);
  const list = field?.suggestions ?? [];
  return list.slice(0, MAX_CHIPS).map((label) => ({ id: label, label }));
}

export function buildCollectPlannerUiPayload(state: PlannerHostState): PlannerUiPayload | null {
  if (state.phase !== 'collecting_required' && state.phase !== 'collecting_optional') return null;
  const fid = state.selectedType;
  const curKey = state.currentQuestionKey;
  if (!fid || !curKey) return null;
  const field = getPlannerField(fid, curKey);
  const opener =
    state.phase === 'collecting_required' && state.committedKeys.length === 0 ? `${PLANNER_OPENERS[fid] ?? ''}\n\n` : '';
  const q = field?.question ?? curKey;
  const collectingOptional = state.phase === 'collecting_optional';
  const req = collectingOptional ? '(optional — leave blank or tap Skip)' : '(required for search)';
  const prompt = `${opener}${q} ${req}`.trim();
  const options = chipsForField(fid, curKey);
  const input_kind =
    field?.type === 'string[]' ? 'multi_choice' : options.length > 0 ? 'single_choice' : 'text';
  return {
    phase: 'collect_field',
    context: PLANNER_CONTEXT,
    collect_field: {
      field_id: curKey,
      prompt,
      input_kind: options.length === 0 ? 'text' : input_kind,
      options,
      allow_custom_text: field?.allowCustom !== false,
      required_for_apply: !collectingOptional,
    },
  };
}

export function buildOptionalPromptPlannerUiPayload(state: PlannerHostState): PlannerUiPayload | null {
  if (state.phase !== 'optional_prompt') return null;
  return {
    phase: 'optional_prompt',
    context: PLANNER_CONTEXT,
    optional_prompt: {
      title: 'Optional filters',
      body: 'Required fields are complete.\nWould you like to add optional filters for better results?',
      actions: [
        { id: 'run_now', label: 'Run Search Now' },
        { id: 'add_optional', label: 'Add Optional Filters' },
      ],
    },
    collect_field: null,
    review: null,
  };
}

export function buildReviewPlannerUiPayload(state: PlannerHostState): PlannerUiPayload | null {
  if (state.phase !== 'review' || !state.selectedType) return null;
  const fid = state.selectedType;
  const keys = [...new Set([...Object.keys(state.answers), ...state.committedKeys])];
  const summary = keys.map((id) => {
    const v = state.answers[id];
    const field = getPlannerField(fid, id);
    const label = field?.label ?? id;
    const disp =
      typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '—');
    return { field_id: id, value: v, display: `${label}: ${disp}` };
  });
  return {
    phase: 'review',
    context: PLANNER_CONTEXT,
    review: { summary },
  };
}
