import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, ArrowUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface CreditLimitPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditsUsed: number;
  creditLimit: number;
  currentTier: string;
}

const NEXT_TIER: Record<string, { name: string; credits: number }> = {
  free: { name: "Starter", credits: 100 },
  starter: { name: "Growth", credits: 300 },
  growth: { name: "Scale", credits: 1000 },
  scale: { name: "Enterprise", credits: Infinity },
};

export const CreditLimitPopup: React.FC<CreditLimitPopupProps> = ({
  open,
  onOpenChange,
  creditsUsed,
  creditLimit,
  currentTier,
}) => {
  const navigate = useNavigate();
  const [loadingCredits, setLoadingCredits] = React.useState(false);
  const nextTier = NEXT_TIER[currentTier];

  const handleBuyCredits = async () => {
    setLoadingCredits(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId: "price_1SyxqL2K2aKgw8lLV9RTNSg2",
          mode: "payment",
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch {
      toast.error("Failed to create checkout session");
    } finally {
      setLoadingCredits(false);
    }
  };

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate("/");
    setTimeout(() => {
      document.querySelector("#pricing")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Enrichment Credit Limit Reached
          </DialogTitle>
          <DialogDescription>
            You've used all {creditLimit} enrichment credits for this month on your{" "}
            {currentTier === "free" ? "Free" : currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} plan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="bg-secondary/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{creditsUsed} / {creditLimit}</p>
            <p className="text-sm text-muted-foreground">credits used this month</p>
          </div>

          <div className="space-y-3">
            {nextTier && (
              <Button onClick={handleUpgrade} className="w-full gap-2" size="lg">
                <ArrowUp className="w-4 h-4" />
                Upgrade to {nextTier.name} ({nextTier.credits === Infinity ? "Unlimited" : `${nextTier.credits} credits/mo`})
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handleBuyCredits}
              className="w-full gap-2"
              size="lg"
              disabled={loadingCredits}
            >
              <Sparkles className="w-4 h-4" />
              Buy 50 Credits — $19.99
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            One-time credits never expire and stack on top of your monthly allowance.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
