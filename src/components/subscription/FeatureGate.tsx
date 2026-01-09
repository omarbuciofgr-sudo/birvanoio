import React from "react";
import { useSubscription, Feature, SubscriptionTier } from "@/contexts/SubscriptionContext";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface FeatureGateProps {
  feature: Feature;
  children: React.ReactNode;
  requiredTier?: SubscriptionTier;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}

const TIER_NAMES: Record<string, string> = {
  starter: "Starter",
  growth: "Growth",
  scale: "Scale",
};

const FEATURE_TIER_MAP: Record<Feature, SubscriptionTier> = {
  // Starter features
  crm_access: "starter",
  click_to_call: "starter",
  call_recording: "starter",
  sms_tools: "starter",
  email_tools: "starter",
  csv_import: "starter",
  csv_export: "starter",
  basic_templates: "starter",
  kanban_view: "starter",
  // Growth features
  ai_call_recaps: "growth",
  lead_scoring: "growth",
  sentiment_analysis: "growth",
  ai_templates: "growth",
  ai_voice_agent_limited: "growth",
  // Scale features
  ai_voice_agent_unlimited: "scale",
  ai_weekly_digest: "scale",
  call_transcription: "scale",
  webhook_integrations: "scale",
  api_access: "scale",
};

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  requiredTier,
  fallback,
  showUpgradePrompt = true,
}) => {
  const { hasFeature, isLoading, subscribed } = useSubscription();
  const navigate = useNavigate();

  if (isLoading) {
    return null;
  }

  const hasAccess = hasFeature(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  const tierRequired = requiredTier || FEATURE_TIER_MAP[feature] || "growth";
  const tierName = TIER_NAMES[tierRequired] || "Growth";

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg z-10 flex flex-col items-center justify-center p-6">
        <div className="bg-card border border-border rounded-xl p-6 text-center max-w-sm shadow-lg">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold text-lg mb-2">
            {tierName} Plan Required
          </h3>
          <p className="text-muted-foreground text-sm mb-4">
            Upgrade to the {tierName} plan to unlock this feature and supercharge your lead generation.
          </p>
          <Button
            onClick={() => {
              navigate("/");
              setTimeout(() => {
                document.querySelector("#pricing")?.scrollIntoView({ behavior: "smooth" });
              }, 100);
            }}
            className="gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Upgrade Now
          </Button>
        </div>
      </div>
      <div className="opacity-30 pointer-events-none">
        {children}
      </div>
    </div>
  );
};

// Hook for conditional rendering without visual gate
export const useFeatureAccess = (feature: Feature): boolean => {
  const { hasFeature } = useSubscription();
  return hasFeature(feature);
};
