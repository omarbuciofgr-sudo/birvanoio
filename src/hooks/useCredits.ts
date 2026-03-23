import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription, SubscriptionTier } from "@/contexts/SubscriptionContext";

// Credit costs per action
export const CREDIT_COSTS = {
  scrape: 1,
  enrich: 2,
  search: 0, // finding companies is free — enrichment costs credits
  lead_score: 1,
  sentiment: 1,
  skip_trace: 5,
  // These are unlimited (no credit cost)
  email: 0,
  sms: 0,
  call: 0,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

// Monthly credit allowance per tier
const TIER_CREDITS: Record<string, number> = {
  free: 50,
  starter: 500,
  growth: 2000,
  scale: 10000,
  enterprise: Infinity,
};

export interface CreditState {
  creditsUsed: number;
  monthlyAllowance: number;
  bonusCredits: number;
  remaining: number;
  isAtLimit: boolean;
  isLoading: boolean;
  tier: SubscriptionTier | "free";
}

export function useCredits() {
  const { tier, subscribed } = useSubscription();
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [bonusCredits, setBonusCredits] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const effectiveTier = (subscribed && tier) ? tier : "free";
  const monthlyAllowance = TIER_CREDITS[effectiveTier] ?? 50;
  const totalAvailable = monthlyAllowance + bonusCredits;
  const remaining = monthlyAllowance === Infinity ? Infinity : Math.max(0, totalAvailable - creditsUsed);
  const isAtLimit = remaining <= 0 && monthlyAllowance !== Infinity;

  const fetchUsage = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        return;
      }

      // Get credits used this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: usageData, error: usageError } = await supabase
        .from("credit_usage")
        .select("credits_spent")
        .eq("user_id", session.user.id)
        .gte("created_at", startOfMonth.toISOString());

      if (!usageError && usageData) {
        const total = usageData.reduce((sum, row) => sum + (row.credits_spent || 0), 0);
        setCreditsUsed(total);
      }

      // Get bonus credits
      const { data: balanceData } = await supabase
        .from("credit_balances")
        .select("bonus_credits")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (balanceData) {
        setBonusCredits(balanceData.bonus_credits);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const canAfford = useCallback((action: CreditAction, count: number = 1): boolean => {
    const cost = CREDIT_COSTS[action] * count;
    if (cost === 0) return true; // unlimited actions
    if (monthlyAllowance === Infinity) return true;
    return remaining >= cost;
  }, [remaining, monthlyAllowance]);

  const spendCredits = useCallback(async (action: CreditAction, count: number = 1, referenceId?: string): Promise<boolean> => {
    const cost = CREDIT_COSTS[action];
    if (cost === 0) return true; // unlimited actions

    const totalCost = cost * count;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    // Insert usage records
    const records = Array.from({ length: count }, () => ({
      user_id: session.user.id,
      action,
      credits_spent: cost,
      reference_id: referenceId || null,
    }));

    const { error } = await supabase.from("credit_usage").insert(records);
    if (error) return false;

    setCreditsUsed(prev => prev + totalCost);
    return true;
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return {
    creditsUsed,
    monthlyAllowance,
    bonusCredits,
    remaining,
    isAtLimit,
    isLoading,
    tier: effectiveTier as SubscriptionTier | "free",
    canAfford,
    spendCredits,
    refreshCredits: fetchUsage,
  };
}
