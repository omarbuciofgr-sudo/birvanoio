import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionTier = "free" | "starter" | "growth" | "scale" | "enterprise" | null;
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer" | null;
export type BillingStatus = "active" | "past_due" | "canceled" | "trialing" | "incomplete" | null;

// Feature definitions by tier
export const TIER_FEATURES = {
  free: [
    "crm_access",
    "basic_scraper",
  ],
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
    "basic_scraper",
  ],
  growth: [
    "crm_access",
    "click_to_call",
    "call_recording",
    "sms_tools",
    "email_tools",
    "csv_import",
    "csv_export",
    "basic_templates",
    "kanban_view",
    "basic_scraper",
    "ai_call_recaps",
    "lead_scoring",
    "sentiment_analysis",
    "ai_templates",
    "ai_voice_agent_limited",
  ],
  scale: [
    "crm_access",
    "click_to_call",
    "call_recording",
    "sms_tools",
    "email_tools",
    "csv_import",
    "csv_export",
    "basic_templates",
    "kanban_view",
    "basic_scraper",
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
    "scraper_50_leads_month",
    "prospect_search",
    "industry_search",
    "real_estate_scraper",
    "skip_tracing",
    "waterfall_enrichment",
  ],
  enterprise: [
    "crm_access",
    "click_to_call",
    "call_recording",
    "sms_tools",
    "email_tools",
    "csv_import",
    "csv_export",
    "basic_templates",
    "kanban_view",
    "basic_scraper",
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
    "scraper_50_leads_month",
    "prospect_search",
    "industry_search",
    "real_estate_scraper",
    "skip_tracing",
    "waterfall_enrichment",
    "unlimited_scraper",
    "priority_support",
    "custom_integrations",
  ],
} as const;

export type Feature = typeof TIER_FEATURES[keyof typeof TIER_FEATURES][number];

interface SubscriptionState {
  isLoading: boolean;
  subscribed: boolean;
  tier: SubscriptionTier;
  billingStatus: BillingStatus;
  subscriptionEnd: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
  workspaceRole: WorkspaceRole;
  seatsPurchased: number;
  seatsUsed: number;
  creditsRemaining: number;
  creditsAllowance: number;
  creditsUsed: number;
  error: string | null;
}

interface SubscriptionContextType extends SubscriptionState {
  checkSubscription: () => Promise<void>;
  hasFeature: (feature: Feature) => boolean;
  canAccessTier: (requiredTier: SubscriptionTier) => boolean;
  isWorkspaceOwnerOrAdmin: boolean;
  /** True when billing_status is past_due — blocks new jobs/enrichment */
  isPastDue: boolean;
  /** True when billing_status is canceled — read-only mode */
  isCanceled: boolean;
  /** True when workspace can run new jobs (active or trialing) */
  canRunJobs: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const TIER_HIERARCHY: SubscriptionTier[] = ["free", "starter", "growth", "scale", "enterprise"];

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SubscriptionState>({
    isLoading: true,
    subscribed: false,
    tier: null,
    billingStatus: null,
    subscriptionEnd: null,
    workspaceId: null,
    workspaceName: null,
    workspaceRole: null,
    seatsPurchased: 0,
    seatsUsed: 0,
    creditsRemaining: 0,
    creditsAllowance: 0,
    creditsUsed: 0,
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
          billingStatus: null,
          subscriptionEnd: null,
          workspaceId: null,
          workspaceName: null,
          workspaceRole: null,
          seatsPurchased: 0,
          seatsUsed: 0,
          creditsRemaining: 0,
          creditsAllowance: 0,
          creditsUsed: 0,
          error: null,
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("check-subscription");

      if (error) {
        console.error("Subscription check error:", error);
        setState(prev => ({ ...prev, isLoading: false, error: error.message }));
        return;
      }

      setState({
        isLoading: false,
        subscribed: data.subscribed,
        tier: data.tier as SubscriptionTier,
        billingStatus: (data.billing_status as BillingStatus) || null,
        subscriptionEnd: data.subscription_end,
        workspaceId: data.workspace_id,
        workspaceName: data.workspace_name,
        workspaceRole: data.workspace_role as WorkspaceRole,
        seatsPurchased: data.seats_purchased ?? 0,
        seatsUsed: data.seats_used ?? 0,
        creditsRemaining: data.credits_remaining ?? 0,
        creditsAllowance: data.credits_allowance ?? 0,
        creditsUsed: data.credits_used ?? 0,
        error: null,
      });
    } catch (err) {
      console.error("Failed to check subscription:", err);
      setState(prev => ({ ...prev, isLoading: false, error: "Failed to check subscription status" }));
    }
  }, []);

  const hasFeature = useCallback((feature: Feature): boolean => {
    if (!state.tier) return false;
    const tierFeatures = TIER_FEATURES[state.tier];
    return (tierFeatures as readonly string[]).includes(feature);
  }, [state.tier]);

  const canAccessTier = useCallback((requiredTier: SubscriptionTier): boolean => {
    if (!state.tier || !requiredTier) return false;
    const userTierIndex = TIER_HIERARCHY.indexOf(state.tier);
    const requiredTierIndex = TIER_HIERARCHY.indexOf(requiredTier);
    return userTierIndex >= requiredTierIndex;
  }, [state.tier]);

  const isWorkspaceOwnerOrAdmin = state.workspaceRole === "owner" || state.workspaceRole === "admin";
  const isPastDue = state.billingStatus === "past_due";
  const isCanceled = state.billingStatus === "canceled";
  const canRunJobs = state.billingStatus === "active" || state.billingStatus === "trialing";

  useEffect(() => {
    checkSubscription();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkSubscription();
    });
    return () => subscription.unsubscribe();
  }, [checkSubscription]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (state.subscribed) checkSubscription();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [state.subscribed, checkSubscription]);

  return (
    <SubscriptionContext.Provider
      value={{ ...state, checkSubscription, hasFeature, canAccessTier, isWorkspaceOwnerOrAdmin, isPastDue, isCanceled, canRunJobs }}
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
