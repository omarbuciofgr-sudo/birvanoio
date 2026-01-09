import { Phone, MessageSquare, Mic, Sparkles, Bot, BarChart3 } from "lucide-react";

const features = [
  {
    icon: Phone,
    title: "Click-to-Call",
    description: "Call leads directly from your dashboard with automatic logging and recording",
  },
  {
    icon: Bot,
    title: "AI Voice Agent",
    description: "Automated outreach calls with natural conversation and smart qualification",
  },
  {
    icon: Mic,
    title: "Recording & Transcription",
    description: "Every call is recorded, transcribed, and analyzed for insights",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Follow-ups",
    description: "Automatic recaps, follow-up emails, and weekly pipeline digests",
  },
  {
    icon: BarChart3,
    title: "Lead Scoring & Sentiment",
    description: "AI scores leads and analyzes conversation sentiment automatically",
  },
  {
    icon: MessageSquare,
    title: "SMS & Email",
    description: "Send texts and emails without leaving the platform",
  },
];

const CRMShowcase = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/20 via-background to-background" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Built-in CRM + AI Tools</span>
          </div>
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-4">
            More Than Just Leads — <span className="gradient-text">A Complete Sales Platform</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Call, text, and email your leads directly from your dashboard. 
            Every interaction is logged, recorded, transcribed, and enhanced with AI.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-5 rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display text-base font-semibold text-foreground mb-1.5">
                {feature.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CRMShowcase;
