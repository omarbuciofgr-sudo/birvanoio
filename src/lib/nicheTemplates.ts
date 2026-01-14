// Pre-built schema templates for common lead generation niches
import type { CreateSchemaTemplateInput, SchemaField } from '@/types/scraper';

// Universal fields that all templates include
const UNIVERSAL_FIELDS: SchemaField[] = [
  {
    field_name: 'full_name',
    type: 'string',
    description: 'Full name of the contact',
    extraction_hints: 'owner, contact, manager, agent, principal, broker',
    required: true,
  },
  {
    field_name: 'email',
    type: 'string',
    description: 'Email address of the contact',
    extraction_hints: 'email, contact us, mailto:',
    required: true,
  },
  {
    field_name: 'phone',
    type: 'string',
    description: 'Phone number of the contact',
    extraction_hints: 'phone, call, tel:, mobile, office',
    required: true,
  },
];

// Enhanced universal fields with ZoomInfo-like data points
const ENHANCED_UNIVERSAL_FIELDS: SchemaField[] = [
  ...UNIVERSAL_FIELDS,
  {
    field_name: 'direct_phone',
    type: 'string',
    description: 'Direct dial phone number',
    extraction_hints: 'direct, direct line, direct dial, ext',
    required: false,
  },
  {
    field_name: 'mobile_phone',
    type: 'string',
    description: 'Mobile or cell phone number',
    extraction_hints: 'mobile, cell, cellular',
    required: false,
  },
  {
    field_name: 'job_title',
    type: 'string',
    description: 'Job title or position',
    extraction_hints: 'title, position, role',
    required: false,
  },
  {
    field_name: 'seniority_level',
    type: 'string',
    description: 'Seniority level (C-Suite, VP, Director, Manager, etc.)',
    extraction_hints: 'CEO, CTO, VP, Director, Manager, Senior',
    required: false,
  },
  {
    field_name: 'department',
    type: 'string',
    description: 'Department or function',
    extraction_hints: 'sales, marketing, engineering, operations, finance',
    required: false,
  },
  {
    field_name: 'linkedin_profile',
    type: 'url',
    description: 'LinkedIn profile URL',
    extraction_hints: 'linkedin.com/in/',
    required: false,
  },
];

// Company enrichment fields
const COMPANY_FIELDS: SchemaField[] = [
  {
    field_name: 'company_name',
    type: 'string',
    description: 'Name of the company',
    extraction_hints: 'company, business, corporation, inc, llc, ltd',
    required: true,
  },
  {
    field_name: 'company_website',
    type: 'url',
    description: 'Company website URL',
    extraction_hints: 'website, www, http',
    required: false,
  },
  {
    field_name: 'company_linkedin',
    type: 'url',
    description: 'Company LinkedIn page URL',
    extraction_hints: 'linkedin.com/company/',
    required: false,
  },
  {
    field_name: 'employee_count',
    type: 'number',
    description: 'Number of employees',
    extraction_hints: 'employees, team size, staff, headcount',
    required: false,
  },
  {
    field_name: 'employee_range',
    type: 'string',
    description: 'Employee count range (1-10, 11-50, 51-200, etc.)',
    extraction_hints: 'company size, employee range',
    required: false,
  },
  {
    field_name: 'annual_revenue',
    type: 'number',
    description: 'Annual revenue in USD',
    extraction_hints: 'revenue, sales, annual revenue',
    required: false,
  },
  {
    field_name: 'revenue_range',
    type: 'string',
    description: 'Revenue range ($1M-$10M, $10M-$50M, etc.)',
    extraction_hints: 'revenue range',
    required: false,
  },
  {
    field_name: 'funding_total',
    type: 'number',
    description: 'Total funding raised in USD',
    extraction_hints: 'funding, raised, investment',
    required: false,
  },
  {
    field_name: 'funding_stage',
    type: 'string',
    description: 'Funding stage (Seed, Series A, Series B, etc.)',
    extraction_hints: 'series, seed, funding round',
    required: false,
  },
  {
    field_name: 'founded_year',
    type: 'number',
    description: 'Year company was founded',
    extraction_hints: 'founded, established, since',
    required: false,
  },
  {
    field_name: 'industry',
    type: 'string',
    description: 'Industry or sector',
    extraction_hints: 'industry, sector, vertical, market',
    required: false,
  },
  {
    field_name: 'technologies',
    type: 'string',
    description: 'Technologies used (comma-separated)',
    extraction_hints: 'tech stack, technologies, tools, platforms',
    required: false,
  },
  {
    field_name: 'headquarters_city',
    type: 'string',
    description: 'Headquarters city',
    extraction_hints: 'city, location, headquarters',
    required: false,
  },
  {
    field_name: 'headquarters_state',
    type: 'string',
    description: 'Headquarters state/province',
    extraction_hints: 'state, province, region',
    required: false,
  },
  {
    field_name: 'headquarters_country',
    type: 'string',
    description: 'Headquarters country',
    extraction_hints: 'country, nation',
    required: false,
  },
];

