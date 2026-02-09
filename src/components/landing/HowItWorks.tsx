import { Search, Sparkles, Mail, TrendingUp } from "lucide-react";

const steps = [
  {
    icon: Search,
    step: "01",
    title: "Search & Scrape",
    description: "Enter your target industry and location. Our AI scraper finds fresh leads from verified public sources in real-time.",
  },
  {
    icon: Sparkles,
    step: "02",
    title: "AI Enrichment",
    description: "Automatically enrich leads with verified emails, phone numbers, company data, and intent signals using 100+ data providers.",
  },
  {
    icon: Mail,
    step: "03",
    title: "AI Outreach",
    description: "Launch personalized email sequences, SMS campaigns, or let your AI voice agent make calls — all automated.",
  },
  {
    icon: TrendingUp,
    step: "04",
    title: "Close & Scale",
    description: "Track every interaction in your CRM. AI scores leads, analyzes sentiment, and surfaces your hottest opportunities.",
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
            Go from zero to closing deals in minutes. No sales reps, no onboarding calls — just results.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={step.title} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-16 left-[60%] w-[80%] h-[2px] bg-gradient-to-r from-primary/50 to-primary/10" />
              )}
              
              <div className="text-center">
                {/* Step number */}
                <div className="inline-flex items-center justify-center w-28 h-28 rounded-2xl bg-card border border-border mb-6 relative group hover:border-primary/50 transition-colors">
                  <span className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                    {step.step}
                  </span>
                  <step.icon className="w-10 h-10 text-primary" />
                </div>
                
                <h3 className="font-display text-lg font-semibold text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed max-w-xs mx-auto text-sm">
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
