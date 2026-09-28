import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_ACTION_COSTS = {
  city_search: 1,
  owner_contact: 10,
  ai_message: 0,
  sms: 1,
  voice_minute: 10,
  email: 0,
} as const;

export const DEFAULT_PLAN_RULES = {
  free: { credits: 50, aiMessages: 20 },
  starter: { credits: 1000, aiMessages: 300 },
  growth: { credits: 2500, aiMessages: 1000 },
  scale: { credits: 7500, aiMessages: 3000 },
  enterprise: { credits: 7500, aiMessages: 3000 },
} as const;

type ActionKey = keyof typeof DEFAULT_ACTION_COSTS;
type PlanKey = keyof typeof DEFAULT_PLAN_RULES;

export function usePricingSettings() {
  const [rows, setRows] = useState<Array<{
    setting_key: string;
    credits: number | null;
    monthly_credits_per_seat: number | null;
    ai_messages_per_seat: number | null;
    price_cents: number | null;
  }>>([]);

  useEffect(() => {
    supabase
      .from("pricing_settings")
      .select("setting_key, credits, monthly_credits_per_seat, ai_messages_per_seat, price_cents")
      .eq("is_active", true)
      .then(({ data }) => setRows(data ?? []));
  }, []);

  return useMemo(() => {
    const byKey = Object.fromEntries(rows.map((row) => [row.setting_key, row]));
    const actionCosts = Object.fromEntries(
      Object.entries(DEFAULT_ACTION_COSTS).map(([key, fallback]) => [
        key,
        byKey[`action_${key}`]?.credits ?? fallback,
      ]),
    ) as Record<ActionKey, number>;
    const plans = Object.fromEntries(
      Object.entries(DEFAULT_PLAN_RULES).map(([key, fallback]) => [
        key,
        {
          credits: byKey[`plan_${key}`]?.monthly_credits_per_seat ?? fallback.credits,
          aiMessages: byKey[`plan_${key}`]?.ai_messages_per_seat ?? fallback.aiMessages,
        },
      ]),
    ) as Record<PlanKey, { credits: number; aiMessages: number }>;

    return {
      actionCosts,
      plans,
      addon: {
        credits: byKey.addon_500?.credits ?? 500,
        priceCents: byKey.addon_500?.price_cents ?? 2500,
      },
    };
  }, [rows]);
}