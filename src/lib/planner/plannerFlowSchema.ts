/**
 * Conversational copy + suggestion chips per catalog filter + schema field id.
 * Field order follows SCHEMA_BY_FILTER_ID for each filter.
 */
import { COMPANY_SIZES } from '@/components/prospect-search/constants';

export type PlannerFlowFieldMeta = {
  /** Short conversational question */
  question: string;
  /** Quick-pick chips (UI shows first 5) */
  chips: string[];
};

const JOB_CATEGORY_LABELS = [
  'Engineering',
  'Sales',
  'Marketing',
  'Finance',
  'Operations',
  'Human Resources',
  'Design',
  'Product',
  'Customer Success',
  'Data & Analytics',
  'Legal',
  'IT',
];

const COMPANY_SIZE_CHIP_LABELS = COMPANY_SIZES.map((c) => c.label).slice(0, 5);

export const PLANNER_OPENERS: Record<string, string> = {
  find_people: 'Great — let’s find the right people.',
  find_companies: 'Great — let’s narrow down companies that fit.',
  find_jobs: 'Great — let’s surface relevant job postings.',
  local_businesses: 'Great — let’s find local businesses.',
  real_estate: 'Great — let’s set up your listing search.',
};

/** Per-field questions and chips; ids must match SCHEMA_BY_FILTER_ID. */
export const PLANNER_FIELD_COPY: Record<string, Record<string, PlannerFlowFieldMeta>> = {
  find_people: {
    jobFocus: {
      question: 'Which role or title are you targeting?',
      chips: ['CEO', 'Founder', 'VP Sales', 'Marketing Manager', 'Sales Director'],
    },
    geography: {
      question: 'Which geography should we focus on?',
      chips: ['California', 'Texas', 'New York', 'Florida', 'Illinois'],
    },
  },
  find_companies: {
    industries: {
      question: 'Which industries should we include?',
      chips: ['saas', 'healthcare', 'real_estate', 'financial_services', 'construction'],
    },
    companySizes: {
      question: 'Any company size bands to filter on?',
      chips: COMPANY_SIZE_CHIP_LABELS,
    },
    citiesOrStates: {
      question: 'Any cities or states to focus on?',
      chips: ['California', 'Texas', 'New York', 'Florida', 'Illinois'],
    },
    keywordsInclude: {
      question: 'Any keywords to match in company text?',
      chips: ['B2B', 'HIPAA', 'enterprise', 'Series A', 'SMB'],
    },
  },
  find_jobs: {
    jobKeywords: {
      question: 'Which role or job topics should we look for?',
      chips: JOB_CATEGORY_LABELS.slice(0, 5),
    },
    geography: {
      question: 'Any location focus for jobs?',
      chips: ['California', 'Texas', 'New York', 'Florida', 'Remote'],
    },
  },
  local_businesses: {
    area: {
      question: 'Which city, neighborhood, or region?',
      chips: ['Austin, TX', 'Chicago, IL', 'Phoenix, AZ', 'Miami, FL', 'Denver, CO'],
    },
    businessType: {
      question: 'What kind of businesses?',
      chips: ['roofing', 'dental', 'coffee shop', 'auto repair', 'plumbing'],
    },
  },
  real_estate: {
    cityOrArea: {
      question: 'Which city or area should we search?',
      chips: ['Chicago, Illinois', 'Austin, TX', 'Tampa, FL', 'Seattle, WA', 'Denver, CO'],
    },
    listingIntent: {
      question: 'Sale, rental, or either?',
      chips: ['FSBO sale', 'For rent by owner', 'Either'],
    },
  },
};
