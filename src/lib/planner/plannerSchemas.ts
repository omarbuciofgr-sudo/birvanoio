/**
 * Single source of truth for Brivano Scout Planner field order, copy, and chips.
 * Keys match filter payload mapping in plannerFlow.ts / buildApplyPayloadFromAnswers.
 */

export type PlannerFieldType = 'string' | 'string[]' | 'number';

export interface PlannerFieldConfig {
  key: string;
  label: string;
  question: string;
  type: PlannerFieldType;
  required: boolean;
  suggestions: string[];
  allowCustom: boolean;
  allowSkip: boolean;
}

/** Max chips shown in UI (schema may list more for completeness). */
const MAX_SUGGESTIONS = 5;

function sliceSuggestions(s: string[]): string[] {
  return s.slice(0, MAX_SUGGESTIONS);
}

function field(config: Omit<PlannerFieldConfig, 'allowCustom'> & { allowCustom?: boolean }): PlannerFieldConfig {
  return {
    ...config,
    suggestions: sliceSuggestions(config.suggestions),
    allowCustom: config.allowCustom !== false,
  };
}

/** Short intro shown before the first question for each flow. */
export const PLANNER_OPENERS: Record<string, string> = {
  find_jobs: "Let's narrow down the job postings you want.",
  find_people: "Let's define who you're looking for.",
  find_companies: "Let's define your ideal companies.",
  local_businesses: "Let's set up your local business search.",
  real_estate: "Let's focus your property search.",
};

