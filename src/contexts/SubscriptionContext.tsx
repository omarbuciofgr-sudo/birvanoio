import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionTier = "starter" | "growth" | "scale" | "enterprise" | null;

// Feature definitions by tier
export const TIER_FEATURES = {
  starter: [
    "crm_access",
    "click_to_call",
    "call_recording",
    "sms_tools",
    "email_tools",
    "csv_import",
    "csv_export",
    "basic_templates",
    "kanban_view",
  ],
  growth: [
    // Includes all starter features
    "crm_access",
    "click_to_call",
    "call_recording",
    "sms_tools",
    "email_tools",
    "csv_import",
    "csv_export",
    "basic_templates",
    "kanban_view",
    // Growth-specific features
    "ai_call_recaps",
    "lead_scoring",
    "sentiment_analysis",
    "ai_templates",
    "ai_voice_agent_limited",
  ],
  scale: [
    // Includes all growth features
    "crm_access",
    "click_to_call",
    "call_recording",
    "sms_tools",
    "email_tools",
    "csv_import",
    "csv_export",
    "basic_templates",
    "kanban_view",
    "ai_call_recaps",
    "lead_scoring",
    "sentiment_analysis",
    "ai_templates",
    "ai_voice_agent_limited",
    // Scale-specific features
    "ai_voice_agent_unlimited",
    "ai_weekly_digest",
    "call_transcription",
    "webhook_integrations",
    "api_access",
    // Self-service scraper
    "basic_scraper",
    "scraper_50_leads_month",
  ],
  enterprise: [
    // All scale features plus unlimited scraping
    "crm_access",
    "click_to_call",
    "call_recording",
    "sms_tools",
    "email_tools",
    "csv_import",
    "csv_export",
    "basic_templates",
    "kanban_view",
    "ai_call_recaps",
    "lead_scoring",
    "sentiment_analysis",
    "ai_templates",
    "ai_voice_agent_limited",
    "ai_voice_agent_unlimited",
    "ai_weekly_digest",
    "call_transcription",
    "webhook_integrations",
    "api_access",
    "basic_scraper",
    "scraper_50_leads_month",
    // Enterprise scraper features
    "unlimited_scraper",
    "prospect_search",
    "industry_search",
    "real_estate_scraper",
    "skip_tracing",
    "waterfall_enrichment",
    "priority_support",
    "custom_integrations",
  ],
} as const;

export type Feature = typeof TIER_FEATURES[keyof typeof TIER_FEATURES][number];

interface SubscriptionState {
  isLoading: boolean;
  subscribed: boolean;
  tier: SubscriptionTier;
  subscriptionEnd: string | null;
  error: string | null;
}

interface SubscriptionContextType extends SubscriptionState {
  checkSubscription: () => Promise<void>;
  hasFeature: (feature: Feature) => boolean;
  canAccessTier: (requiredTier: SubscriptionTier) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const TIER_HIERARCHY: SubscriptionTier[] = ["starter", "growth", "scale", "enterprise"];

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SubscriptionState>({
    isLoading: true,
    subscribed: false,
    tier: null,
    subscriptionEnd: null,
    error: null,
  });

  const checkSubscription = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setState({
          isLoading: false,
          subscribed: false,
          tier: null,
          subscriptionEnd: null,
          error: null,
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("check-subscription");

      if (error) {
        console.error("Subscription check error:", error);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error.message,
        }));
        return;
      }

      setState({
        isLoading: false,
        subscribed: data.subscribed,
        tier: data.tier as SubscriptionTier,
        subscriptionEnd: data.subscription_end,
        error: null,
      });
    } catch (err) {
      console.error("Failed to check subscription:", err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: "Failed to check subscription status",
      }));
    }
  }, []);

  const hasFeature = useCallback((feature: Feature): boolean => {
    if (!state.tier) return false;
    const tierFeatures = TIER_FEATURES[state.tier];
    return tierFeatures.includes(feature as never);
  }, [state.tier]);

  const canAccessTier = useCallback((requiredTier: SubscriptionTier): boolean => {
    if (!state.tier || !requiredTier) return false;
    const userTierIndex = TIER_HIERARCHY.indexOf(state.tier);
    const requiredTierIndex = TIER_HIERARCHY.indexOf(requiredTier);
    return userTierIndex >= requiredTierIndex;
  }, [state.tier]);

  // Check subscription on mount and auth state changes
  useEffect(() => {
    checkSubscription();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkSubscription();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkSubscription]);

  // Periodic refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (state.subscribed) {
        checkSubscription();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [state.subscribed, checkSubscription]);

  return (
    <SubscriptionContext.Provider
      value={{
        ...state,
        checkSubscription,
        hasFeature,
        canAccessTier,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
};
