import { Database, Users, Lock, Phone, Sparkles, Building2, Mic, Bot, BarChart3, MessageSquare } from "lucide-react";

const services = [
  {
    icon: Database,
    title: "Fresh, Verified Leads",
    description: "Our proprietary scrapers collect live data from verified public sources. Every lead includes source URL and best available contact info (email and/or phone when publicly available).",
  },
  {
    icon: Phone,
    title: "Click-to-Call with Recording",
    description: "Call leads directly from your dashboard with automatic call recording, logging, and AI-generated transcriptions for every conversation.",
  },
  {
    icon: Bot,
    title: "AI Voice Agent",
    description: "Let our AI voice agent handle initial outreach and qualification calls. It speaks naturally, answers questions, and logs everything automatically.",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Recaps",
    description: "After every call, our AI generates follow-up emails and texts automatically. Get weekly AI digests summarizing your pipeline activity.",
  },
  {
    icon: BarChart3,
    title: "Lead Scoring & Sentiment",
    description: "AI automatically scores leads based on engagement and analyzes sentiment from conversations to help you prioritize high-value prospects.",
  },
  {
    icon: MessageSquare,
    title: "SMS, Email & Templates",
    description: "Send texts and emails without leaving the platform. Use AI-generated templates or create your own for consistent outreach.",
  },
  {
    icon: Mic,
    title: "Call Recording & Transcription",
    description: "Every call is recorded, transcribed, and stored. Review conversations, train your team, and maintain compliance.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Assign leads to team members, track activity across your org, and manage permissions. Kanban boards and activity timelines keep everyone aligned.",
  },
  {
    icon: Lock,
    title: "Exclusive Data",
    description: "No recycled lists. Choose your cities, industries, and filters. Your leads are exclusively yours — not shared with competitors.",
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
