import { useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePersona } from "@/hooks/usePersona";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  buildRecommendations,
  fetchPersonaAnalytics,
  EMPTY_ANALYTICS,
} from "@/lib/analytics/personaAnalytics";
import {
  assignVariant,
  getStrategy,
  trackRecommendationApplied,
  trackRecommendationShown,
  EMPTY_EXPERIMENT,
  summarizeExperiment,
  type ExperimentAnalytics,
} from "@/lib/analytics/personaExperiment";

async function fetchExperimentAnalytics(): Promise<ExperimentAnalytics> {
  const { data, error } = await supabase.rpc("get_persona_experiment_analytics" as any);
  if (error) throw error;
  const parsed = (data ?? {}) as Partial<ExperimentAnalytics>;
  return {
    total_exposed: parsed.total_exposed ?? 0,
    variants: parsed.variants ?? [],
  };
}

export const usePersonaAnalytics = () => {
  const { persona, loading: personaLoading } = usePersona();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["persona-analytics"],
    queryFn: fetchPersonaAnalytics,
    staleTime: 5 * 60 * 1000,
  });

  const experimentQuery = useQuery({
    queryKey: ["persona-experiment-analytics"],
    queryFn: fetchExperimentAnalytics,
    staleTime: 5 * 60 * 1000,
  });

  const analytics = query.data ?? EMPTY_ANALYTICS;
  const variant = useMemo(() => assignVariant(user?.id), [user?.id]);
  const strategy = useMemo(() => getStrategy(variant), [variant]);

  const recommendations = useMemo(
    () => buildRecommendations(analytics, persona.role, persona.goals, strategy),
    [analytics, persona.role, persona.goals, strategy],
  );

  const hasRecommendations =
    recommendations.hasEnoughData &&
    (recommendations.suggestedGoals.length > 0 || !!recommendations.suggestedRole);

  /** Record exposure once the user actually has suggestions rendered. */
  useEffect(() => {
    if (!user?.id || query.isLoading || !hasRecommendations) return;
    trackRecommendationShown(variant, {
      role: persona.role,
      suggested_goals: recommendations.suggestedGoals.map((g) => g.id),
      suggested_role: recommendations.suggestedRole?.id ?? null,
    });
  }, [user?.id, query.isLoading, hasRecommendations, variant, persona.role, recommendations]);

  const trackApplied = useCallback(
    (metadata: Record<string, unknown> = {}) =>
      trackRecommendationApplied(variant, { role: persona.role, ...metadata }),
    [variant, persona.role],
  );

  const experiment = experimentQuery.data ?? EMPTY_EXPERIMENT;
  const experimentSummary = useMemo(() => summarizeExperiment(experiment), [experiment]);

  return {
    analytics,
    recommendations,
    hasRecommendations,
    persona,
    variant,
    strategy,
    trackApplied,
    experiment,
    experimentSummary,
    experimentLoading: experimentQuery.isLoading,
    isLoading: query.isLoading || personaLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

export default usePersonaAnalytics;
