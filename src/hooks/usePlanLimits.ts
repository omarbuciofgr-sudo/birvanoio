import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/contexts/SubscriptionContext";

export interface PlanLimits {
  max_targets_per_job: number;
  max_pages_per_domain: number;
  max_concurrent_jobs: number;
  max_provider_calls_per_lead: number;
  confidence_stop_threshold: number;
}

const DEFAULT_LIMITS: PlanLimits = {
  max_targets_per_job: 10,
  max_pages_per_domain: 3,
  max_concurrent_jobs: 1,
  max_provider_calls_per_lead: 2,
  confidence_stop_threshold: 0.80,
};

const skipOptionalTables = import.meta.env.VITE_SKIP_OPTIONAL_TABLES === "true";

export function usePlanLimits() {
  const { tier } = useSubscription();
  const effectiveTier = tier || "free";

  const { data: limits, isLoading } = useQuery({
    queryKey: ["plan-limits", effectiveTier],
    queryFn: async () => {
      if (skipOptionalTables) return DEFAULT_LIMITS;
      try {
        const { data, error } = await supabase
          .from("plan_limits")
          .select("*")
          .eq("tier", effectiveTier)
          .maybeSingle();
        if (error || !data) return DEFAULT_LIMITS;
        return data as PlanLimits;
      } catch {
        return DEFAULT_LIMITS;
      }
    },
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    limits: limits || DEFAULT_LIMITS,
    isLoading,
    tier: effectiveTier,
  };
}
