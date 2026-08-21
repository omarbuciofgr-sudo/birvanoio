/**
 * Persona analytics: records milestone events tied to a user's role + goals and
 * turns the aggregated results into role / workspace-focus recommendations.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  PERSONA_ROLES,
  getGoalsForRole,
  getRole,
  type PersonaRoleId,
} from "@/lib/persona";

export type PersonaEventType =
  | "persona_selected"
  | "activation"
  | "conversion"
  | "recommendation_shown"
  | "recommendation_applied";

export type PersonaRoleStat = {
  id: string;
  users: number;
  activated_users: number;
  converted_users: number;
  conversions: number;
};

export type PersonaGoalStat = PersonaRoleStat & { role: string | null };

export type PersonaAnalytics = {
  total_users: number;
  roles: PersonaRoleStat[];
  goals: PersonaGoalStat[];
};

export const EMPTY_ANALYTICS: PersonaAnalytics = {
  total_users: 0,
  roles: [],
  goals: [],
};

/** Fire-and-forget event capture. Never throws — analytics must not break flows. */
export async function trackPersonaEvent(
  eventType: PersonaEventType,
  options: {
    role?: string | null;
    goals?: string[] | null;
    weight?: number;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return;

    let role = options.role ?? null;
    let goals = options.goals ?? null;

    if (role == null || goals == null) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("persona_role, persona_goals")
        .eq("user_id", userId)
        .maybeSingle();
      role = role ?? ((profile as any)?.persona_role ?? null);
      goals = goals ?? (((profile as any)?.persona_goals as string[] | null) ?? []);
    }

    await supabase.from("persona_events" as any).insert({
      user_id: userId,
      persona_role: role,
      persona_goals: goals ?? [],
      event_type: eventType,
      weight: options.weight ?? 1,
      metadata: options.metadata ?? {},
    } as any);
  } catch {
    /* analytics is best-effort */
  }
}

export const trackActivation = (feature: string, metadata: Record<string, unknown> = {}) =>
  trackPersonaEvent("activation", { metadata: { feature, ...metadata } });

export const trackConversion = (kind: string, metadata: Record<string, unknown> = {}) =>
  trackPersonaEvent("conversion", { metadata: { kind, ...metadata } });

export async function fetchPersonaAnalytics(): Promise<PersonaAnalytics> {
  const { data, error } = await supabase.rpc("get_persona_analytics" as any);
  if (error) throw error;
  const parsed = (data ?? {}) as Partial<PersonaAnalytics>;
  return {
    total_users: parsed.total_users ?? 0,
    roles: parsed.roles ?? [],
    goals: parsed.goals ?? [],
  };
}

export const conversionRate = (stat?: Pick<PersonaRoleStat, "users" | "converted_users">) =>
  stat && stat.users > 0 ? stat.converted_users / stat.users : 0;

export const activationRate = (stat?: Pick<PersonaRoleStat, "users" | "activated_users">) =>
  stat && stat.users > 0 ? stat.activated_users / stat.users : 0;

/** Minimum cohort size before a stat is trustworthy enough to recommend on. */
export const MIN_SAMPLE = 5;

export type PersonaRecommendation = {
  /** Goal ids the user has not selected but that convert well for their role. */
  suggestedGoals: { id: string; label: string; rate: number; users: number }[];
  /** A different role that converts materially better, if any. */
  suggestedRole: { id: string; label: string; rate: number; users: number } | null;
  /** Conversion rate of the user's current role cohort. */
  currentRoleRate: number | null;
  hasEnoughData: boolean;
};

/** Knobs the A/B experiment varies. Defaults reproduce the original behaviour. */
export type RecommendationTuning = {
  minSample: number;
  rank: "conversion" | "activation" | "blended";
  roleSwitchThreshold: number;
  maxGoals: number;
};

export const DEFAULT_TUNING: RecommendationTuning = {
  minSample: MIN_SAMPLE,
  rank: "conversion",
  roleSwitchThreshold: 0.15,
  maxGoals: 2,
};

