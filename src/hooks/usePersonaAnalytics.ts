import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePersona } from "@/hooks/usePersona";
import {
  buildRecommendations,
  fetchPersonaAnalytics,
  EMPTY_ANALYTICS,
} from "@/lib/analytics/personaAnalytics";

export const usePersonaAnalytics = () => {
  const { persona, loading: personaLoading } = usePersona();

  const query = useQuery({
    queryKey: ["persona-analytics"],
    queryFn: fetchPersonaAnalytics,
    staleTime: 5 * 60 * 1000,
  });

  const analytics = query.data ?? EMPTY_ANALYTICS;

  const recommendations = useMemo(
    () => buildRecommendations(analytics, persona.role, persona.goals),
    [analytics, persona.role, persona.goals],
  );

  return {
    analytics,
    recommendations,
    persona,
    isLoading: query.isLoading || personaLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

export default usePersonaAnalytics;
