/**
 * A/B test for persona recommendation strategies.
 *
 * Every user is deterministically bucketed into one strategy variant. The
 * variant decides how goal/role suggestions are ranked and how aggressive the
 * thresholds are. Exposure, apply and downstream conversion events are recorded
 * against the variant so we can compare which strategy actually lifts
 * conversion rates.
 */
import { trackPersonaEvent } from "@/lib/analytics/personaAnalytics";

export type ExperimentVariantId = "control" | "activation_first" | "aggressive";

export type RecommendationStrategy = {
  id: ExperimentVariantId;
  label: string;
  description: string;
  /** Minimum cohort size before a stat can drive a recommendation. */
  minSample: number;
  /** How suggested goals are ranked. */
  rank: "conversion" | "activation" | "blended";
  /** Conversion-rate gap (absolute) required before suggesting a role switch. */
  roleSwitchThreshold: number;
  /** Max number of goals suggested at once. */
  maxGoals: number;
};

export const RECOMMENDATION_STRATEGIES: Record<ExperimentVariantId, RecommendationStrategy> = {
  control: {
    id: "control",
    label: "Control — conversion ranked",
    description: "Suggests goals that convert above the user's current mix. Conservative thresholds.",
    minSample: 5,
    rank: "conversion",
    roleSwitchThreshold: 0.15,
    maxGoals: 2,
  },
  activation_first: {
    id: "activation_first",
    label: "Activation first",
    description: "Ranks by how quickly cohorts start using tools, on the theory that activation drives conversion.",
    minSample: 4,
    rank: "activation",
    roleSwitchThreshold: 0.2,
    maxGoals: 2,
  },
  aggressive: {
    id: "aggressive",
    label: "Aggressive blended",
    description: "Blends activation and conversion, needs less data and surfaces more suggestions.",
    minSample: 3,
    rank: "blended",
    roleSwitchThreshold: 0.1,
    maxGoals: 3,
  },
};

export const EXPERIMENT_VARIANTS = Object.keys(
  RECOMMENDATION_STRATEGIES,
) as ExperimentVariantId[];

/** Stable 32-bit hash so a user always lands in the same bucket. */
function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export const EXPERIMENT_KEY = "persona_reco_v1";

export function assignVariant(userId: string | null | undefined): ExperimentVariantId {
  if (!userId) return "control";
  return EXPERIMENT_VARIANTS[hashString(`${EXPERIMENT_KEY}:${userId}`) % EXPERIMENT_VARIANTS.length];
}

export const getStrategy = (variant: ExperimentVariantId): RecommendationStrategy =>
  RECOMMENDATION_STRATEGIES[variant] ?? RECOMMENDATION_STRATEGIES.control;

/** Records that a user saw recommendations from a given variant (once per session). */
const seen = new Set<string>();

export function trackRecommendationShown(
  variant: ExperimentVariantId,
  metadata: Record<string, unknown> = {},
) {
  if (seen.has(variant)) return;
  seen.add(variant);
  void trackPersonaEvent("recommendation_shown" as never, {
    metadata: { experiment: EXPERIMENT_KEY, variant, ...metadata },
  });
}

export function trackRecommendationApplied(
  variant: ExperimentVariantId,
  metadata: Record<string, unknown> = {},
) {
  void trackPersonaEvent("recommendation_applied" as never, {
    metadata: { experiment: EXPERIMENT_KEY, variant, ...metadata },
  });
}

export type ExperimentVariantStat = {
  id: string;
  users: number;
  applied_users: number;
  converted_users: number;
  conversions: number;
};

export type ExperimentAnalytics = {
  total_exposed: number;
  variants: ExperimentVariantStat[];
};

export const EMPTY_EXPERIMENT: ExperimentAnalytics = { total_exposed: 0, variants: [] };

export const applyRate = (stat: ExperimentVariantStat) =>
  stat.users > 0 ? stat.applied_users / stat.users : 0;

export const variantConversionRate = (stat: ExperimentVariantStat) =>
  stat.users > 0 ? stat.converted_users / stat.users : 0;

/** Minimum exposed users per arm before we call a winner. */
export const MIN_ARM_SAMPLE = 20;

export type ExperimentSummary = {
  rows: (ExperimentVariantStat & {
    label: string;
    description: string;
    applyPct: number;
    conversionPct: number;
    lift: number | null;
    isControl: boolean;
  })[];
  leader: { id: string; label: string; lift: number } | null;
  hasEnoughData: boolean;
};

export function summarizeExperiment(analytics: ExperimentAnalytics): ExperimentSummary {
  const byId = new Map(analytics.variants.map((v) => [v.id, v]));
  const control = byId.get("control");
  const controlRate = control ? variantConversionRate(control) : 0;

  const rows = EXPERIMENT_VARIANTS.map((id) => {
    const strategy = RECOMMENDATION_STRATEGIES[id];
    const stat: ExperimentVariantStat =
      byId.get(id) ?? { id, users: 0, applied_users: 0, converted_users: 0, conversions: 0 };
    const rate = variantConversionRate(stat);
    return {
      ...stat,
      label: strategy.label,
      description: strategy.description,
      applyPct: Math.round(applyRate(stat) * 100),
      conversionPct: Math.round(rate * 100),
      lift:
        id === "control" || !control || control.users === 0
          ? null
          : Math.round((rate - controlRate) * 100),
      isControl: id === "control",
    };
  });

  const eligible = rows.filter((r) => r.users >= MIN_ARM_SAMPLE);
  const hasEnoughData = eligible.length >= 2 && !!control && control.users >= MIN_ARM_SAMPLE;

  let leader: ExperimentSummary["leader"] = null;
  if (hasEnoughData) {
    const best = [...eligible].sort((a, b) => b.conversionPct - a.conversionPct)[0];
    if (best && !best.isControl && (best.lift ?? 0) > 0) {
      leader = { id: best.id, label: best.label, lift: best.lift ?? 0 };
    }
  }

  return { rows, leader, hasEnoughData };
}