export const PLANNER_SCHEMAS: Record<string, PlannerFieldConfig[]> = {
  find_jobs: [
    field({
      key: 'job_titles',
      label: 'Job titles',
      question: 'Which job titles or keywords should we match?',
      type: 'string[]',
      required: true,
      allowSkip: false,
      suggestions: ['Software Engineer', 'Sales Manager', 'Marketing Manager', 'Data Analyst', 'Product Manager'],
    }),
    field({
      key: 'locations',
      label: 'Locations',
      question: 'Which countries, states, or cities should we search in?',
      type: 'string[]',
      required: true,
      allowSkip: false,
      suggestions: ['United States', 'United Kingdom', 'California', 'New York', 'London'],
    }),
    field({
      key: 'employment_types',
      label: 'Employment types',
      question: 'Which employment type do you want?',
      type: 'string[]',
      required: true,
      allowSkip: false,
      suggestions: ['Full-time', 'Part-time', 'Contract', 'Internship', 'Temporary'],
    }),
    field({
      key: 'posting_date_range',
      label: 'Posting date',
      question: 'How recent should the job postings be?',
      type: 'string',
      required: true,
      allowSkip: false,
      suggestions: ['Last 24 hours', 'Last 7 days', 'Last 14 days', 'Last 30 days', 'Any time'],
    }),
    field({
      key: 'description_keywords',
      label: 'Description keywords',
      question: 'Which description keywords should we match?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['React', 'Python', 'SaaS', 'Remote', 'AI'],
    }),
    field({
      key: 'exclude_keywords',
      label: 'Exclude keywords',
      question: 'What should we exclude from job results?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['Staffing agency', 'Recruiter posts', 'Internship', 'Unpaid', 'Commission only'],
    }),
    field({
      key: 'companies',
      label: 'Company names',
      question: 'Which companies should we focus on?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['SaaS companies', 'Startups', 'Enterprise companies', 'Healthcare', 'E-commerce'],
    }),
    field({
      key: 'seniority_levels',
      label: 'Seniority',
      question: 'Which seniority level should we target?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['Entry level', 'Mid level', 'Senior', 'Manager', 'Director'],
    }),
    field({
      key: 'limit',
      label: 'Limit',
      question: 'How many results should we return?',
      type: 'number',
      required: false,
      allowSkip: true,
      suggestions: ['25', '50', '100', '250', '500'],
    }),
  ],

  find_people: [
    field({
      key: 'job_titles',
      label: 'Job titles',
      question: 'Which job titles should we look for?',
      type: 'string[]',
      required: true,
      allowSkip: false,
      suggestions: ['Founder', 'CEO', 'Marketing Manager', 'Sales Director', 'Operations Manager'],
    }),
    field({
      key: 'locations',
      label: 'Location',
      question: 'Which countries, states, or cities should we include?',
      type: 'string[]',
      required: false,
      allowSkip: false,
      suggestions: ['United States', 'United Kingdom', 'California', 'New York', 'London'],
    }),
    field({
      key: 'industries',
      label: 'Industries',
      question: 'Which industries should these people belong to?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['SaaS', 'Real Estate', 'Healthcare', 'E-commerce', 'Marketing Agencies'],
    }),
    field({
      key: 'company_sizes',
      label: 'Company sizes',
      question: 'What company sizes should we target?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['1-10', '11-50', '51-200', '201-500', '500+'],
    }),
    field({
      key: 'seniority',
      label: 'Seniority',
      question: 'Which seniority levels should we include?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['Owner', 'Founder', 'Manager', 'Director', 'VP'],
    }),
    field({
      key: 'department',
      label: 'Department',
      question: 'Which department should these people work in?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['Sales', 'Marketing', 'Operations', 'Engineering', 'HR'],
    }),
    field({
      key: 'current_companies',
      label: 'Companies',
      question: 'Any current companies to include?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['Google', 'Microsoft', 'Amazon', 'Meta', 'Salesforce'],
    }),
    field({
      key: 'skills',
      label: 'Skills',
      question: 'Which skills should they have?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['Sales', 'SEO', 'React', 'Python', 'Leadership'],
    }),
    field({
      key: 'email_status',
      label: 'Email status',
      question: 'What email status should we include?',
      type: 'string',
      required: false,
      allowSkip: true,
      suggestions: ['Verified', 'Likely Valid', 'Unverified', 'Has Email', 'No Email'],
    }),
    field({
      key: 'technologies',
      label: 'Technologies',
      question: 'Which technologies should their company use?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['Shopify', 'HubSpot', 'Salesforce', 'WordPress', 'React'],
    }),
    field({
      key: 'annual_revenue',
      label: 'Annual revenue',
      question: 'What annual revenue range should we target?',
      type: 'string',
      required: false,
      allowSkip: true,
      suggestions: ['<$1M', '$1M-$10M', '$10M-$50M', '$50M-$100M', '$100M+'],
    }),
    field({
      key: 'certifications',
      label: 'Certifications',
      question: 'Any certifications to include?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['PMP', 'AWS Certified', 'HubSpot', 'Google Ads', 'Salesforce'],
    }),
    field({
      key: 'languages',
      label: 'Languages',
      question: 'Which languages should they speak?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['English', 'Spanish', 'French', 'Urdu', 'Hindi'],
    }),
    field({
      key: 'schools',
      label: 'Schools',
      question: 'Any specific schools or universities?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['Harvard', 'Stanford', 'MIT', 'Oxford', 'University of California'],
    }),
    field({
      key: 'past_companies',
      label: 'Past companies',
      question: 'Any past companies to include?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['Google', 'Amazon', 'Meta', 'Microsoft', 'Apple'],
    }),
    field({
      key: 'past_job_titles',
      label: 'Past job titles',
      question: 'Any past job titles to include?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['Founder', 'Manager', 'Director', 'VP', 'Consultant'],
    }),
    field({
      key: 'limit',
      label: 'Limit',
      question: 'How many results should we return?',
      type: 'number',
      required: false,
      allowSkip: true,
      suggestions: ['25', '50', '100', '250', '500'],
    }),
  ],

  find_companies: [
    field({
      key: 'industries',
      label: 'Industries',
      question: 'Which industries should we target?',
      type: 'string[]',
      required: false,
      allowSkip: false,
      suggestions: ['SaaS', 'Real Estate', 'Healthcare', 'E-commerce', 'Marketing Agencies'],
    }),
    field({
      key: 'industry_keywords',
      label: 'Keywords',
      question: 'Which industry or company keywords should we match?',
      type: 'string[]',
      required: false,
      allowSkip: false,
      suggestions: ['AI', 'CRM', 'Real Estate', 'Marketing', 'Healthcare'],
    }),
    field({
      key: 'locations',
      label: 'Location',
      question: 'Which countries, states, or cities should we include?',
      type: 'string[]',
      required: false,
      allowSkip: false,
      suggestions: ['United States', 'United Kingdom', 'California', 'New York', 'London'],
    }),
    field({
      key: 'company_sizes',
      label: 'Company sizes',
      question: 'What company sizes should we include?',
      type: 'string[]',
      required: false,
      allowSkip: false,
      suggestions: ['1-10', '11-50', '51-200', '201-500', '500+'],
    }),
    field({
      key: 'company_types',
      label: 'Company types',
      question: 'Which company types should we target?',
      type: 'string[]',
      required: false,
      allowSkip: false,
      suggestions: ['Startup', 'Agency', 'Enterprise', 'SMB', 'Nonprofit'],
    }),
    field({
      key: 'technologies',
      label: 'Technologies',
      question: 'Which technologies should these companies use?',
      type: 'string[]',
      required: false,
      allowSkip: false,
      suggestions: ['Shopify', 'HubSpot', 'Salesforce', 'WordPress', 'React'],
    }),
    field({
      key: 'market_segments',
      label: 'Market segments',
      question: 'Which market segments should we target?',
      type: 'string[]',
      required: false,
      allowSkip: false,
      suggestions: ['B2B', 'B2C', 'Enterprise', 'SMB', 'Mid-market'],
    }),
    field({
      key: 'funding_raised',
      label: 'Funding raised',
      question: 'How much funding should the company have raised?',
      type: 'string',
      required: false,
      allowSkip: true,
      suggestions: ['None', '<$1M', '$1M-$10M', '$10M-$50M', '$50M+'],
    }),
    field({
      key: 'funding_stage',
      label: 'Funding stage',
      question: 'Which funding stage should we include?',
      type: 'string',
      required: false,
      allowSkip: true,
      suggestions: ['Bootstrapped', 'Seed', 'Series A', 'Series B', 'Series C+'],
    }),
    field({
      key: 'buying_intent',
      label: 'Buying intent',
      question: 'What buying intent level should we target?',
      type: 'string',
      required: false,
      allowSkip: true,
      suggestions: ['High', 'Medium', 'Low', 'Any', 'Unknown'],
    }),
    field({
      key: 'hiring_status',
      label: 'Hiring status',
      question: 'Should we target companies that are hiring?',
      type: 'string',
      required: false,
      allowSkip: true,
      suggestions: ['Currently hiring', 'Not hiring', 'Hiring actively', 'Any', 'Unknown'],
    }),
    field({
      key: 'hiring_departments',
      label: 'Hiring departments',
      question: 'Which departments should be hiring?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['Sales', 'Marketing', 'Engineering', 'Operations', 'Customer Support'],
    }),
    field({
      key: 'exclude_industries',
      label: 'Exclude industries',
      question: 'Which industries should we exclude?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['Gambling', 'Adult', 'Crypto', 'Tobacco', 'Insurance'],
    }),
    field({
      key: 'exclude_countries',
      label: 'Exclude countries',
      question: 'Which countries should we exclude?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['China', 'Russia', 'India', 'Pakistan', 'Any'],
    }),
    field({
      key: 'exclude_states',
      label: 'Exclude states',
      question: 'Which states should we exclude?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['California', 'Texas', 'Florida', 'New York', 'Illinois'],
    }),
    field({
      key: 'exclude_cities',
      label: 'Exclude cities',
      question: 'Which cities should we exclude?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['New York', 'Los Angeles', 'Chicago', 'Miami', 'Austin'],
    }),
    field({
      key: 'exclude_keywords',
      label: 'Exclude keywords',
      question: 'Which company keywords should we exclude?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['Staffing', 'Recruiting', 'Agency', 'Franchise', 'Marketplace'],
    }),
    field({
      key: 'lookalike_companies',
      label: 'Lookalike companies',
      question: 'Which companies should we use as lookalike examples?',
      type: 'string[]',
      required: false,
      allowSkip: true,
      suggestions: ['Salesforce', 'HubSpot', 'Shopify', 'Airbnb', 'Stripe'],
    }),
    field({
      key: 'products_description',
      label: 'Products & services',
      question: 'Describe the products or services these companies should offer.',
      type: 'string',
      required: false,
      allowSkip: true,
      suggestions: [
        'CRM software',
        'Marketing services',
        'Property management',
        'AI tools',
        'Healthcare services',
      ],
    }),
    field({
      key: 'ai_search_query',
      label: 'AI search',
      question: 'What should the AI specifically look for?',
      type: 'string',
      required: false,
      allowSkip: true,
      suggestions: [
        'Companies selling to SMBs',
        'Agencies using HubSpot',
        'SaaS companies hiring sales reps',
        'Real estate tech startups',
        'Healthcare software providers',
      ],
    }),
    field({
      key: 'limit',
      label: 'Limit',
      question: 'How many results should we return?',
      type: 'number',
      required: false,
      allowSkip: true,
      suggestions: ['25', '50', '100', '250', '500'],
    }),
  ],

  local_businesses: [
    field({
      key: 'location',
      label: 'Location',
      question: 'Where should we search for local businesses?',
      type: 'string',
      required: true,
      allowSkip: false,
      suggestions: ['New York', 'Los Angeles', 'Miami', 'Austin', 'London'],
    }),
    field({
      key: 'radiusMiles',
      label: 'Radius',
      question: 'What search radius should we use?',
      type: 'string',
      required: true,
      allowSkip: false,
      suggestions: ['1 mile', '5 miles', '10 miles', '25 miles', '50 miles'],
    }),
    field({
      key: 'searchType',
      label: 'Business type',
      question: 'What type of local business should we search for?',
      type: 'string',
      required: true,
      allowSkip: false,
      suggestions: ['Restaurants', 'Healthcare', 'Legal Services', 'Real Estate Agents', 'Cafes'],
    }),
    field({
      key: 'keyword',
      label: 'Keyword',
      question: 'Any keyword to narrow the search?',
      type: 'string',
      required: false,
      allowSkip: true,
      suggestions: ['Pizza', 'Roofing', 'HVAC', 'Dentist', 'Gym'],
    }),
  ],

  real_estate: [
    field({
      key: 'cityOrArea',
      label: 'City or area',
      question: 'Where should we search for listings?',
      type: 'string',
      required: true,
      allowSkip: false,
      suggestions: ['Chicago, Illinois', 'Austin, TX', 'Tampa, FL', 'Seattle, WA', 'Denver, CO'],
    }),
    field({
      key: 'listingIntent',
      label: 'Listing focus',
      question: 'Sale, rental, or either?',
      type: 'string',
      required: false,
      allowSkip: true,
      suggestions: ['FSBO sale', 'For rent by owner', 'Either'],
    }),
  ],
};

