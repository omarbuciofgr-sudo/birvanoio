import { Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CREDIT_COSTS } from "@/hooks/useCredits";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const plans = [
  {
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    credits: 50,
    description: "Try with no commitment.",
    features: ["50 credits/month", "Web scraper", "CSV enrichment", "AI lead scoring", "Unlimited calls & email", "Full CRM access"],
    popular: false,
    monthlyPriceId: null,
    yearlyPriceId: null,
  },
  {
    name: "Starter",
    monthlyPrice: 49,
    yearlyPrice: 39,
    credits: 500,
    description: "For solo reps ramping up.",
    features: ["500 credits/month", "Everything in Free", "CSV import & export", "Message templates", "Call recording", "Email support"],
    popular: false,
    monthlyPriceId: "price_1SnL6O2K2aKgw8lLpeaoYPSp",
    yearlyPriceId: "price_1SnLG42K2aKgw8lLL6TIsWBx",
  },
  {
    name: "Growth",
    monthlyPrice: 99,
    yearlyPrice: 79,
    credits: 2000,
    description: "For teams that need AI tools.",
    features: ["2,000 credits/month", "Everything in Starter", "AI call recaps", "AI lead scoring & sentiment", "AI voice agent", "Priority support"],
    popular: true,
    monthlyPriceId: "price_1SnL7z2K2aKgw8lL9eBDzOyl",
    yearlyPriceId: "price_1SnLHI2K2aKgw8lLED3IgbcT",
  },
  {
    name: "Scale",
    monthlyPrice: 249,
    yearlyPrice: 199,
    credits: 10000,
    description: "For agencies at volume.",
    features: ["10,000 credits/month", "Everything in Growth", "Prospect & industry search", "Skip tracing", "Webhook & API access", "Dedicated manager"],
    popular: false,
    monthlyPriceId: "price_1SnLBL2K2aKgw8lLVLOgPcXu",
    yearlyPriceId: "price_1SnLJK2K2aKgw8lLBGXjTAgd",
  },
];

const Pricing = () => {
  const [isYearly, setIsYearly] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const navigate = useNavigate();
  const { ref, isVisible } = useScrollAnimation();

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
      const { data, error } = await supabase.functions.invoke("create-checkout", { body: { priceId } });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <section id="pricing" className="py-24">
      <div ref={ref} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Pricing</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Simple, credit-based pricing
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto mb-8">
            Pay for what you use. Every plan includes unlimited calls, email & SMS.
          </p>

          <div className="inline-flex items-center gap-1 p-1 rounded-full border border-border bg-card">
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan, index) => (
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
                  {plan.monthlyPrice === 0 ? "Free" : `$${isYearly ? plan.yearlyPrice : plan.monthlyPrice}`}
                </span>
                {plan.monthlyPrice > 0 && <span className="text-muted-foreground text-sm">/mo</span>}
              </div>

              <div className="mb-5 flex items-center gap-1">
                <Zap className="w-3 h-3 text-primary" />
                <span className="text-xs font-medium text-primary">
                  {plan.credits.toLocaleString()} credits/mo
                </span>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((feature) => (
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
                {loadingPlan === plan.name ? "Loading..." : plan.monthlyPrice === 0 ? "Start Free" : "Get Started"}
              </Button>
            </div>
          ))}
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
  );
};

export default Pricing;
