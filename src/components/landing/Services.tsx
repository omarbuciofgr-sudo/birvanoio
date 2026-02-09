import { Database, Sparkles, Bot, Search, BarChart3, Workflow } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const services = [
  {
    icon: Search,
    title: "Web Scraper",
    description: "Scrape leads from any industry, any city. Google Places, real estate, FSBO — all self-service.",
  },
  {
    icon: Database,
    title: "Data Enrichment",
    description: "Waterfall enrichment across 100+ providers. Verified emails, phones, LinkedIn, and company data.",
  },
  {
    icon: Bot,
    title: "AI Voice Agent",
    description: "Automated outreach calls with natural conversation, smart qualification, and meeting booking.",
  },
  {
    icon: Sparkles,
    title: "AI Automation",
    description: "AI writes outreach, scores leads, analyzes sentiment, and generates pipeline digests hands-free.",
  },
  {
    icon: Workflow,
    title: "Workflow Engine",
    description: "Chain actions: scrape → enrich → score → route → outreach. Let AI handle repetitive work.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description: "Track conversion rates, enrichment ROI, campaign performance, and pipeline health with AI insights.",
  },
];

const Services = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="services" className="py-24 bg-muted/30">
      <div ref={ref} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Platform</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Everything you need to grow
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Find, enrich, and close leads — powered by AI, built for self-service.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
          {services.map((service, index) => (
            <div
              key={service.title}
              className={`group p-6 rounded-xl hover:bg-card transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
              style={{ transitionDelay: `${index * 80}ms` }}
            >
              <service.icon className="w-5 h-5 text-primary mb-4" />
              <h3 className="font-display text-base font-semibold text-foreground mb-2">
                {service.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
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
