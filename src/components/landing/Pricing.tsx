import * as React from "react";
import { Check, Zap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { usePricingSettings } from "@/hooks/usePricingSettings";

const plans = [
  {
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    creditsPerSeat: 50,
    ownerLookups: 5,
    aiMessages: 20,
    description: "Try with no commitment.",
    features: [
      "1 seat included",
      "Web scraper",
      "CSV enrichment",
      "AI lead scoring",
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
    creditsPerSeat: 1000,
    ownerLookups: 100,
    aiMessages: 300,
    description: "For solo agents",
    features: [
      "Per-seat pricing",
      "Everything in Free",
      "CSV import & export",
      "Message templates",
      "Call recording",
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
    creditsPerSeat: 2500,
    ownerLookups: 250,
    aiMessages: 1000,
    description: "For busy agents and small teams",
    features: [
      "Per-seat pricing",
      "Everything in Starter",
      "AI call recaps",
      "AI lead scoring & sentiment",
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
    creditsPerSeat: 7500,
    ownerLookups: 750,
    aiMessages: 3000,
    description: "For brokerages and property management companies",
    features: [
      "Per-seat pricing",
      "Everything in Growth",
      "Prospect & industry search",
      "Skip tracing",
      "Webhook & API access",
      "Dedicated manager",
    ],
    popular: false,
    monthlyPriceId: "price_1SnLBL2K2aKgw8lLVLOgPcXu",
    yearlyPriceId: "price_1SnLJK2K2aKgw8lLBGXjTAgd",
  },
];

const Pricing = React.forwardRef<HTMLDivElement>(function Pricing(_props, ref) {
  const { actionCosts, plans: planRules } = usePricingSettings();
  const [isYearly, setIsYearly] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [seatCount, setSeatCount] = useState(1);
  const navigate = useNavigate();
  const { ref: scrollRef, isVisible } = useScrollAnimation();

  const usageFor = (name: string) => {
    const tier = name.toLowerCase() as "free" | "starter" | "growth" | "scale";
    const credits = planRules[tier]?.credits ?? 0;
    const aiMessages = planRules[tier]?.aiMessages ?? 0;
    return {
      credits,
      aiMessages,
      searches: Math.floor(credits / (actionCosts.city_search || 1)),
      ownerLookups: Math.floor(credits / (actionCosts.owner_contact || 10)),
    };
  };


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
        body: { priceId, seats: seatCount },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (data?.url) window.open(data.url, "_blank");
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div ref={ref} style={{ display: "contents" }}>
    <section id="pricing" className="py-24">
      <div ref={scrollRef} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Pricing</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Per-seat, credit-based pricing
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto mb-8">
            Pay per seat. Each seat includes a monthly credit allowance. Calls, email & SMS included (standard carrier limits apply).
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 p-1 rounded-full border border-border bg-card mb-6">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all ${
                !isYearly ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all ${
                isYearly ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Yearly <span className="text-xs opacity-75">-20%</span>
            </button>
          </div>

          {/* Seat selector */}
          <div className="flex items-center justify-center gap-3">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Seats:</span>
            <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-border bg-card">
              <button
                onClick={() => setSeatCount(Math.max(1, seatCount - 1))}
                className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors text-lg font-medium"
              >
                −
              </button>
              <span className="w-10 text-center font-semibold text-foreground">{seatCount}</span>
              <button
                onClick={() => setSeatCount(Math.min(100, seatCount + 1))}
                className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors text-lg font-medium"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan, index) => {
            const unitPrice = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
            const totalPrice = unitPrice * seatCount;
            const usage = usageFor(plan.name);
            const allFeatures = [
              `${usage.credits.toLocaleString()} credits/seat/month`,
              `About ${usage.searches.toLocaleString()} city searches/mo`,
              `About ${usage.ownerLookups.toLocaleString()} owner contact lookups`,
              `${usage.aiMessages.toLocaleString()} AI-written messages/month`,
              ...plan.features,
            ];
            return (
              <div
                key={plan.name}
                className={`relative p-6 rounded-2xl transition-all duration-500 ${
                  plan.popular
                    ? "bg-card border-2 border-primary"
                    : "bg-card border border-border"
                } ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
                style={{ transitionDelay: `${index * 80}ms` }}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    Popular
                  </div>
                )}

                <h3 className="font-display text-lg font-bold text-foreground mb-1">{plan.name}</h3>
                <p className="text-xs text-muted-foreground mb-4">{plan.description}</p>

                <div className="mb-1">
                  <span className="font-display text-3xl font-bold text-foreground">
                    {totalPrice === 0 ? "Free" : `$${totalPrice}`}
                  </span>
                  {totalPrice > 0 && <span className="text-muted-foreground text-sm">/mo</span>}
                </div>

                {totalPrice > 0 && seatCount > 1 && (
                  <p className="text-xs text-muted-foreground mb-1">
                    ${unitPrice}/seat × {seatCount} seats
                  </p>
                )}

                <div className="mb-5 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-primary" />
                  <span className="text-xs font-medium text-primary">
                    {(usage.credits * seatCount).toLocaleString()} credits/mo total
                  </span>
                </div>

                <ul className="space-y-2 mb-6">
                  {allFeatures.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  size="sm"
                  className={`w-full ${
                    plan.popular
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-secondary text-foreground hover:bg-secondary/80"
                  }`}
                  onClick={() => handleSubscribe(plan)}
                  disabled={loadingPlan === plan.name}
                >
                  {loadingPlan === plan.name ? "Loading..." : totalPrice === 0 ? "Start Free" : "Get Started"}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-12 border-t border-border pt-10">
          <div className="mb-5 text-center">
            <h3 className="font-display text-xl font-bold text-foreground">What does a credit get me?</h3>
            <p className="mt-1 text-sm text-muted-foreground">Credits are charged only when the listed action succeeds.</p>
          </div>
          <div className="mx-auto max-w-2xl overflow-hidden rounded-lg border border-border bg-card">
            {[
              ["Search a city", `${actionCosts.city_search} credit${actionCosts.city_search === 1 ? "" : "s"}`],
              ["Owner contact lookup", `${actionCosts.owner_contact} credits on a match`],
              ["AI-written message", actionCosts.ai_message === 0 ? "Free · monthly limit applies" : `${actionCosts.ai_message} credits`],
              ["Send an SMS", `${actionCosts.sms} credit${actionCosts.sms === 1 ? "" : "s"}`],
              ["Voice call", `${actionCosts.voice_minute} credits per started minute`],
              ["Send an email", actionCosts.email === 0 ? "Free" : `${actionCosts.email} credits`],
            ].map(([action, cost], index) => (
              <div key={action} className={`flex items-center justify-between gap-4 px-4 py-3 text-sm ${index > 0 ? "border-t border-border" : ""}`}>
                <span className="text-foreground">{action}</span>
                <span className="text-right font-medium text-foreground">{cost}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-sm text-muted-foreground">Need more? Add 500 credits for $25 from Billing.</p>
        </div>

        <div className="mt-10 text-center">
          <p className="text-xs text-muted-foreground">
            Need custom volume?{" "}
            <button onClick={() => navigate("/auth?demo=true")} className="text-primary hover:underline">
              Get enterprise pricing →
            </button>
          </p>
        </div>
      </div>
    </section>
    </div>
  );
});

Pricing.displayName = "Pricing";

export default Pricing;
