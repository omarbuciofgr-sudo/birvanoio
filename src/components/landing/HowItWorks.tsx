import { Search, Sparkles, Mail, TrendingUp } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const steps = [
  {
    icon: Search,
    step: "01",
    title: "Search & Scrape",
    description: "Enter your target industry and location. Our AI finds fresh leads from verified sources in real-time.",
  },
  {
    icon: Sparkles,
    step: "02",
    title: "AI Enrichment",
    description: "Automatically enrich with verified emails, phones, company data, and intent signals from 100+ providers.",
  },
  {
    icon: Mail,
    step: "03",
    title: "AI Outreach",
    description: "Launch personalized email sequences, SMS, or let your AI voice agent handle calls — all automated.",
  },
  {
    icon: TrendingUp,
    step: "04",
    title: "Close & Scale",
    description: "AI scores leads, analyzes sentiment, and surfaces your hottest opportunities in a unified CRM.",
  },
];

const HowItWorks = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="how-it-works" className="py-24">
      <div ref={ref} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Process</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground">
            How it works
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className={`text-center transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
              style={{ transitionDelay: `${index * 120}ms` }}
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl border border-border bg-card mb-5">
                <step.icon className="w-6 h-6 text-primary" />
              </div>
              <p className="text-xs font-mono text-muted-foreground mb-2">{step.step}</p>
              <h3 className="font-display text-base font-semibold text-foreground mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
