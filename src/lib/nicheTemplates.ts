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

export const REAL_ESTATE_TEMPLATE: CreateSchemaTemplateInput = {
  name: 'Real Estate Leads',
  niche: 'real_estate',
  description: 'Template for real estate agents, brokers, and property leads with address fields',
  is_default: false,
  fields: [
    ...UNIVERSAL_FIELDS,
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
  ],
};

export const INSURANCE_TEMPLATE: CreateSchemaTemplateInput = {
  name: 'Insurance Leads',
  niche: 'insurance',
  description: 'Template for insurance agents and leads with address and policy info',
  is_default: false,
  fields: [
    ...UNIVERSAL_FIELDS,
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
  ],
};

export const B2B_TEMPLATE: CreateSchemaTemplateInput = {
  name: 'B2B Business Leads',
  niche: 'b2b',
  description: 'Template for B2B leads with company and job title information',
  is_default: false,
  fields: [
    ...UNIVERSAL_FIELDS,
    {
      field_name: 'company_name',
      type: 'string',
      description: 'Name of the company',
      extraction_hints: 'company, business, corporation, inc, llc, ltd',
      required: true,
    },
    {
      field_name: 'job_title',
      type: 'string',
      description: 'Job title or position',
      extraction_hints: 'CEO, owner, director, manager, president, VP, founder',
      required: true,
    },
    {
      field_name: 'department',
      type: 'string',
      description: 'Department within the company',
      extraction_hints: 'sales, marketing, operations, finance, HR',
      required: false,
    },
    {
      field_name: 'company_size',
      type: 'string',
      description: 'Number of employees or company size',
      extraction_hints: 'employees, team size, staff',
      required: false,
    },
    {
      field_name: 'industry',
      type: 'string',
      description: 'Industry or sector',
      extraction_hints: 'industry, sector, vertical',
      required: false,
    },
    {
      field_name: 'website',
      type: 'url',
      description: 'Company website',
      extraction_hints: 'website, www, http',
      required: false,
    },
    {
      field_name: 'linkedin_profile',
      type: 'url',
      description: 'LinkedIn profile URL',
      extraction_hints: 'linkedin.com/in/, linkedin.com/company/',
      required: false,
    },
  ],
};

export const ALL_NICHE_TEMPLATES = [
  REAL_ESTATE_TEMPLATE,
  INSURANCE_TEMPLATE,
  B2B_TEMPLATE,
];
