import { Database, Users, Lock, Sparkles, Building2, Bot } from "lucide-react";

const services = [
  {
    icon: Database,
    title: "Fresh, Verified Leads",
    description: "Our proprietary scrapers collect live data from verified public sources. Every lead includes source URL and best available contact info.",
  },
  {
    icon: Lock,
    title: "Exclusive Data",
    description: "No recycled lists. Choose your cities, industries, and filters. Your leads are exclusively yours — not shared with competitors.",
  },
  {
    icon: Bot,
    title: "AI Voice Agent & Calling",
    description: "Click-to-call from your dashboard or let our AI voice agent handle outreach. Every call is recorded, transcribed, and logged automatically.",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Automation",
    description: "Auto-generated follow-ups, lead scoring, sentiment analysis, and weekly pipeline digests — all powered by AI.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Assign leads to team members, track activity across your org, and manage permissions with full activity timelines.",
  },
  {
    icon: Building2,
    title: "Scales With You",
    description: "From solo reps to large agencies — get dedicated support, API access, webhook integrations, and custom solutions as you grow.",
  },
];

const Services = () => {
  return (
    <section id="services" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/20 via-background to-background" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Everything You Need to <span className="gradient-text">Close Deals</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Leads, CRM, AI voice agents, and automation tools — all in one platform designed for sales teams that want results.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <div
              key={service.title}
              className="group p-8 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
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

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-3 px-6 py-3 rounded-full bg-card border border-border">
            <span className="text-muted-foreground">Trusted by teams in:</span>
            <span className="text-foreground font-medium">Real Estate • Insurance • SaaS • Healthcare • Agencies • and More</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Services;
