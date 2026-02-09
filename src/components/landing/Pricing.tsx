import { Check, Star, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CREDIT_COSTS } from "@/hooks/useCredits";

const plans = [
  {
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    credits: 50,
    description: "Try the platform with no commitment.",
    features: [
      "50 credits/month",
      "Web scraper (1 credit/lead)",
      "CSV enrichment (2 credits/row)",
      "AI lead scoring (1 credit)",
      "Unlimited calls, email & SMS",
      "Full CRM access",
    ],
    popular: false,
    monthlyPriceId: null,
    yearlyPriceId: null,
  },
  {
    name: "Starter",
    monthlyPrice: 49,
    yearlyPrice: 39,
    credits: 500,
    description: "For solo reps ramping up outreach.",
    features: [
      "500 credits/month",
      "Everything in Free",
      "CSV import & export",
      "Basic message templates",
      "Click-to-call with recording",
      "Email support",
    ],
    popular: false,
    monthlyPriceId: "price_1SnL6O2K2aKgw8lLpeaoYPSp",
    yearlyPriceId: "price_1SnLG42K2aKgw8lLL6TIsWBx",
  },
  {
    name: "Growth",
    monthlyPrice: 99,
    yearlyPrice: 79,
    credits: 2000,
    description: "For teams that need volume and AI tools.",
    features: [
      "2,000 credits/month",
      "Everything in Starter",
      "AI call recaps & transcription",
      "AI lead scoring & sentiment",
      "AI message templates",
      "AI voice agent",
      "Priority support",
    ],
    popular: true,
    monthlyPriceId: "price_1SnL7z2K2aKgw8lL9eBDzOyl",
    yearlyPriceId: "price_1SnLHI2K2aKgw8lLED3IgbcT",
  },
  {
    name: "Scale",
    monthlyPrice: 249,
    yearlyPrice: 199,
    credits: 10000,
    description: "For agencies that need massive volume.",
    features: [
      "10,000 credits/month",
      "Everything in Growth",
      "Prospect & industry search",
      "Skip tracing (5 credits)",
      "Webhook integrations & API",
      "AI weekly digest reports",
      "Dedicated account manager",
    ],
    popular: false,
    monthlyPriceId: "price_1SnLBL2K2aKgw8lLVLOgPcXu",
    yearlyPriceId: "price_1SnLJK2K2aKgw8lLBGXjTAgd",
  },
];

const creditCostRows = [
  { action: "Web scrape", cost: CREDIT_COSTS.scrape, unit: "per lead" },
  { action: "CSV enrichment", cost: CREDIT_COSTS.enrich, unit: "per row" },
  { action: "Prospect / industry search", cost: CREDIT_COSTS.search, unit: "per result" },
  { action: "AI lead scoring", cost: CREDIT_COSTS.lead_score, unit: "per lead" },
  { action: "AI sentiment analysis", cost: CREDIT_COSTS.sentiment, unit: "per analysis" },
  { action: "Skip tracing", cost: CREDIT_COSTS.skip_trace, unit: "per lookup" },
  { action: "Calls, email & SMS", cost: 0, unit: "unlimited" },
];

