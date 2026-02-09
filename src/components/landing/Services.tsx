import { Database, Sparkles, Bot, Search, BarChart3, Workflow } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const services = [
  {
    icon: Search,
    title: "Self-Service Web Scraper",
    description: "Scrape leads from any industry, any city. Our AI-powered scraper handles Google Places, real estate listings, FSBO data, and more — all on your own.",
  },
  {
    icon: Database,
    title: "Multi-Provider Enrichment",
    description: "Waterfall enrichment across 100+ data providers. Automatically find verified emails, phones, LinkedIn profiles, and company data for every lead.",
  },
  {
    icon: Bot,
    title: "AI Voice Agent & Calling",
    description: "Let your AI voice agent handle cold calls, qualify leads, and book meetings. Every call is recorded, transcribed, and summarized automatically.",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Automation",
    description: "AI writes your outreach emails, scores leads, analyzes sentiment, detects intent signals, and generates weekly pipeline digests — hands-free.",
  },
  {
    icon: Workflow,
    title: "Workflow Orchestration",
    description: "Build automated workflows: scrape → enrich → score → route → outreach. Chain actions together and let AI handle the repetitive work.",
  },
  {
    icon: BarChart3,
    title: "Analytics & Intelligence",
    description: "Track conversion rates, enrichment ROI, campaign performance, and pipeline health. AI surfaces insights you'd otherwise miss.",
  },
];

const Services = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="services" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/20 via-background to-background" />
      
      <div ref={ref} className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Your All-in-One <span className="gradient-text">Growth Platform</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Everything you need to find, enrich, and close leads — powered by AI, built for self-service.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <div
              key={service.title}
              className={`group p-8 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-500 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                <service.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                {service.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
