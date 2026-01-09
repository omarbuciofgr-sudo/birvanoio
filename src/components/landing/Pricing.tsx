import { Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const plans = [
  {
    name: "Starter",
    monthlyPrice: 49,
    yearlyPrice: 39,
    description: "Perfect for solo reps or small teams just getting started.",
    features: [
      "50 leads per seat/month",
      "Full CRM access",
      "Click-to-call with recording",
      "SMS & email tools",
      "CSV import & export",
      "Basic message templates",
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
    description: "For growing teams that need more leads and smarter AI tools.",
    features: [
      "150 leads per seat/month",
      "Everything in Starter",
      "AI-powered call recaps",
      "Lead scoring & sentiment analysis",
      "AI message templates",
      "AI voice agent (limited minutes)",
      "Priority support",
    ],
    popular: true,
    monthlyPriceId: "price_1SnL7z2K2aKgw8lL9eBDzOyl",
    yearlyPriceId: "price_1SnLHI2K2aKgw8lLED3IgbcT",
  },
  {
    name: "Scale",
    monthlyPrice: 149,
    yearlyPrice: 119,
    description: "For agencies and teams that need volume, AI, and exclusivity.",
    features: [
      "300 leads per seat/month",
      "Everything in Growth",
      "Unlimited AI voice agent",
      "AI weekly digest reports",
      "Call transcription & analysis",
      "Zip-level exclusivity",
      "Webhook integrations",
      "Dedicated account manager",
      "API access",
    ],
    popular: false,
    monthlyPriceId: "price_1SnLBL2K2aKgw8lLVLOgPcXu",
    yearlyPriceId: "price_1SnLJK2K2aKgw8lLBGXjTAgd",
  },
];

const Pricing = () => {
  const [isYearly, setIsYearly] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const navigate = useNavigate();
  
  const handleSubscribe = async (plan: typeof plans[0]) => {
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

  return (
    <section id="pricing" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/10 to-background" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Choose Your <span className="gradient-text">Plan</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
            Scale your lead generation with plans designed for every stage of growth. All plans include our full CRM and AI-powered tools.
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative p-8 rounded-2xl ${
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

              <div className="mb-6">
                <h3 className="font-display text-2xl font-bold text-foreground mb-2">
                  {plan.name}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {plan.description}
                </p>
              </div>

              <div className="mb-8">
                <span className="font-display text-5xl font-bold text-foreground">
                  ${isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                </span>
                <span className="text-muted-foreground">/seat/month</span>
                {isYearly && (
                  <div className="text-sm text-primary mt-1">
                    Billed annually (${plan.yearlyPrice * 12}/seat/year)
                  </div>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-primary" />
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
                {loadingPlan === plan.name ? "Loading..." : "Get Started"}
              </Button>
            </div>
          ))}
        </div>

        {/* Enterprise CTA */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-2">Need a custom solution for your enterprise?</p>
          <a 
            href="#contact" 
            className="text-primary hover:underline font-medium"
            onClick={(e) => {
              e.preventDefault();
              document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Contact us for custom pricing →
          </a>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
