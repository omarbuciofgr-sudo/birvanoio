import type { PlannerCatalogEntry } from '@/lib/planner/catalog';

/** Matches host contract: structured UI hints for radios, chips, and review. */
export type PlannerUiPickOption = {
  id: string;
  label: string;
  group?: string;
  description?: string;
  /** Host icon hint for cards/radios (e.g. lucide slug) */
  iconHint?: string;
};

export type PlannerUiCollectChoice = { id: string; label: string };

export type PlannerUiReviewRow = {
  field_id: string;
  value: unknown;
  display: string;
};

export type PlannerUiPayload = {
  phase: 'pick_filter' | 'collect_field' | 'optional_prompt' | 'review';
  context: string;
  pick_filter?: {
    prompt: string;
    options: PlannerUiPickOption[];
  } | null;
  collect_field?: {
    field_id: string;
    prompt: string;
    input_kind: 'single_choice' | 'multi_choice' | 'text';
    options: PlannerUiCollectChoice[];
    allow_custom_text: boolean;
    /** False when schema marks field optional; omit when unknown (treat as required). */
    required_for_apply?: boolean;
  } | null;
  optional_prompt?: {
    title: string;
    body: string;
    actions: { id: 'run_now' | 'add_optional'; label: string }[];
  } | null;
  review?: {
    summary: PlannerUiReviewRow[];
  } | null;
};

const FENCE = /```planner_ui\s*\n([\s\S]*?)```/;

export function parsePlannerUiBlock(content: string): PlannerUiPayload | null {
  const m = content.match(FENCE);
  if (!m?.[1]) return null;
  try {
    return JSON.parse(m[1].trim()) as PlannerUiPayload;
  } catch {
    return null;
  }
}

/** Prose shown in the bubble; fenced blocks are not rendered as chat text (legacy messages may still contain them). */
export function stripPlannerUiFence(content: string): string {
  return content.replace(/```planner_ui\s*\n[\s\S]*?```/g, '').trim();
}

export function appendPlannerUiFence(content: string, ui: PlannerUiPayload): string {
  const compact = compactPlannerUi(ui);
  const prose = content.trim();
  return `${prose}\n\n\`\`\`planner_ui\n${JSON.stringify(compact, null, 2)}\n\`\`\``;
}

function compactPlannerUi(ui: PlannerUiPayload): Record<string, unknown> {
  const o: Record<string, unknown> = { phase: ui.phase, context: ui.context };
  if (ui.phase === 'pick_filter' && ui.pick_filter) o.pick_filter = ui.pick_filter;
  if (ui.phase === 'collect_field' && ui.collect_field) o.collect_field = ui.collect_field;
  if (ui.phase === 'optional_prompt' && ui.optional_prompt) o.optional_prompt = ui.optional_prompt;
  if (ui.phase === 'review' && ui.review) o.review = ui.review;
  return o;
}

export function buildPickFilterPlannerUi(context: string, catalog: PlannerCatalogEntry[]): PlannerUiPayload {
  const sorted = [...catalog].sort((a, b) => a.order - b.order);
  const options: PlannerUiPickOption[] = sorted.map((e) => ({
    id: e.id,
    label: e.label,
    ...(e.group ? { group: e.group } : {}),
    ...(e.description ? { description: e.description } : {}),
    ...(e.iconHint ? { iconHint: e.iconHint } : {}),
  }));
  return {
    phase: 'pick_filter',
    context,
    pick_filter: {
      prompt: 'Choose what you want to do below.',
      options,
    },
    collect_field: null,
    review: null,
  };
}

/** Brief prose for startup; pair with buildPickFilterPlannerUi — API no longer embeds JSON in content. */
export function buildPickFilterAssistantContent(_context: string, _catalog: PlannerCatalogEntry[]): string {
  return 'Choose what you want to do below.';
}
