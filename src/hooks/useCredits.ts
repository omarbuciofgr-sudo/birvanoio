import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription, SubscriptionTier } from "@/contexts/SubscriptionContext";
import { DEFAULT_ACTION_COSTS, DEFAULT_PLAN_RULES, usePricingSettings } from "@/hooks/usePricingSettings";

/**
 * Local-only escape hatch: set `VITE_BYPASS_CREDITS=true` in `.env` and restart Vite.
 * Skips balance checks and does not insert into `credit_usage` — production should leave this unset/false.
 */
export const creditsBypassed =
  typeof import.meta !== "undefined" &&
  String(import.meta.env?.VITE_BYPASS_CREDITS ?? "").toLowerCase() === "true";

// Credit costs per action
export const CREDIT_COSTS = {
  scrape: DEFAULT_ACTION_COSTS.city_search,
  enrich: 2,
  search: 0, // finding companies is free — enrichment costs credits
  lead_score: 1,
  sentiment: 1,
  skip_trace: DEFAULT_ACTION_COSTS.owner_contact,
  // These are unlimited (no credit cost)
  email: 0,
  sms: DEFAULT_ACTION_COSTS.sms,
  call: DEFAULT_ACTION_COSTS.voice_minute,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

// Monthly credit allowance per tier
const TIER_CREDITS: Record<string, number> = {
  free: 50,
  starter: DEFAULT_PLAN_RULES.starter.credits,
  growth: DEFAULT_PLAN_RULES.growth.credits,
  scale: DEFAULT_PLAN_RULES.scale.credits,
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
  const { actionCosts, plans } = usePricingSettings();
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [bonusCredits, setBonusCredits] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const effectiveTier = (subscribed && tier) ? tier : "free";
  const monthlyAllowance = plans[effectiveTier as keyof typeof plans]?.credits ?? TIER_CREDITS[effectiveTier] ?? 50;
  const totalAvailable = monthlyAllowance + bonusCredits;
  const remaining = monthlyAllowance === Infinity ? Infinity : Math.max(0, totalAvailable - creditsUsed);
  const isAtLimit =
    !creditsBypassed && remaining <= 0 && monthlyAllowance !== Infinity;

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
    if (creditsBypassed) return true;
    const mappedAction = action === "scrape" ? "city_search" : action === "skip_trace" ? "owner_contact" : action === "call" ? "voice_minute" : action;
    const cost = (actionCosts[mappedAction as keyof typeof actionCosts] ?? CREDIT_COSTS[action]) * count;
    if (cost === 0) return true; // unlimited actions
    if (monthlyAllowance === Infinity) return true;
    return remaining >= cost;
  }, [remaining, monthlyAllowance, actionCosts]);

  const spendCredits = useCallback(async (action: CreditAction, count: number = 1, referenceId?: string): Promise<boolean> => {
    if (creditsBypassed) return true;

    const mappedAction = action === "scrape" ? "city_search" : action === "skip_trace" ? "owner_contact" : action === "call" ? "voice_minute" : action;
    const cost = actionCosts[mappedAction as keyof typeof actionCosts] ?? CREDIT_COSTS[action];
    if (cost === 0) return true; // unlimited actions

    const totalCost = cost * count;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const actionKey = `action_${mappedAction}`;
    const { data, error } = await supabase.functions.invoke("consume-credits", {
      body: { actionKey, units: count, referenceId },
    });
    if (error || !data?.success) return false;

    setCreditsUsed(prev => prev + totalCost);
    return true;
  }, [actionCosts]);

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
    creditsBypassed,
    canAfford,
    spendCredits,
    refreshCredits: fetchUsage,
  };
}