export const REAL_ESTATE_TEMPLATE: CreateSchemaTemplateInput = {
  name: 'Real Estate Leads',
  niche: 'real_estate',
  description: 'Template for real estate agents, brokers, and property leads with address fields',
  is_default: false,
  fields: [
    ...ENHANCED_UNIVERSAL_FIELDS,
    {
      field_name: 'mailing_address',
      type: 'string',
      description: 'Full mailing address',
      extraction_hints: 'address, location, office, street, suite',
      required: true,
    },
    {
      field_name: 'city',
      type: 'string',
      description: 'City',
      extraction_hints: 'city',
      required: false,
    },
    {
      field_name: 'state',
      type: 'string',
      description: 'State or Province',
      extraction_hints: 'state, province',
      required: false,
    },
    {
      field_name: 'zip_code',
      type: 'string',
      description: 'ZIP or postal code',
      extraction_hints: 'zip, postal',
      required: false,
    },
    {
      field_name: 'license_number',
      type: 'string',
      description: 'Real estate license number',
      extraction_hints: 'license, DRE, BRE, realtor id',
      required: false,
    },
    {
      field_name: 'brokerage',
      type: 'string',
      description: 'Brokerage or agency name',
      extraction_hints: 'brokerage, realty, agency, properties',
      required: false,
    },
    {
      field_name: 'specialization',
      type: 'string',
      description: 'Specialization (residential, commercial, luxury)',
      extraction_hints: 'residential, commercial, luxury, investment',
      required: false,
    },
    {
      field_name: 'service_areas',
      type: 'string',
      description: 'Service areas or regions',
      extraction_hints: 'serving, areas, regions, neighborhoods',
      required: false,
    },
  ],
};

export const INSURANCE_TEMPLATE: CreateSchemaTemplateInput = {
  name: 'Insurance Leads',
  niche: 'insurance',
  description: 'Template for insurance agents and leads with address and policy info',
  is_default: false,
  fields: [
    ...ENHANCED_UNIVERSAL_FIELDS,
    {
      field_name: 'mailing_address',
      type: 'string',
      description: 'Full mailing address',
      extraction_hints: 'address, location, office, street',
      required: true,
    },
    {
      field_name: 'city',
      type: 'string',
      description: 'City',
      extraction_hints: 'city',
      required: false,
    },
    {
      field_name: 'state',
      type: 'string',
      description: 'State or Province',
      extraction_hints: 'state, province',
      required: false,
    },
    {
      field_name: 'zip_code',
      type: 'string',
      description: 'ZIP or postal code',
      extraction_hints: 'zip, postal',
      required: false,
    },
    {
      field_name: 'insurance_type',
      type: 'string',
      description: 'Type of insurance (auto, home, life, etc.)',
      extraction_hints: 'auto insurance, home insurance, life insurance, health, commercial',
      required: false,
    },
    {
      field_name: 'agency_name',
      type: 'string',
      description: 'Insurance agency name',
      extraction_hints: 'agency, insurance company, carrier',
      required: false,
    },
    {
      field_name: 'license_number',
      type: 'string',
      description: 'Insurance license number',
      extraction_hints: 'license, NPN, producer number',
      required: false,
    },
    {
      field_name: 'carriers_represented',
      type: 'string',
      description: 'Insurance carriers represented',
      extraction_hints: 'carriers, companies, underwriters',
      required: false,
    },
  ],
};

export const B2B_TEMPLATE: CreateSchemaTemplateInput = {
  name: 'B2B Business Leads',
  niche: 'b2b',
  description: 'Template for B2B leads with company and job title information - ZoomInfo style',
  is_default: false,
  fields: [
    ...ENHANCED_UNIVERSAL_FIELDS,
    ...COMPANY_FIELDS,
  ],
};

export const HEALTHCARE_TEMPLATE: CreateSchemaTemplateInput = {
  name: 'Healthcare Provider Leads',
  niche: 'healthcare',
  description: 'Template for healthcare providers, doctors, and medical practices',
  is_default: false,
  fields: [
    ...ENHANCED_UNIVERSAL_FIELDS,
    {
      field_name: 'credentials',
      type: 'string',
      description: 'Medical credentials (MD, DO, NP, PA, RN, etc.)',
      extraction_hints: 'MD, DO, NP, PA, RN, credentials',
      required: false,
    },
    {
      field_name: 'specialty',
      type: 'string',
      description: 'Medical specialty',
      extraction_hints: 'specialty, specialization, practice area',
      required: false,
    },
    {
      field_name: 'npi_number',
      type: 'string',
      description: 'National Provider Identifier (NPI) number',
      extraction_hints: 'NPI, provider number',
      required: false,
    },
    {
      field_name: 'practice_name',
      type: 'string',
      description: 'Practice or clinic name',
      extraction_hints: 'practice, clinic, medical center, hospital',
      required: false,
    },
    {
      field_name: 'address',
      type: 'string',
      description: 'Practice address',
      extraction_hints: 'address, location',
      required: false,
    },
    {
      field_name: 'services',
      type: 'string',
      description: 'Services offered',
      extraction_hints: 'services, treatments, procedures',
      required: false,
    },
    {
      field_name: 'insurance_accepted',
      type: 'string',
      description: 'Insurance plans accepted',
      extraction_hints: 'insurance, plans, medicare, medicaid',
      required: false,
    },
  ],
};

