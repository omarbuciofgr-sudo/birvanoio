import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription, SubscriptionTier } from "@/contexts/SubscriptionContext";

const TIER_CREDIT_LIMITS: Record<string, number> = {
  free: 25,
  starter: 100,
  growth: 300,
  scale: 1000,
  enterprise: Infinity,
};

export interface CreditInfo {
  creditsUsed: number;
  creditLimit: number;
  oneTimeCredits: number;
  remaining: number;
  isAtLimit: boolean;
  isLoading: boolean;
}

export function useEnrichmentCredits() {
  const { tier } = useSubscription();
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [oneTimeCredits, setOneTimeCredits] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const effectiveTier = tier || "free";
  const creditLimit = TIER_CREDIT_LIMITS[effectiveTier] ?? 25;
  const totalAvailable = creditLimit + oneTimeCredits;
  const remaining = Math.max(0, totalAvailable - creditsUsed);
  const isAtLimit = remaining <= 0 && creditLimit !== Infinity;

  const fetchUsage = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        return;
      }

      const periodStart = new Date();
      periodStart.setDate(1);
      const periodStr = periodStart.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("enrichment_credit_usage")
        .select("credits_used, one_time_credits")
        .eq("user_id", session.user.id)
        .eq("period_start", periodStr)
        .maybeSingle();

      if (!error && data) {
        setCreditsUsed(data.credits_used);
        setOneTimeCredits(data.one_time_credits);
      } else {
        setCreditsUsed(0);
        setOneTimeCredits(0);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deductCredits = useCallback(async (count: number) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const periodStart = new Date();
    periodStart.setDate(1);
    const periodStr = periodStart.toISOString().slice(0, 10);

    // Upsert usage record
    const { data: existing } = await supabase
      .from("enrichment_credit_usage")
      .select("id, credits_used, one_time_credits")
      .eq("user_id", session.user.id)
      .eq("period_start", periodStr)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("enrichment_credit_usage")
        .update({ credits_used: existing.credits_used + count })
        .eq("id", existing.id);
      if (error) return false;
      setCreditsUsed(existing.credits_used + count);
    } else {
      const { error } = await supabase
        .from("enrichment_credit_usage")
        .insert({
          user_id: session.user.id,
          period_start: periodStr,
          credits_used: count,
        });
      if (error) return false;
      setCreditsUsed(count);
    }
    return true;
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return {
    creditsUsed,
    creditLimit,
    oneTimeCredits,
    remaining,
    isAtLimit,
    isLoading,
    deductCredits,
    refreshCredits: fetchUsage,
    tier: effectiveTier as SubscriptionTier | "free",
  };
}
