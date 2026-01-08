import { Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { SUBSCRIPTION_PLANS, PlanKey } from "@/lib/subscriptionPlans";

const Pricing = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate("/pricing");
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
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Get verified FRBO leads delivered weekly. Scale your lead generation with plans designed for every stage of growth.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {(Object.entries(SUBSCRIPTION_PLANS) as [PlanKey, typeof SUBSCRIPTION_PLANS[PlanKey]][]).map(([key, plan]) => {
            const isPopular = "popular" in plan && plan.popular;
            
            return (
              <div
                key={key}
                className={`relative p-8 rounded-2xl ${
                  isPopular
                    ? "bg-card border-2 border-primary shadow-xl shadow-primary/10"
                    : "bg-card border border-border"
                }`}
              >
                {isPopular && (
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
                    ${plan.price}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                  <div className="text-sm text-primary mt-1">
                    {plan.leads} leads • {plan.leadsPerWeek}/week
                  </div>
                </div>

                <ul className="space-y-4 mb-8">
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
                    isPopular
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-secondary text-foreground hover:bg-secondary/80"
                  }`}
                  onClick={handleGetStarted}
                >
                  Get Started
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