const scoreBy = (tuning: RecommendationTuning, stat: PersonaRoleStat) => {
  if (tuning.rank === "activation") return activationRate(stat);
  if (tuning.rank === "blended") return 0.5 * activationRate(stat) + 0.5 * conversionRate(stat);
  return conversionRate(stat);
};

export function buildRecommendations(
  analytics: PersonaAnalytics,
  currentRole: string | null,
  currentGoals: string[],
  tuning: RecommendationTuning = DEFAULT_TUNING,
): PersonaRecommendation {
  const roleStats = new Map(analytics.roles.map((r) => [r.id, r]));
  const current = currentRole ? roleStats.get(currentRole) : undefined;
  const currentRate = current ? conversionRate(current) : null;

  const eligibleRoles = analytics.roles.filter((r) => r.users >= tuning.minSample);
  const hasEnoughData = eligibleRoles.length > 0;

  // Goal suggestions: goals within the user's role that beat their current mix.
  const roleGoals = getGoalsForRole(currentRole);
  const goalStats = new Map(
    analytics.goals
      .filter((g) => !currentRole || g.role === currentRole)
      .map((g) => [g.id, g]),
  );

  const selectedRates = currentGoals
    .map((id) => goalStats.get(id))
    .filter((s): s is PersonaGoalStat => !!s && s.users >= tuning.minSample)
    .map((stat) => scoreBy(tuning, stat));
  const baseline = selectedRates.length
    ? selectedRates.reduce((a, b) => a + b, 0) / selectedRates.length
    : 0;

  const suggestedGoals = roleGoals
    .filter((g) => !currentGoals.includes(g.id))
    .map((g) => ({ goal: g, stat: goalStats.get(g.id) }))
    .filter(({ stat }) => !!stat && stat.users >= tuning.minSample)
    .map(({ goal, stat }) => ({
      id: goal.id,
      label: goal.label,
      rate: scoreBy(tuning, stat!),
      users: stat!.users,
    }))
    .filter((g) => g.rate > baseline)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, tuning.maxGoals);

  // Role suggestion: only when another cohort converts at least 15pp better.
  let suggestedRole: PersonaRecommendation["suggestedRole"] = null;
  const best = [...eligibleRoles]
    .filter((r) => r.id !== currentRole)
    .sort((a, b) => conversionRate(b) - conversionRate(a))[0];
  if (best && conversionRate(best) - (currentRate ?? 0) >= tuning.roleSwitchThreshold) {
    suggestedRole = {
      id: best.id,
      label: getRole(best.id)?.label ?? best.id,
      rate: conversionRate(best),
      users: best.users,
    };
  }

  return { suggestedGoals, suggestedRole, currentRoleRate: currentRate, hasEnoughData };
}

/** Chart-ready rows for every known role, including ones with no data yet. */
export function roleChartRows(analytics: PersonaAnalytics) {
  return PERSONA_ROLES.map((role) => {
    const stat = analytics.roles.find((r) => r.id === role.id);
    return {
      id: role.id as PersonaRoleId,
      name: role.label.split(" / ")[0],
      users: stat?.users ?? 0,
      activation: Math.round(activationRate(stat) * 100),
      conversion: Math.round(conversionRate(stat) * 100),
      conversions: stat?.conversions ?? 0,
    };
  });
}

/** Chart-ready rows for goals, optionally scoped to one role. */
export function goalChartRows(analytics: PersonaAnalytics, roleId?: string | null) {
  const rows = analytics.goals.filter((g) => (roleId ? g.role === roleId : true));
  return rows
    .map((stat) => {
      const label =
        getGoalsForRole(stat.role).find((g) => g.id === stat.id)?.label ?? stat.id;
      return {
        id: stat.id,
        name: label,
        role: stat.role,
        users: stat.users,
        activation: Math.round(activationRate(stat) * 100),
        conversion: Math.round(conversionRate(stat) * 100),
        conversions: stat.conversions,
      };
    })
    .sort((a, b) => b.conversion - a.conversion || b.users - a.users);
}
