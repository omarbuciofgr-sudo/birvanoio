import type { PlannerFieldConfig } from '@/lib/planner/plannerSchemas';
import { PLANNER_SCHEMAS } from '@/lib/planner/plannerSchemas';

/** Injected on every Planner turn so the model never invents catalog entries. */
export const PLANNER_CONTEXT = 'scout-planner-tab';

export type PlannerCatalogEntry = {
  id: string;
  label: string;
  description?: string;
  order: number;
  group?: string;
  /** Host hint for icons in UI: lucide-style slug */
  iconHint?: string;
};

export type PlannerSchemaField = {
  id: string;
  label: string;
  type: 'string' | 'string[]' | 'enum' | 'number';
  required: boolean;
  enum?: string[];
  helpText?: string;
};

/** Section header in pick_filter.options[].group — must match host intent (UI renders one block per distinct group). */
const GROUP_LENS = 'Brivano Lens';

/**
 * First-step paths for Brivano Scout (edit here to change starters; prompt stays stable).
 * Ids/labels are authoritative for pick_filter.
 */
export const PLANNER_FILTER_CATALOG: PlannerCatalogEntry[] = [
  {
    id: 'find_people',
    label: 'Find people',
    description: 'Decision-makers and contacts.',
    order: 1,
    group: GROUP_LENS,
    iconHint: 'users',
  },
  {
    id: 'find_companies',
    label: 'Find companies',
    description: 'Target accounts by industry, size, and location.',
    order: 2,
    group: GROUP_LENS,
    iconHint: 'building2',
  },
  {
    id: 'find_jobs',
    label: 'Find jobs',
    description: 'Job postings to surface hiring companies and roles.',
    order: 3,
    group: GROUP_LENS,
    iconHint: 'briefcase',
  },
  {
    id: 'local_businesses',
    label: 'Local businesses',
    description: 'Businesses in a specific area (maps-style local search).',
    order: 4,
    group: GROUP_LENS,
    iconHint: 'map-pin',
  },
];

function plannerFieldToLegacySchema(f: PlannerFieldConfig): PlannerSchemaField {
  const baseType = f.type === 'number' ? 'number' : f.type === 'string[]' ? 'string[]' : 'string';
  const st: PlannerSchemaField['type'] =
    f.key === 'listingIntent' ? 'enum' : baseType === 'string' ? 'string' : baseType;
  const out: PlannerSchemaField = {
    id: f.key,
    label: f.label,
    type: st,
    required: f.required,
    helpText: f.question,
  };
  if (f.key === 'listingIntent') {
    out.enum = ['fsbo_sale', 'for_rent_by_owner', 'either'];
  }
  return out;
}

/** Legacy schema rows derived from plannerSchemas.ts (ids use field keys). */
export const SCHEMA_BY_FILTER_ID: Record<string, PlannerSchemaField[]> = Object.fromEntries(
  Object.entries(PLANNER_SCHEMAS).map(([id, fields]) => [id, fields.map(plannerFieldToLegacySchema)]),
);

/** Per-field suggestion shortcuts from plannerSchemas.ts. */
export function buildSuggestionsForFilter(filterId: string): Record<string, string[]> {
  const fields = PLANNER_SCHEMAS[filterId];
  if (!fields) return {};
  return Object.fromEntries(fields.map((f) => [f.key, f.suggestions]));
}

export function getSchemaForSelectedFilter(filterId: string): PlannerSchemaField[] {
  return SCHEMA_BY_FILTER_ID[filterId] ?? [];
}