const Pricing = () => {
  const [isYearly, setIsYearly] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubscribe = async (plan: typeof plans[0]) => {
    if (!plan.monthlyPriceId) {
      navigate("/auth");
      return;
    }

    setLoadingPlan(plan.name);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.info("Please sign in to subscribe");
        navigate("/auth");
        return;
      }

      const priceId = isYearly ? plan.yearlyPriceId : plan.monthlyPriceId;

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleBuyCredits = async () => {
    setLoadingPlan("credits");

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.info("Please sign in to purchase credits");
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: "price_1SyxqL2K2aKgw8lLV9RTNSg2", mode: "payment" },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <section id="pricing" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/10 to-background" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Simple, <span className="gradient-text">Credit-Based</span> Pricing
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
            Pay for what you use. Every plan includes unlimited calls, email & SMS.
            Credits power scraping, enrichment, and AI tools.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-4 p-1.5 rounded-full bg-card border border-border">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                !isYearly
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                isYearly
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                isYearly ? "bg-primary-foreground/20" : "bg-primary/10 text-primary"
              }`}>
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative p-6 rounded-2xl ${
                plan.popular
                  ? "bg-card border-2 border-primary shadow-xl shadow-primary/10"
                  : "bg-card border border-border"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  <Star className="w-4 h-4" />
                  Most Popular
                </div>
              )}

              <div className="mb-4">
                <h3 className="font-display text-xl font-bold text-foreground mb-1">
                  {plan.name}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {plan.description}
                </p>
              </div>

              <div className="mb-2">
                <span className="font-display text-4xl font-bold text-foreground">
                  {plan.monthlyPrice === 0 ? "Free" : `$${isYearly ? plan.yearlyPrice : plan.monthlyPrice}`}
                </span>
                {plan.monthlyPrice > 0 && (
                  <span className="text-muted-foreground">/mo</span>
                )}
              </div>

              <div className="mb-6 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primary">
                  {plan.credits === Infinity ? "Unlimited" : plan.credits.toLocaleString()} credits/mo
                </span>
              </div>

              <ul className="space-y-2.5 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-2.5 h-2.5 text-primary" />
                    </div>
                    <span className="text-muted-foreground text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className={`w-full ${
                  plan.popular
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-secondary text-foreground hover:bg-secondary/80"
                }`}
                onClick={() => handleSubscribe(plan)}
                disabled={loadingPlan === plan.name}
              >
                {loadingPlan === plan.name ? "Loading..." : plan.monthlyPrice === 0 ? "Start Free" : "Get Started"}
              </Button>
            </div>
          ))}
        </div>

        {/* Credit Cost Breakdown */}
        <div className="mt-16 p-8 rounded-2xl bg-card border border-border">
          <h3 className="font-display text-2xl font-bold text-foreground mb-6 text-center">
            How Credits Work
          </h3>
          <div className="max-w-2xl mx-auto">
            <div className="grid grid-cols-3 gap-4 text-sm font-medium text-muted-foreground border-b border-border pb-3 mb-3">
              <span>Action</span>
              <span className="text-center">Cost</span>
              <span className="text-right">Unit</span>
            </div>
            {creditCostRows.map((row) => (
              <div key={row.action} className="grid grid-cols-3 gap-4 text-sm py-2.5 border-b border-border/50 last:border-0">
                <span className="text-foreground">{row.action}</span>
                <span className="text-center font-semibold text-primary">
                  {row.cost === 0 ? "Free" : `${row.cost} credit${row.cost > 1 ? "s" : ""}`}
                </span>
                <span className="text-right text-muted-foreground">{row.unit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top-Up Credits */}
        <div className="mt-8 p-8 rounded-2xl bg-gradient-to-br from-secondary/50 to-secondary/20 border border-border">
          <div className="max-w-2xl mx-auto text-center">
            <h3 className="font-display text-2xl font-bold text-foreground mb-2">
              Need More Credits?
            </h3>
            <p className="text-muted-foreground mb-6">
              Buy top-up packs anytime. Bonus credits never expire and stack on top of your monthly allowance.
            </p>
            <div className="inline-flex items-center gap-6 p-6 rounded-xl bg-card border border-border">
              <div className="text-left">
                <div className="font-display text-xl font-bold text-foreground">
                  500 Credits
                </div>
                <div className="text-sm text-muted-foreground">
                  Use for any action
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-3xl font-bold text-foreground">
                  $29.99
                </div>
                <div className="text-xs text-muted-foreground">one-time</div>
              </div>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => handleBuyCredits()}
                disabled={loadingPlan === "credits"}
              >
                {loadingPlan === "credits" ? "Loading..." : "Buy Credits"}
              </Button>
            </div>
          </div>
        </div>

        {/* Enterprise CTA */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-2">Need unlimited credits or custom integrations?</p>
          <a
            href="#pricing"
            className="text-primary hover:underline font-medium"
            onClick={(e) => {
              e.preventDefault();
              navigate("/auth?demo=true");
            }}
          >
            Get a demo for Enterprise pricing →
          </a>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