export const LEGAL_TEMPLATE: CreateSchemaTemplateInput = {
  name: 'Legal/Attorney Leads',
  niche: 'legal',
  description: 'Template for attorneys, law firms, and legal professionals',
  is_default: false,
  fields: [
    ...ENHANCED_UNIVERSAL_FIELDS,
    {
      field_name: 'bar_number',
      type: 'string',
      description: 'State bar number or license',
      extraction_hints: 'bar number, bar license, attorney license',
      required: false,
    },
    {
      field_name: 'practice_areas',
      type: 'string',
      description: 'Practice areas (personal injury, family law, etc.)',
      extraction_hints: 'practice areas, specialties, practice',
      required: false,
    },
    {
      field_name: 'firm_name',
      type: 'string',
      description: 'Law firm name',
      extraction_hints: 'law firm, attorneys at law, legal group',
      required: false,
    },
    {
      field_name: 'firm_title',
      type: 'string',
      description: 'Title at firm (Partner, Associate, Of Counsel)',
      extraction_hints: 'partner, associate, of counsel, founding',
      required: false,
    },
    {
      field_name: 'address',
      type: 'string',
      description: 'Office address',
      extraction_hints: 'address, location, office',
      required: false,
    },
    {
      field_name: 'education',
      type: 'string',
      description: 'Law school and education',
      extraction_hints: 'law school, JD, education, graduated',
      required: false,
    },
    {
      field_name: 'admitted_states',
      type: 'string',
      description: 'States admitted to practice',
      extraction_hints: 'admitted, licensed in, jurisdictions',
      required: false,
    },
  ],
};

export const SAAS_TEMPLATE: CreateSchemaTemplateInput = {
  name: 'SaaS/Tech Company Leads',
  niche: 'saas',
  description: 'Template for SaaS and technology companies with technographics',
  is_default: false,
  fields: [
    ...ENHANCED_UNIVERSAL_FIELDS,
    ...COMPANY_FIELDS,
    {
      field_name: 'tech_stack',
      type: 'string',
      description: 'Technology stack used',
      extraction_hints: 'tech stack, built with, powered by, technologies',
      required: false,
    },
    {
      field_name: 'product_category',
      type: 'string',
      description: 'Product category (CRM, Marketing, Analytics, etc.)',
      extraction_hints: 'category, type, solution',
      required: false,
    },
    {
      field_name: 'pricing_model',
      type: 'string',
      description: 'Pricing model (freemium, subscription, usage-based)',
      extraction_hints: 'pricing, plans, subscription',
      required: false,
    },
    {
      field_name: 'integrations',
      type: 'string',
      description: 'Key integrations offered',
      extraction_hints: 'integrations, connects with, works with',
      required: false,
    },
    {
      field_name: 'target_market',
      type: 'string',
      description: 'Target market or customer segment',
      extraction_hints: 'for, designed for, target, customers',
      required: false,
    },
  ],
};

export const ALL_NICHE_TEMPLATES = [
  REAL_ESTATE_TEMPLATE,
  INSURANCE_TEMPLATE,
  B2B_TEMPLATE,
  HEALTHCARE_TEMPLATE,
  LEGAL_TEMPLATE,
  SAAS_TEMPLATE,
];

// Extraction mode options for AI-powered scraping
export const EXTRACTION_MODES = {
  markdown: {
    name: 'Standard Markdown',
    description: 'Extract page content as markdown, then parse for contacts',
  },
  json: {
    name: 'Structured JSON',
    description: 'Use AI to extract structured data based on schema',
  },
  ai: {
    name: 'AI Prompt Extraction',
    description: 'Use custom AI prompts for flexible extraction',
  },
};

// Pre-built AI extraction prompts
export const AI_EXTRACTION_PROMPTS = {
  decision_makers: `Find all decision makers and executives on this page. For each person extract:
- Full name (first and last)
- Job title (especially C-level, VP, Director, Manager roles)
- Email address
- Phone number (direct dial preferred)
- LinkedIn URL
Focus on people with buying authority: CEO, CTO, CFO, CMO, VP, Director, Head of, Manager.`,

  all_contacts: `Extract ALL contact information from this page. For each person:
- Full name
- Job title or role
- Email address
- Phone number
- Department
- LinkedIn profile URL
Include everyone listed on team pages, about pages, or contact sections.`,

  company_info: `Extract company/business information:
- Company name
- Industry/sector
- Company description
- Number of employees (exact or range)
- Annual revenue (if mentioned)
- Founded year
- Headquarters location
- Technologies used
Return only factual data found on the page.`,

  sales_contacts: `Find sales and business development contacts:
- Sales representatives
- Account executives
- Business development managers
- Sales directors and VPs
For each, get: name, title, email, phone, LinkedIn.`,

  technical_contacts: `Find technical decision makers:
- CTOs and technical founders
- VPs of Engineering
- Engineering managers
- DevOps/Platform leads
- IT directors
For each, get: name, title, email, phone, LinkedIn.`,
};
