import { UserPlus, Target, TrendingUp } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    step: "01",
    title: "Sign Up & Set Filters",
    description: "Tell us your target industries, cities, and lead preferences. We handle the rest.",
  },
  {
    icon: Target,
    step: "02",
    title: "Get Fresh Leads Daily",
    description: "Verified leads delivered straight to your CRM — no recycled lists, no duplicates.",
  },
  {
    icon: TrendingUp,
    step: "03",
    title: "Close More Deals",
    description: "Call, text, and email from one dashboard. AI recaps save you hours every week.",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-background to-secondary/20" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-4">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Start generating leads in minutes, not days.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, index) => (
            <div key={step.title} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-16 left-[60%] w-[80%] h-[2px] bg-gradient-to-r from-primary/50 to-primary/10" />
              )}
              
              <div className="text-center">
                {/* Step number */}
                <div className="inline-flex items-center justify-center w-32 h-32 rounded-2xl bg-card border border-border mb-6 relative group hover:border-primary/50 transition-colors">
                  <span className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                    {step.step}
                  </span>
                  <step.icon className="w-12 h-12 text-primary" />
                </div>
                
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
