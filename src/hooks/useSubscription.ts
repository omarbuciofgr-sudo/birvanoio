import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getPlanByProductId, PlanKey, SUBSCRIPTION_PLANS } from "@/lib/subscriptionPlans";

interface SubscriptionState {
  isLoading: boolean;
  subscribed: boolean;
  planKey: PlanKey | null;
  subscriptionEnd: string | null;
  error: string | null;
}

export function useSubscription() {
  const { user } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    isLoading: true,
    subscribed: false,
    planKey: null,
    subscriptionEnd: null,
    error: null,
  });

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setState({
        isLoading: false,
        subscribed: false,
        planKey: null,
        subscriptionEnd: null,
        error: null,
      });
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const { data, error } = await supabase.functions.invoke("check-subscription");
      
      if (error) throw error;
      
      const planKey = data.product_id ? getPlanByProductId(data.product_id) : null;
      
      setState({
        isLoading: false,
        subscribed: data.subscribed || false,
        planKey,
        subscriptionEnd: data.subscription_end || null,
        error: null,
      });
    } catch (err) {
      console.error("Error checking subscription:", err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to check subscription",
      }));
    }
  }, [user]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Auto-refresh every minute
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  const currentPlan = state.planKey ? SUBSCRIPTION_PLANS[state.planKey] : null;

  return {
    ...state,
    currentPlan,
    refresh: checkSubscription,
  };
}