/** Planner orchestration order — validation uses `validateScraper` + `buildApplyPayloadFromAnswers`. */
export const PLANNER_JOBS_REQUIRED_KEYS = ['job_titles', 'locations', 'employment_types', 'posting_date_range'] as const;
export const PLANNER_JOBS_OPTIONAL_KEYS = [
  'description_keywords',
  'exclude_keywords',
  'companies',
  'seniority_levels',
  'limit',
] as const;

export const PLANNER_LOCAL_REQUIRED_KEYS = ['location', 'radiusMiles', 'searchType'] as const;
export const PLANNER_LOCAL_OPTIONAL_KEYS = ['keyword'] as const;

/** After job titles: qualifiers until `validateScraper('people')` passes. */
export const PLANNER_PEOPLE_QUALIFIER_KEYS = [
  'locations',
  'industries',
  'company_sizes',
  'seniority',
  'department',
  'current_companies',
] as const;
export const PLANNER_PEOPLE_OPTIONAL_KEYS = [
  'skills',
  'email_status',
  'technologies',
  'annual_revenue',
  'certifications',
  'languages',
  'schools',
  'past_companies',
  'past_job_titles',
  'limit',
] as const;

/** Until three strong dimensions pass company validation. */
export const PLANNER_COMPANIES_DIMENSION_KEYS = [
  'industries',
  'industry_keywords',
  'locations',
  'company_sizes',
  'company_types',
  'technologies',
  'market_segments',
] as const;
export const PLANNER_COMPANIES_OPTIONAL_KEYS = [
  'funding_raised',
  'funding_stage',
  'buying_intent',
  'hiring_status',
  'hiring_departments',
  'exclude_industries',
  'exclude_countries',
  'exclude_states',
  'exclude_cities',
  'exclude_keywords',
  'lookalike_companies',
  'products_description',
  'ai_search_query',
  'limit',
] as const;

export const PLANNER_REAL_ESTATE_REQUIRED_KEYS = ['cityOrArea'] as const;
export const PLANNER_REAL_ESTATE_OPTIONAL_KEYS = ['listingIntent'] as const;

export function getPlannerSchema(filterId: string): PlannerFieldConfig[] {
  return PLANNER_SCHEMAS[filterId] ?? [];
}

export function getPlannerField(filterId: string, fieldKey: string): PlannerFieldConfig | undefined {
  return getPlannerSchema(filterId).find((f) => f.key === fieldKey);
}
